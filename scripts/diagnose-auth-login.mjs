#!/usr/bin/env node
/**
 * Safe auth diagnostic — prints hosts / integrity only. Never prints secrets or passwords.
 *
 * Usage:
 *   node scripts/diagnose-auth-login.mjs
 *   DIAG_LOGIN_EMAIL=... DIAG_LOGIN_PASSWORD=... node scripts/diagnose-auth-login.mjs
 *   DIAG_LIST_RECENT_APPLICANTS=1 node scripts/diagnose-auth-login.mjs
 *
 * Password is optional; if omitted, only identity/integrity checks run.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const [k, ...r] = t.split("=");
    if (process.env[k]) continue;
    process.env[k] = r.join("=").replace(/^['"]|['"]$/g, "");
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "(invalid)";
  }
}

function keyKind(key) {
  if (!key) return "MISSING";
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
    return payload.role || "unknown-jwt";
  } catch {
    return "non-jwt-or-opaque";
  }
}

function jwtRef(key) {
  try {
    return JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8")).ref || null;
  } catch {
    return null;
  }
}

async function findUserByEmail(admin, email) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 30; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = (data?.users || []).find((u) => (u.email || "").toLowerCase() === target);
    if (user) return user;
    if (!data?.users || data.users.length < 100) return null;
  }
  return null;
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const email =
  (process.env.DIAG_LOGIN_EMAIL || "asaretwumgideonn@gmail.com").trim().toLowerCase();
const listRecentApplicants = process.env.DIAG_LIST_RECENT_APPLICANTS === "1";
const password = process.env.DIAG_LOGIN_PASSWORD || "";
const knownId = process.env.DIAG_USER_ID || "3f0e8dd2-e3a5-448e-b0a7-6d25fd983f33";

const report = {
  env: {
    envLocalPresent: existsSync(".env.local"),
    envPresent: existsSync(".env"),
    projectHost: hostOf(url),
    anonKeyKind: keyKind(anon),
    serviceKeyKind: keyKind(service),
    anonJwtRef: jwtRef(anon),
    serviceJwtRef: jwtRef(service),
    jwtRefsMatch: jwtRef(anon) === jwtRef(service),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || null,
    directorMfaRequired: false,
  },
};

if (!url || !service || !anon) {
  console.log(JSON.stringify({ ...report, fatal: "Missing URL/anon/service env" }, null, 2));
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const browserLike = createClient(url, anon, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let user = await findUserByEmail(admin, email);
let byId = null;
if (!user && knownId) {
  const { data, error } = await admin.auth.admin.getUserById(knownId);
  byId = {
    lookedUpId: knownId,
    found: Boolean(data?.user),
    email: data?.user?.email || null,
    error: error?.message || null,
  };
  if (data?.user) user = data.user;
}

const auth = user
  ? {
      id: user.id,
      email: user.email,
      email_confirmed_at: user.email_confirmed_at || null,
      banned_until: user.banned_until || null,
      deleted: Boolean(user.deleted_at),
      last_sign_in_at: user.last_sign_in_at || null,
      created_at: user.created_at || null,
      user_metadata_role: user.user_metadata?.role || null,
      user_metadata_full_name: user.user_metadata?.full_name || null,
    }
  : null;

let profileById = null;
let profileByIdError = null;
if (user?.id) {
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, full_name, role, is_active, deactivated_at")
    .eq("id", user.id)
    .maybeSingle();
  profileById = data;
  profileByIdError = error?.message || null;
}

const { data: profileByEmail } = await admin
  .from("profiles")
  .select("id, email, full_name, role, is_active, deactivated_at")
  .ilike("email", email)
  .maybeSingle();

const { data: directorRow } = user?.id
  ? await admin.from("directors").select("id, email, full_name").eq("id", user.id).maybeSingle()
  : { data: null };

report.identity = {
  email,
  authFound: Boolean(user),
  byKnownIdFallback: byId,
  auth,
  profileById,
  profileByIdError,
  profileByEmail,
  idsMatch: user && profileById ? user.id === profileById.id : null,
  emailMatch:
    user && profileById
      ? String(user.email || "").toLowerCase() === String(profileById.email || "").toLowerCase()
      : null,
  directorRowExists: Boolean(directorRow),
};

if (password) {
  const { data, error } = await browserLike.auth.signInWithPassword({ email, password });
  report.directPasswordProbe = {
    usedAnonKeyAgainstSameHost: report.env.projectHost,
    authSuccess: Boolean(data?.user) && !error,
    userId: data?.user?.id || null,
    status: error?.status || null,
    code: error?.code || null,
    message: error?.message || null,
  };
  if (data?.session) {
    await browserLike.auth.signOut();
  }
} else {
  report.directPasswordProbe = {
    skipped: true,
    reason: "Set DIAG_LOGIN_PASSWORD to probe signInWithPassword (not printed).",
  };
}

if (listRecentApplicants) {
  const { data: recentProfiles, error: pErr } = await admin
    .from("profiles")
    .select("id, email, full_name, role, is_active, created_at")
    .eq("role", "applicant")
    .order("created_at", { ascending: false })
    .limit(8);
  const rows = [];
  for (const p of recentProfiles || []) {
    const { data: authData, error: aErr } = await admin.auth.admin.getUserById(p.id);
    const u = authData?.user;
    rows.push({
      email: p.email,
      profileId: p.id,
      created_at: p.created_at,
      is_active: p.is_active,
      authExists: Boolean(u),
      idsMatch: u ? u.id === p.id : false,
      email_confirmed_at: u?.email_confirmed_at || null,
      last_sign_in_at: u?.last_sign_in_at || null,
      banned_until: u?.banned_until || null,
      authLookupError: aErr?.message || null,
    });
  }
  report.recentApplicants = { error: pErr?.message || null, rows };
}

console.log(JSON.stringify(report, null, 2));
