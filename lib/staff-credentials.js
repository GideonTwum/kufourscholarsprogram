import crypto from "crypto";
import { isValidStaffCreateRole } from "./portal-auth.js";

/** Cryptographically strong temporary password (shown once to director). Never store in DB. */
export function generateTemporaryPassword() {
  const raw = crypto.randomBytes(18).toString("base64url");
  return `${raw.slice(0, 14)}-Aa1!`;
}

/**
 * Create a staff Auth user + profiles row via service role.
 * @returns {{ ok: true, userId: string, email: string, role: string, temporaryPassword: string, created: boolean } | { ok: false, error: string, status: number }}
 */
export async function createStaffUserWithAdmin(admin, { role, email, full_name, password }) {
  if (!isValidStaffCreateRole(role)) {
    return { ok: false, error: "Invalid staff role.", status: 400 };
  }

  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const fullName = typeof full_name === "string" ? full_name.trim() : "";

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { ok: false, error: "A valid email is required.", status: 400 };
  }
  if (!fullName) {
    return { ok: false, error: "Full name is required.", status: 400 };
  }

  const temporaryPassword =
    typeof password === "string" && password.length >= 12
      ? password
      : generateTemporaryPassword();

  // Check existing profile by email
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, role, email")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingProfile) {
    return {
      ok: false,
      error: `An account with this email already exists (role: ${existingProfile.role}).`,
      status: 409,
    };
  }

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role,
    },
  });

  if (authErr || !created?.user) {
    const msg = authErr?.message || "Could not create account.";
    const duplicate = /already|exists|registered/i.test(msg);
    return {
      ok: false,
      error: duplicate ? "An account with this email already exists." : msg,
      status: duplicate ? 409 : 400,
    };
  }

  const userId = created.user.id;

  const { error: profileErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      email: normalizedEmail,
      full_name: fullName,
      role,
      is_active: true,
      deactivated_at: null,
      deactivated_by: null,
    },
    { onConflict: "id" },
  );

  if (profileErr) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return { ok: false, error: profileErr.message, status: 500 };
  }

  if (role === "director") {
    const { error: dirErr } = await admin.from("directors").upsert(
      {
        id: userId,
        full_name: fullName,
        email: normalizedEmail,
        phone: "",
      },
      { onConflict: "id" },
    );
    if (dirErr) {
      console.warn("[createStaffUser] directors upsert:", dirErr.message);
    }
  }

  if (role === "panel") {
    const { data: existingPanel } = await admin
      .from("panel_members")
      .select("id")
      .ilike("email", normalizedEmail)
      .maybeSingle();
    if (!existingPanel) {
      const { error: panelErr } = await admin.from("panel_members").insert({
        email: normalizedEmail,
        full_name: fullName,
      });
      if (panelErr) {
        console.warn("[createStaffUser] panel_members insert:", panelErr.message);
      }
    }
  }

  // Verify the password actually works with the same project anon key the browser uses.
  // createUser can report success while signInWithPassword still fails (env/hash edge cases).
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  let repaired = false;
  if (url && anonKey) {
    const { createClient } = await import("@supabase/supabase-js");
    const probe = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    let { error: probeErr } = await probe.auth.signInWithPassword({
      email: normalizedEmail,
      password: temporaryPassword,
    });
    if (probeErr) {
      const { error: resetErr } = await admin.auth.admin.updateUserById(userId, {
        password: temporaryPassword,
        email_confirm: true,
      });
      if (resetErr) {
        await admin.auth.admin.deleteUser(userId).catch(() => {});
        await admin.from("profiles").delete().eq("id", userId).catch(() => {});
        return {
          ok: false,
          error: `Account created but password could not be verified/repaired: ${resetErr.message}`,
          status: 500,
        };
      }
      repaired = true;
      ({ error: probeErr } = await probe.auth.signInWithPassword({
        email: normalizedEmail,
        password: temporaryPassword,
      }));
      if (probeErr) {
        await admin.auth.admin.deleteUser(userId).catch(() => {});
        await admin.from("profiles").delete().eq("id", userId).catch(() => {});
        return {
          ok: false,
          error: `Account created but login still fails after password repair: ${probeErr.message}`,
          status: 500,
        };
      }
    }
    await probe.auth.signOut().catch(() => {});
  }

  return {
    ok: true,
    userId,
    email: normalizedEmail,
    role,
    temporaryPassword,
    created: true,
    passwordVerified: Boolean(url && anonKey),
    passwordRepaired: repaired,
  };
}
