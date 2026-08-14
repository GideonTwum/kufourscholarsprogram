#!/usr/bin/env node
/**
 * Developer-only Director lifecycle management.
 *
 * Usage:
 *   node scripts/manage-director-user.mjs list
 *   node scripts/manage-director-user.mjs create "<Full Name>" <email> <password>
 *   node scripts/manage-director-user.mjs deactivate <email-or-uuid>
 *   node scripts/manage-director-user.mjs reactivate <email-or-uuid>
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Never import into client code. Never permanently delete Directors with history.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createStaffUserWithAdmin } from "../lib/staff-credentials.js";
import {
  AUTH_BAN_LONG,
  AUTH_BAN_NONE,
  deactivateProfilePayload,
  reactivateProfilePayload,
} from "../lib/staff-lifecycle.js";

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
  node scripts/manage-director-user.mjs list
  node scripts/manage-director-user.mjs create "<Full Name>" <email> <password>
  node scripts/manage-director-user.mjs deactivate <email-or-uuid>
  node scripts/manage-director-user.mjs reactivate <email-or-uuid>`);
  process.exit(1);
}

async function resolveDirector(admin, key) {
  const byId = key.match(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );
  let q = admin.from("profiles").select("id, email, full_name, role, is_active").eq("role", "director");
  q = byId ? q.eq("id", key) : q.eq("email", key.trim().toLowerCase());
  const { data } = await q.maybeSingle();
  return data;
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd) usage();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (cmd === "list") {
    const { data, error } = await admin
      .from("profiles")
      .select("id, email, full_name, is_active, created_at")
      .eq("role", "director")
      .order("created_at", { ascending: true });
    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    console.table(
      (data || []).map((d) => ({
        id: d.id,
        email: d.email,
        name: d.full_name,
        active: d.is_active !== false,
      }))
    );
    return;
  }

  if (cmd === "create") {
    const [fullName, email, password] = args;
    if (!fullName || !email || !password) usage();
    const result = await createStaffUserWithAdmin(admin, {
      role: "director",
      email,
      full_name: fullName,
      password,
    });
    if (!result.ok) {
      console.error(result.error);
      process.exit(1);
    }
    console.log("Director created:", result.email, `id=${result.userId}`);
    console.log("projectHost:", new URL(url).hostname);
    if (result.passwordRepaired) {
      console.log("note: createUser password was repaired via updateUserById before success");
    }
    if (!result.passwordVerified) {
      console.warn("warning: NEXT_PUBLIC_SUPABASE_ANON_KEY missing; login was not verified");
    }
    return;
  }

  if (cmd === "deactivate" || cmd === "reactivate") {
    const key = args[0];
    if (!key) usage();
    const profile = await resolveDirector(admin, key);
    if (!profile) {
      console.error("Director not found");
      process.exit(1);
    }

    if (cmd === "deactivate") {
      const { count } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "director")
        .eq("is_active", true);
      if ((count || 0) <= 1 && profile.is_active !== false) {
        console.error("Refusing to deactivate the last active Director.");
        process.exit(1);
      }
      const { error } = await admin
        .from("profiles")
        .update(deactivateProfilePayload(null))
        .eq("id", profile.id);
      if (error) {
        console.error(error.message);
        process.exit(1);
      }
      await admin.auth.admin.updateUserById(profile.id, { ban_duration: AUTH_BAN_LONG });
      console.log("Deactivated:", profile.email);
      return;
    }

    const { error } = await admin
      .from("profiles")
      .update(reactivateProfilePayload())
      .eq("id", profile.id);
    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    await admin.auth.admin.updateUserById(profile.id, { ban_duration: AUTH_BAN_NONE });
    console.log("Reactivated:", profile.email);
    return;
  }

  usage();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
