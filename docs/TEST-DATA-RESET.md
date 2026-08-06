# Test data reset (operational)

Destructive utility to wipe **workflow / test** data so you can run a fresh end-to-end test.

This is **not** a schema migration. It does not drop tables, RLS, triggers, functions, or indexes.

## Backup first

1. Supabase Dashboard → Project Settings → Database → take a backup / confirm PITR.
2. Prefer running against a **staging** project first.
3. Never run `--execute` on production without `PRODUCTION_RESET_CONFIRMATION` and a verified backup.

## Required environment

Set in the shell or `.env.local` (never commit secrets):

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (server only) |
| `RESET_CONFIRMATION` | Exactly `RESET_KSP_TEST_DATA` |
| `PRESERVE_DIRECTOR_EMAIL` | Email of an **active** Director to keep |

Production-like targets (`NEXT_PUBLIC_SITE_URL` contains `kufuorscholarapplication.com`, or `APP_ENV`/`VERCEL_ENV=production`) also require:

| Variable | Value |
|----------|--------|
| `PRODUCTION_RESET_CONFIRMATION` | Exactly `I_HAVE_BACKED_UP_KSP_PRODUCTION` |

Optional for full audit wipe:

| Variable | Value |
|----------|--------|
| `CLEAR_KSP_AUDIT_HISTORY` | Exactly `CLEAR_KSP_AUDIT_HISTORY` (with `--clear-audit-log`) |

## Commands

Dry run (default — **no deletions**):

```bash
# PowerShell
$env:RESET_CONFIRMATION="RESET_KSP_TEST_DATA"
$env:PRESERVE_DIRECTOR_EMAIL="director@example.com"
npm run reset:test-data -- --dry-run
```

Execute:

```bash
$env:RESET_CONFIRMATION="RESET_KSP_TEST_DATA"
$env:PRESERVE_DIRECTOR_EMAIL="director@example.com"
npm run reset:test-data -- --execute
```

On production-like env:

```bash
$env:PRODUCTION_RESET_CONFIRMATION="I_HAVE_BACKED_UP_KSP_PRODUCTION"
npm run reset:test-data -- --execute
```

### Flags

| Flag | Meaning |
|------|---------|
| `--dry-run` | Report only (default if `--execute` omitted) |
| `--execute` | Perform deletions |
| `--keep-assessors` | Do not delete assessor Auth/profiles |
| `--keep-panel` | Do not delete panel Auth/profiles |
| `--keep-scholars` | Keep `public.scholars` directory rows |
| `--clear-scholars` | Delete scholars rows (default when `--keep-scholars` omitted) |
| `--clear-audit-log` | Delete all `director_audit_events` (needs `CLEAR_KSP_AUDIT_HISTORY`) |
| `--yes` | Skip interactive typed confirmation (env confirmations still required) |

## What is deleted

- Workflow: applications, assessor assignments/assessments, interview evaluations/slots, notifications, email_logs, announcements, conversations/messages, requests, panel_members roster
- Optional: scholars rows
- Selective audit: workflow audit events (security/lifecycle actions preserved by default)
- Storage: objects under applicant user prefixes in buckets `applications` and `avatars`
- Auth users + profiles: applicant (and scholar), assessor, panel — unless kept by flags

## What is preserved

- At least the Director identified by `PRESERVE_DIRECTOR_EMAIL` (must be `role=director`, `is_active=true`)
- All other Directors (never deleted)
- `site_settings`
- Public CMS: `news_articles`, `events`, `projects`, `mentors`, `teams`, `scholar_videos`, `youtube_spotlights`
- Schema, RLS, triggers, functions, indexes, migration history
- Logos / public website static assets (not in applicant buckets)

## Storage cleanup

Applicant uploads use `{userId}/…` in the private `applications` bucket and `{userId}/…` under `avatars`. Mentors/CMS media buckets are not cleared.

## Emails

The script never calls Resend, Auth invite APIs, or workflow notification helpers.

## Recovery if the wrong environment was targeted

1. Stop further writes.
2. Restore from the Supabase backup / PITR taken before `--execute`.
3. Rotate service-role key if it may have been exposed in logs (the script does not print secrets).
4. Re-seed Directors with `scripts/manage-director-user.mjs` / `scripts/seed-test-accounts.mjs` only after restore validation.

## Post-reset SQL

Run `docs/VERIFY-EMPTY-TEST-DATABASE.sql` in the Supabase SQL Editor.
