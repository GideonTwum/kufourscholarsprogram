import crypto from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sanitizeDirectorSignupInput,
  sanitizePhone,
  isValidEmail,
  validateDirectorSignupClientFields,
} from "@/lib/director-signup-validation";

function expectedDirectorCode() {
  return (
    process.env.DIRECTOR_SIGNUP_CODE ||
    process.env.DIRECTOR_REGISTRATION_CODE ||
    ""
  ).trim();
}

function signupAttemptKey(request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "unknown";
  return crypto.createHash("sha256").update(address).digest("hex");
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const fields = sanitizeDirectorSignupInput({
    fullName: body.fullName,
    email: body.email,
    phone: body.phone,
    directorCode: body.directorCode,
    password: body.password,
    confirmPassword: body.confirmPassword,
  });

  const fieldErrors = validateDirectorSignupClientFields(fields);

  if (Object.keys(fieldErrors).length) {
    return NextResponse.json({ ok: false, error: "Validation failed.", fields: fieldErrors }, { status: 400 });
  }

  if (!isValidEmail(fields.email)) {
    return NextResponse.json({ ok: false, error: "Invalid email format.", fields: { email: "Invalid email." } }, { status: 400 });
  }

  const phoneClean = fields.phone;
  if (!phoneClean || phoneClean.replace(/\D/g, "").length < 8) {
    return NextResponse.json({ ok: false, error: "Invalid phone number.", fields: { phone: "Invalid phone." } }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: "Server misconfiguration." }, { status: 500 });
  }

  const { data: allowed, error: limitError } = await admin.rpc(
    "consume_director_signup_attempt",
    { p_attempt_key: signupAttemptKey(request) }
  );
  if (limitError) {
    return NextResponse.json(
      { ok: false, error: "Director signup is temporarily unavailable." },
      { status: 503 }
    );
  }
  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many signup attempts. Try again later." },
      { status: 429, headers: { "Retry-After": "900" } }
    );
  }

  const expected = expectedDirectorCode();
  const codeOk = expected && timingSafeEqualStrings(fields.directorCode, expected);
  if (!codeOk) {
    return NextResponse.json(
      { ok: false, error: "Invalid director code.", code: "INVALID_CODE" },
      { status: 403 }
    );
  }

  const { data: exists } = await admin
    .from("directors")
    .select("id")
    .eq("email", fields.email)
    .maybeSingle();
  if (exists) {
    return NextResponse.json(
      { ok: false, error: "An account with this email already exists.", code: "EMAIL_EXISTS" },
      { status: 409 }
    );
  }

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: fields.email,
    password: fields.password,
    email_confirm: true,
    user_metadata: {
      full_name: fields.fullName,
      role: "director",
    },
  });

  if (authErr || !created?.user) {
    const msg = authErr?.message || "Could not create account.";
    const duplicate =
      /already been registered|already exists|duplicate/i.test(msg || "") ||
      authErr?.status === 422;
    return NextResponse.json(
      {
        ok: false,
        error: duplicate ? "An account with this email already exists." : msg,
        code: duplicate ? "EMAIL_EXISTS" : "AUTH_ERROR",
      },
      { status: duplicate ? 409 : 400 }
    );
  }

  const uid = created.user.id;

  const { error: insErr } = await admin.from("directors").insert({
    id: uid,
    full_name: fields.fullName,
    email: fields.email,
    phone: phoneClean,
  });

  if (insErr) {
    await admin.auth.admin.deleteUser(uid);
    const dupEmail = insErr.code === "23505" || /duplicate|unique/i.test(insErr.message);
    return NextResponse.json(
      {
        ok: false,
        error: dupEmail ? "An account with this email already exists." : insErr.message,
        code: dupEmail ? "EMAIL_EXISTS" : "DB_ERROR",
      },
      { status: dupEmail ? 409 : 500 }
    );
  }

  return NextResponse.json({ ok: true, message: "Account created successfully" });
}

function timingSafeEqualStrings(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
