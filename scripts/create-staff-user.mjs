#!/usr/bin/env node
/**
 * Developer-only staff account creator.
 *
 * Usage:
 *   node scripts/create-staff-user.mjs <role> "<Full Name>" <email> <password>
 *
 * Roles: assessor | panel | director
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Never import this into client code. Do not commit real passwords.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createStaffUserWithAdmin } from "../lib/staff-credentials.js";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (process.env[key]) continue;
    process.env[key] = rest.join("=").replace(/^['"]|['"]$/g, "");
  }
}

function usage() {
  console.error(`Usage:
  node scripts/create-staff-user.mjs <role> "<Full Name>" <email> <password>

Roles: assessor | panel | director
Applicant accounts must use public /applicant-register — not this script.`);
  process.exit(1);
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));

  const [role, fullName, email, password] = process.argv.slice(2);
  if (!role || !fullName || !email || !password) usage();

  if (role === "applicant") {
    console.error("Reject: use public applicant registration for applicants.");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  if (password.length < 12) {
    console.error("Password must be at least 12 characters.");
    process.exit(1);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await createStaffUserWithAdmin(admin, {
    role,
    email,
    full_name: fullName,
    password,
  });

  if (!result.ok) {
    console.error("Failed:", result.error);
    process.exit(1);
  }

  console.log("Created staff user:");
  console.log(`  role:  ${result.role}`);
  console.log(`  email: ${result.email}`);
  console.log(`  id:    ${result.userId}`);
  console.log(`  login: ${result.role === "director" ? "/director-login" : result.role === "panel" ? "/panel-login" : "/assessor-login"}`);
  console.log("(Password was set as provided; it is not printed again.)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
