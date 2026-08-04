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

  return {
    ok: true,
    userId,
    email: normalizedEmail,
    role,
    temporaryPassword,
    created: true,
  };
}
