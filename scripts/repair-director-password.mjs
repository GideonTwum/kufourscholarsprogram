#!/usr/bin/env node
/**
 * Repair Director password when Auth user/profile exist but signInWithPassword fails.
 *
 * Usage:
 *   REPAIR_DIRECTOR_EMAIL=... REPAIR_DIRECTOR_PASSWORD=... node scripts/repair-director-password.mjs
 *
 * Never prints the password. Requires .env.local URL + anon + service_role.
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

loadEnvFile(resolve(process.cwd(), ".env.local"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const email = (process.env.REPAIR_DIRECTOR_EMAIL || "").trim().toLowerCase();
const password = process.env.REPAIR_DIRECTOR_PASSWORD || "";

if (!url || !anon || !service) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / ANON / SERVICE_ROLE");
  process.exit(1);
}
if (!email || !password || password.length < 12) {
  console.error("Set REPAIR_DIRECTOR_EMAIL and REPAIR_DIRECTOR_PASSWORD (12+ chars)");
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const browserLike = createClient(url, anon, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: profile, error: pErr } = await admin
  .from("profiles")
  .select("id, email, role, is_active")
  .eq("email", email)
  .maybeSingle();

if (pErr || !profile) {
  console.error("Profile not found for email");
  process.exit(1);
}
if (profile.role !== "director") {
  console.error(`Refusing: role is ${profile.role}, expected director`);
  process.exit(1);
}

const before = await browserLike.auth.signInWithPassword({ email, password });
const beforeOk = Boolean(before.data?.user) && !before.error;
if (before.data?.session) await browserLike.auth.signOut();

if (beforeOk) {
  console.log(
    JSON.stringify(
      {
        projectHost: new URL(url).hostname,
        email,
        userId: profile.id,
        alreadyWorks: true,
        action: "none",
      },
      null,
      2
    )
  );
  process.exit(0);
}

const { data: updated, error: updErr } = await admin.auth.admin.updateUserById(profile.id, {
  password,
  email_confirm: true,
});

if (updErr || !updated?.user) {
  console.error("Password update failed:", updErr?.message || "unknown");
  process.exit(1);
}

const after = await browserLike.auth.signInWithPassword({ email, password });
const afterOk = Boolean(after.data?.user) && !after.error;
if (after.data?.session) await browserLike.auth.signOut();

console.log(
  JSON.stringify(
    {
      projectHost: new URL(url).hostname,
      email,
      userId: profile.id,
      alreadyWorks: false,
      updateOk: true,
      loginWorksAfterRepair: afterOk,
      probeCode: after.error?.code || null,
      probeMessage: after.error?.message || null,
    },
    null,
    2
  )
);

process.exit(afterOk ? 0 : 1);
