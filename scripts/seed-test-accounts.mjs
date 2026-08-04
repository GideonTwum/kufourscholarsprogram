import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const TEST_ACCOUNTS = [
  {
    role: "applicant",
    email: "ksp.test.applicant+20260714@gmail.com",
    full_name: "KSP Test Applicant",
  },
  {
    role: "director",
    email: "ksp.test.director+20260714@gmail.com",
    full_name: "KSP Test Director",
    phone: "+233000000001",
  },
  {
    role: "assessor",
    email: "ksp.test.assessor+20260714@gmail.com",
    full_name: "KSP Test Assessor",
  },
  {
    role: "panel",
    email: "ksp.test.panel+20260714@gmail.com",
    full_name: "KSP Test Panel Member",
  },
];

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

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function findUserByEmail(admin, email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data?.users?.find((item) => item.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (!data?.users || data.users.length < 100) return null;
  }
  return null;
}

async function upsertAuthUser(admin, account, password) {
  const existing = await findUserByEmail(admin, account.email);
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: {
        role: account.role,
        full_name: account.full_name,
      },
    });
    if (error) throw error;
    return { user: data.user, created: false };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: account.email,
    password,
    email_confirm: true,
    user_metadata: {
      role: account.role,
      full_name: account.full_name,
    },
  });
  if (error) throw error;
  return { user: data.user, created: true };
}

async function upsertProfile(admin, user, account) {
  const { error } = await admin.from("profiles").upsert(
    {
      id: user.id,
      email: account.email,
      full_name: account.full_name,
      role: account.role,
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

async function upsertDirectorRecord(admin, user, account) {
  if (account.role !== "director") return;

  const { error } = await admin.from("directors").upsert(
    {
      id: user.id,
      full_name: account.full_name,
      email: account.email,
      phone: account.phone,
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(
      `Director auth/profile created, but public.directors upsert failed: ${error.message}. ` +
        "If this mentions password_hash, run 202606210002_remove_director_password_hash.sql.",
    );
  }
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const password = requireEnv("SEED_TEST_PASSWORD");

  if (password.length < 12) {
    throw new Error("SEED_TEST_PASSWORD must be at least 12 characters.");
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const results = [];
  for (const account of TEST_ACCOUNTS) {
    const { user, created } = await upsertAuthUser(admin, account, password);
    await upsertProfile(admin, user, account);
    await upsertDirectorRecord(admin, user, account);
    results.push({ role: account.role, email: account.email, id: user.id, created });
  }

  console.table(results.map(({ role, email, created }) => ({ role, email, action: created ? "created" : "updated" })));
  console.log("Seeded test accounts successfully. Password was supplied via SEED_TEST_PASSWORD and was not printed.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
