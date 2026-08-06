#!/usr/bin/env node
/**
 * Operational test-data reset for Kufuor Scholars Program.
 *
 * DEFAULT: dry-run only. Pass --execute to delete.
 * Does NOT drop schema, RLS, triggers, migrations, or public CMS content.
 * Does NOT send email/notifications.
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   RESET_CONFIRMATION=RESET_KSP_TEST_DATA
 *   PRESERVE_DIRECTOR_EMAIL=<active director email>
 *
 * Production-like targets also require:
 *   PRODUCTION_RESET_CONFIRMATION=I_HAVE_BACKED_UP_KSP_PRODUCTION
 *
 * Optional:
 *   --keep-assessors  --keep-panel  --clear-audit-log  --clear-scholars
 *   --yes             skip interactive typed confirmation (still requires env confirmations)
 */

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const RESET_PHRASE = "RESET_KSP_TEST_DATA";
const PROD_PHRASE = "I_HAVE_BACKED_UP_KSP_PRODUCTION";
const CLEAR_AUDIT_PHRASE = "CLEAR_KSP_AUDIT_HISTORY";

/** Public CMS / config tables — never deleted by this script. */
const PRESERVED_TABLES = [
  "site_settings",
  "news_articles",
  "events",
  "projects",
  "mentors",
  "teams",
  "scholar_videos",
  "youtube_spotlights",
];

/**
 * Workflow tables to clear (existence checked live).
 * Order is children → parents for known FKs from migrations.
 */
const WORKFLOW_DELETE_ORDER = [
  "interview_evaluations",
  "application_assessments",
  "assessor_assignments",
  // interview_slots after nulling applications.interview_slot_id
  "messages",
  "conversation_members",
  "conversations",
  "notifications",
  "email_logs",
  "announcements",
  "requests",
  "applications",
  "panel_members",
];

const SECURITY_AUDIT_ACTIONS = new Set([
  "assessor.created",
  "assessor.deactivated",
  "assessor.reactivated",
  "assessor.deleted",
  "panel.created",
  "panel.deactivated",
  "panel.reactivated",
  "panel.deleted",
  "settings.updated",
  "panel_roster.created",
  "panel_roster.deleted",
]);

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    const key = trimmed.slice(0, eq).trim();
    if (!key || process.env[key]) continue;
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

function parseArgs(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  return {
    execute: flags.has("--execute"),
    dryRun: !flags.has("--execute") || flags.has("--dry-run"),
    keepAssessors: flags.has("--keep-assessors"),
    keepPanel: flags.has("--keep-panel"),
    clearAuditLog: flags.has("--clear-audit-log"),
    clearScholars: flags.has("--clear-scholars") || !flags.has("--keep-scholars"),
    yes: flags.has("--yes"),
  };
}

function isProductionLike() {
  const site = String(process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "");
  const appEnv = String(process.env.APP_ENV || "").toLowerCase();
  const vercelEnv = String(process.env.VERCEL_ENV || "").toLowerCase();
  if (appEnv === "production" || vercelEnv === "production") return true;
  if (/kufuorscholarapplication\.com/i.test(site)) return true;
  if (/scholars\.kufuorfoundation\.org/i.test(site) && !/localhost/i.test(site)) return true;
  return false;
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function createAdmin() {
  const url =
    process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url) throw new Error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function tableExists(admin, table) {
  const { error } = await admin.from(table).select("*", { count: "exact", head: true });
  if (!error) return true;
  const msg = String(error.message || "");
  const code = error.code || "";
  if (code === "PGRST205" || /could not find|does not exist|schema cache/i.test(msg)) {
    return false;
  }
  // Permission or other errors: treat as present but note
  console.warn(`  [warn] existence check for ${table}: ${code || msg}`);
  return true;
}

async function countRows(admin, table, filterFn) {
  let q = admin.from(table).select("*", { count: "exact", head: true });
  if (filterFn) q = filterFn(q);
  const { count, error } = await q;
  if (error) throw new Error(`count ${table}: ${error.message}`);
  return count ?? 0;
}

async function deleteAll(admin, table, { dryRun, label }) {
  const before = await countRows(admin, table);
  if (dryRun) {
    console.log(`  [dry-run] would delete ${before} row(s) from ${label || table}`);
    return { table, before, deleted: 0 };
  }
  if (before === 0) return { table, before, deleted: 0 };
  const { error } = await admin.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  // Some tables may use different PK — fallback noteq on a always-true filter
  if (error) {
    const { error: err2 } = await admin.from(table).delete().gte("created_at", "1970-01-01");
    if (err2) {
      // Last resort: fetch ids
      const { data, error: listErr } = await admin.from(table).select("id").limit(10000);
      if (listErr) throw new Error(`delete ${table}: ${error.message}; fallback ${err2.message}`);
      const ids = (data || []).map((r) => r.id).filter(Boolean);
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { error: delErr } = await admin.from(table).delete().in("id", chunk);
        if (delErr) throw new Error(`delete ${table} chunk: ${delErr.message}`);
      }
    }
  }
  const after = await countRows(admin, table);
  console.log(`  deleted ${before - after} row(s) from ${table} (remaining ${after})`);
  return { table, before, deleted: before - after, remaining: after };
}

async function listAllProfiles(admin) {
  const rows = [];
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, email, role, is_active, full_name")
      .range(from, from + page - 1);
    if (error) throw new Error(`profiles list: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < page) break;
    from += page;
  }
  return rows;
}

async function listAuthUsers(admin) {
  const users = [];
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    users.push(...(data?.users || []));
    if (!data?.users || data.users.length < 100) break;
  }
  return users;
}

async function resolvePreserveDirector(admin, email) {
  const normalized = email.trim().toLowerCase();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, email, role, is_active, full_name")
    .eq("email", normalized)
    .maybeSingle();
  if (error) throw new Error(`Director lookup: ${error.message}`);
  if (!profile) throw new Error(`PRESERVE_DIRECTOR_EMAIL not found in profiles: ${normalized}`);
  if (profile.role !== "director") {
    throw new Error(`Preserved account role is "${profile.role}", expected director`);
  }
  if (profile.is_active === false) {
    throw new Error(`Preserved Director is inactive (is_active=false). Aborting.`);
  }
  return profile;
}

async function discoverFkHints(admin) {
  // PostgREST cannot query information_schema; report static repo-derived plan + live existence.
  const known = [
    ...WORKFLOW_DELETE_ORDER,
    "interview_slots",
    "director_audit_events",
    "scholars",
    "profiles",
  ];
  const present = [];
  const missing = [];
  for (const t of known) {
    // eslint-disable-next-line no-await-in-loop
    if (await tableExists(admin, t)) present.push(t);
    else missing.push(t);
  }
  return { present, missing, preserved: PRESERVED_TABLES };
}

async function nullInterviewSlotIds(admin, dryRun) {
  if (!(await tableExists(admin, "applications"))) return { updated: 0 };
  const { count } = await admin
    .from("applications")
    .select("*", { count: "exact", head: true })
    .not("interview_slot_id", "is", null);
  const n = count ?? 0;
  if (dryRun) {
    console.log(`  [dry-run] would clear interview_slot_id on ${n} application(s)`);
    return { updated: 0, wouldUpdate: n };
  }
  if (n === 0) return { updated: 0 };
  const { error } = await admin
    .from("applications")
    .update({ interview_slot_id: null })
    .not("interview_slot_id", "is", null);
  if (error) throw new Error(`null interview_slot_id: ${error.message}`);
  console.log(`  cleared interview_slot_id on ~${n} application(s)`);
  return { updated: n };
}

async function clearAuditEvents(admin, { dryRun, clearAll }) {
  if (!(await tableExists(admin, "director_audit_events"))) {
    return { deleted: 0, preserved: 0 };
  }
  const total = await countRows(admin, "director_audit_events");
  if (clearAll) {
    if (dryRun) {
      console.log(`  [dry-run] would clear ALL ${total} director_audit_events`);
      return { deleted: 0, wouldDelete: total, preserved: 0 };
    }
    await deleteAll(admin, "director_audit_events", { dryRun: false, label: "director_audit_events" });
    return { deleted: total, preserved: 0 };
  }

  const { data, error } = await admin
    .from("director_audit_events")
    .select("id, action")
    .limit(10000);
  if (error) throw new Error(`audit list: ${error.message}`);
  const rows = data || [];
  const toDelete = rows.filter((r) => !SECURITY_AUDIT_ACTIONS.has(String(r.action || "")));
  const preserve = rows.length - toDelete.length;
  if (dryRun) {
    console.log(
      `  [dry-run] would delete ${toDelete.length} workflow audit row(s); preserve ${preserve} security/lifecycle`
    );
    return { deleted: 0, wouldDelete: toDelete.length, preserved: preserve };
  }
  for (let i = 0; i < toDelete.length; i += 200) {
    const chunk = toDelete.slice(i, i + 200).map((r) => r.id);
    const { error: delErr } = await admin.from("director_audit_events").delete().in("id", chunk);
    if (delErr) throw new Error(`audit delete: ${delErr.message}`);
  }
  console.log(`  deleted ${toDelete.length} workflow audit row(s); preserved ${preserve}`);
  return { deleted: toDelete.length, preserved: preserve };
}

async function listStorageUnderPrefixes(admin, bucket, prefixes) {
  const found = [];
  for (const prefix of prefixes) {
    const queue = [""];
    const seen = new Set();
    while (queue.length) {
      const path = queue.shift();
      const fullPrefix = path ? `${prefix}/${path}` : prefix;
      // eslint-disable-next-line no-await-in-loop
      const { data, error } = await admin.storage.from(bucket).list(fullPrefix || prefix, {
        limit: 1000,
        offset: 0,
      });
      if (error) {
        // prefix may not exist
        continue;
      }
      for (const item of data || []) {
        const rel = path ? `${path}/${item.name}` : item.name;
        const objectPath = `${prefix}/${rel}`.replace(/\/+/g, "/");
        if (item.id == null && item.metadata == null && !item.name?.includes(".")) {
          // likely folder
          if (!seen.has(objectPath)) {
            seen.add(objectPath);
            queue.push(rel);
          }
        } else {
          found.push(objectPath);
        }
      }
    }
  }
  return found;
}

async function cleanupApplicantStorage(admin, applicantIds, dryRun) {
  const report = { discovered: 0, deleted: 0, failures: [] };
  if (!applicantIds.length) return report;

  // applications bucket: {userId}/...
  let appObjects = [];
  try {
    appObjects = await listStorageUnderPrefixes(admin, "applications", applicantIds);
  } catch (e) {
    report.failures.push(`applications list: ${e.message}`);
  }

  // avatars: {userId}/avatar.*
  let avatarObjects = [];
  try {
    for (const id of applicantIds) {
      // eslint-disable-next-line no-await-in-loop
      const { data, error } = await admin.storage.from("avatars").list(id, { limit: 100 });
      if (error) continue;
      for (const item of data || []) {
        avatarObjects.push(`${id}/${item.name}`);
      }
    }
  } catch (e) {
    report.failures.push(`avatars list: ${e.message}`);
  }

  const all = [...appObjects, ...avatarObjects.map((p) => `avatars:${p}`)];
  report.discovered = appObjects.length + avatarObjects.length;
  console.log(
    `  storage: discovered ${appObjects.length} applications object(s), ${avatarObjects.length} avatar object(s)`
  );

  if (dryRun) {
    const sample = [...appObjects.slice(0, 15), ...avatarObjects.slice(0, 5)];
    for (const p of sample) console.log(`    [dry-run] ${p}`);
    if (all.length > 20) console.log(`    … ${all.length - 20} more`);
    return report;
  }

  for (let i = 0; i < appObjects.length; i += 50) {
    const chunk = appObjects.slice(i, i + 50);
    // eslint-disable-next-line no-await-in-loop
    const { error } = await admin.storage.from("applications").remove(chunk);
    if (error) report.failures.push(`applications remove: ${error.message}`);
    else report.deleted += chunk.length;
  }
  for (let i = 0; i < avatarObjects.length; i += 50) {
    const chunk = avatarObjects.slice(i, i + 50);
    // eslint-disable-next-line no-await-in-loop
    const { error } = await admin.storage.from("avatars").remove(chunk);
    if (error) report.failures.push(`avatars remove: ${error.message}`);
    else report.deleted += chunk.length;
  }
  return report;
}

async function deleteAuthUsers(admin, userIds, dryRun) {
  let deleted = 0;
  const failures = [];
  for (const id of userIds) {
    if (dryRun) {
      deleted += 1;
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) failures.push(`${id}: ${error.message}`);
    else deleted += 1;
  }
  return { deleted, failures };
}

async function promptConfirm(message, expected) {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(`${message}\n> `);
    return answer.trim() === expected;
  } finally {
    rl.close();
  }
}

async function gatherCounts(admin) {
  const counts = {};
  const tables = [
    "applications",
    "assessor_assignments",
    "application_assessments",
    "interview_evaluations",
    "interview_slots",
    "notifications",
    "email_logs",
    "director_audit_events",
    "announcements",
    "conversations",
    "conversation_members",
    "messages",
    "panel_members",
    "scholars",
    "requests",
    "site_settings",
  ];
  for (const t of tables) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await tableExists(admin, t))) {
      counts[t] = null;
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    counts[t] = await countRows(admin, t);
  }

  const profiles = await listAllProfiles(admin);
  counts.profiles_applicant = profiles.filter((p) => p.role === "applicant" || p.role === "scholar").length;
  counts.profiles_assessor = profiles.filter((p) => p.role === "assessor").length;
  counts.profiles_panel = profiles.filter((p) => p.role === "panel").length;
  counts.profiles_director = profiles.filter((p) => p.role === "director").length;
  counts.profiles_director_active = profiles.filter(
    (p) => p.role === "director" && p.is_active !== false
  ).length;

  return { counts, profiles };
}

function printBanner(productionLike) {
  console.log("\n============================================================");
  console.log(" KSP TEST DATA RESET");
  console.log("============================================================");
  if (productionLike) {
    console.log(" !!! PRODUCTION-LIKE TARGET DETECTED !!!");
    console.log(" Backup Supabase before --execute.");
    console.log("============================================================");
  }
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  const opts = parseArgs(process.argv.slice(2));

  // Force dry-run unless --execute
  if (!opts.execute) opts.dryRun = true;
  else opts.dryRun = false;

  const productionLike = isProductionLike();
  printBanner(productionLike);

  if (process.env.RESET_CONFIRMATION?.trim() !== RESET_PHRASE) {
    console.error(`Refusing: set RESET_CONFIRMATION=${RESET_PHRASE}`);
    process.exit(1);
  }
  const preserveEmail = requireEnv("PRESERVE_DIRECTOR_EMAIL");

  if (productionLike) {
    if (process.env.PRODUCTION_RESET_CONFIRMATION?.trim() !== PROD_PHRASE) {
      console.error(`Refusing production-like reset without PRODUCTION_RESET_CONFIRMATION=${PROD_PHRASE}`);
      process.exit(1);
    }
  }

  if (opts.clearAuditLog && process.env.CLEAR_KSP_AUDIT_HISTORY?.trim() !== CLEAR_AUDIT_PHRASE) {
    console.error(`Refusing --clear-audit-log without CLEAR_KSP_AUDIT_HISTORY=${CLEAR_AUDIT_PHRASE}`);
    process.exit(1);
  }

  const admin = createAdmin();
  console.log(`Mode: ${opts.dryRun ? "DRY-RUN (no deletions)" : "EXECUTE"}`);
  console.log(`Preserve Director: ${preserveEmail}`);
  console.log(`Keep assessors: ${opts.keepAssessors} | Keep panel: ${opts.keepPanel}`);
  console.log(`Clear scholars: ${opts.clearScholars} | Clear all audit: ${opts.clearAuditLog}`);

  const director = await resolvePreserveDirector(admin, preserveEmail);
  console.log(`\nPreserved Director OK: ${director.full_name || "(no name)"} <${director.email}> id=${director.id}`);

  const discovery = await discoverFkHints(admin);
  console.log("\nLive tables present:", discovery.present.join(", ") || "(none)");
  if (discovery.missing.length) {
    console.log("Known tables not found (skipped):", discovery.missing.join(", "));
  }
  console.log("Preserved CMS/config tables:", discovery.preserved.join(", "));

  console.log("\n--- Pre-reset counts ---");
  const { counts, profiles } = await gatherCounts(admin);
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k}: ${v === null ? "(missing)" : v}`);
  }

  const applicants = profiles.filter((p) => p.role === "applicant" || p.role === "scholar");
  const assessors = profiles.filter((p) => p.role === "assessor");
  const panel = profiles.filter((p) => p.role === "panel");
  const directors = profiles.filter((p) => p.role === "director");
  const activeDirectors = directors.filter((d) => d.is_active !== false);

  console.log("\n--- Role summary ---");
  console.log(`  Applicants: ${applicants.length}`);
  console.log(`  Assessors: ${assessors.length}`);
  console.log(`  Panel members (profiles): ${panel.length}`);
  console.log(`  Directors: ${directors.length} (active ${activeDirectors.length})`);

  if (activeDirectors.length < 1) {
    console.error("Abort: no active Director would remain.");
    process.exit(1);
  }
  if (!activeDirectors.some((d) => d.id === director.id)) {
    console.error("Abort: preserved Director is not in active director set.");
    process.exit(1);
  }

  const authUsers = await listAuthUsers(admin);
  const authById = new Map(authUsers.map((u) => [u.id, u]));

  const staffToDelete = [];
  if (!opts.keepAssessors) staffToDelete.push(...assessors);
  if (!opts.keepPanel) staffToDelete.push(...panel);
  const usersToDelete = [...applicants, ...staffToDelete].filter((p) => p.id !== director.id);

  // Never include directors
  const safeDeleteIds = usersToDelete
    .filter((p) => p.role !== "director")
    .map((p) => p.id);

  console.log(`\nAuth/profile users selected for removal: ${safeDeleteIds.length}`);
  console.log(`  (applicants ${applicants.length}, staff ${staffToDelete.length})`);

  if (!opts.dryRun && !opts.yes) {
    const ok = await promptConfirm(
      `Type ${RESET_PHRASE} to confirm irreversible deletion:`,
      RESET_PHRASE
    );
    if (!ok) {
      console.error("Confirmation mismatch. Aborted.");
      process.exit(1);
    }
  }

  console.log("\n--- Deletion plan (dependency order) ---");
  console.log("  1) interview_evaluations, application_assessments, assessor_assignments");
  console.log("  2) null applications.interview_slot_id → delete interview_slots");
  console.log("  3) messages, conversation_members, conversations");
  console.log("  4) notifications, email_logs, announcements, requests");
  console.log("  5) applications, panel_members");
  console.log("  6) optional scholars");
  console.log("  7) selective director_audit_events");
  console.log("  8) storage objects under applicant user ids (applications + avatars)");
  console.log("  9) Auth Admin deleteUser for applicants (+ staff unless kept)");
  console.log("  NEVER: site_settings, news, events, projects, mentors, teams, migrations, directors");

  const results = [];

  // Step 1–5 workflow tables
  for (const table of [
    "interview_evaluations",
    "application_assessments",
    "assessor_assignments",
  ]) {
    if (!(await tableExists(admin, table))) continue;
    results.push(await deleteAll(admin, table, { dryRun: opts.dryRun }));
  }

  await nullInterviewSlotIds(admin, opts.dryRun);
  if (await tableExists(admin, "interview_slots")) {
    results.push(await deleteAll(admin, "interview_slots", { dryRun: opts.dryRun }));
  }

  for (const table of [
    "messages",
    "conversation_members",
    "conversations",
    "notifications",
    "email_logs",
    "announcements",
  ]) {
    if (!(await tableExists(admin, table))) continue;
    results.push(await deleteAll(admin, table, { dryRun: opts.dryRun }));
  }

  if (await tableExists(admin, "requests")) {
    if (!opts.dryRun) {
      await admin.from("requests").update({ responded_by: null }).not("responded_by", "is", null);
    } else {
      console.log("  [dry-run] would null requests.responded_by");
    }
    results.push(await deleteAll(admin, "requests", { dryRun: opts.dryRun }));
  }

  if (await tableExists(admin, "applications")) {
    results.push(await deleteAll(admin, "applications", { dryRun: opts.dryRun }));
  }
  if (await tableExists(admin, "panel_members")) {
    results.push(await deleteAll(admin, "panel_members", { dryRun: opts.dryRun }));
  }

  if (opts.clearScholars && (await tableExists(admin, "scholars"))) {
    console.log("  clearing scholars directory rows (public directory content)");
    results.push(await deleteAll(admin, "scholars", { dryRun: opts.dryRun }));
  }

  const audit = await clearAuditEvents(admin, {
    dryRun: opts.dryRun,
    clearAll: opts.clearAuditLog,
  });

  // Storage before Auth delete (need applicant ids)
  const applicantIds = applicants.map((a) => a.id);
  console.log("\n--- Storage cleanup ---");
  const storage = await cleanupApplicantStorage(admin, applicantIds, opts.dryRun);

  console.log("\n--- Auth user deletion ---");
  if (opts.dryRun) {
    console.log(`  [dry-run] would deleteUser for ${safeDeleteIds.length} account(s)`);
    for (const id of safeDeleteIds.slice(0, 20)) {
      const p = profiles.find((x) => x.id === id);
      const au = authById.get(id);
      console.log(`    ${p?.role} ${p?.email || au?.email || id}`);
    }
    if (safeDeleteIds.length > 20) console.log(`    … ${safeDeleteIds.length - 20} more`);
  } else {
    const authResult = await deleteAuthUsers(admin, safeDeleteIds, false);
    console.log(`  deleted ${authResult.deleted} Auth user(s)`);
    if (authResult.failures.length) {
      console.warn("  Auth delete failures:");
      for (const f of authResult.failures.slice(0, 20)) console.warn(`    ${f}`);
    }
    // Remove orphan profiles if Auth delete did not cascade
    for (const id of safeDeleteIds) {
      // eslint-disable-next-line no-await-in-loop
      await admin.from("profiles").delete().eq("id", id).neq("role", "director");
    }
  }

  // Post verification
  console.log("\n--- Post-reset verification ---");
  const afterDirector = await resolvePreserveDirector(admin, preserveEmail);
  console.log(`  preserved Director still present: YES (${afterDirector.email})`);

  const after = await gatherCounts(admin);
  const checks = [
    ["applications", after.counts.applications === 0 || after.counts.applications === null],
    ["assessor_assignments", after.counts.assessor_assignments === 0 || after.counts.assessor_assignments === null],
    ["application_assessments", after.counts.application_assessments === 0 || after.counts.application_assessments === null],
    ["interview_evaluations", after.counts.interview_evaluations === 0 || after.counts.interview_evaluations === null],
    ["interview_slots", after.counts.interview_slots === 0 || after.counts.interview_slots === null],
    ["applicant profiles", after.counts.profiles_applicant === 0 || opts.dryRun],
    ["site_settings retained", (after.counts.site_settings ?? 0) > 0 || after.counts.site_settings === null],
  ];

  if (opts.dryRun) {
    console.log("  (dry-run: post counts unchanged; checks skipped for empties)");
  } else {
    for (const [label, ok] of checks) {
      console.log(`  ${ok ? "OK" : "FAIL"} ${label}`);
    }
  }

  console.log("\n--- Final summary ---");
  console.log(`  Mode: ${opts.dryRun ? "dry-run" : "executed"}`);
  console.log(`  Storage discovered: ${storage.discovered}, deleted: ${storage.deleted}`);
  if (storage.failures.length) console.log(`  Storage failures: ${storage.failures.length}`);
  console.log(`  Audit: deleted=${audit.deleted ?? audit.wouldDelete ?? 0}, preserved=${audit.preserved ?? 0}`);
  console.log("  Emails sent by this script: 0");
  console.log("\nDone. Run docs/VERIFY-EMPTY-TEST-DATABASE.sql in Supabase SQL Editor for DB-side checks.");
  if (opts.dryRun) {
    console.log("\nTo execute: npm run reset:test-data -- --execute");
  }
}

main().catch((err) => {
  console.error("\nReset aborted:", err.message || err);
  process.exit(1);
});
