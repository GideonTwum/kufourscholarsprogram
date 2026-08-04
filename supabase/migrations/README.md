# Database migrations

Files in this directory are ordered, forward-only production migrations. Apply them in filename order with the Supabase CLI or through a controlled deployment pipeline.

The SQL files currently stored in the repository root are legacy migration history. Their actual production application order has not been proven, so they must not be renamed or replayed automatically against an existing environment. Before creating a fresh environment:

1. Export the authoritative production schema with `supabase db dump --schema public`.
2. Review the dump for secrets and environment-specific data.
3. Commit the schema-only dump as a timestamped baseline migration.
4. Verify a clean database can be built from the baseline plus every later migration in this directory.

Current forward migrations:

- `202606210001_atomic_application_acceptance.sql`
- `202606210002_remove_director_password_hash.sql`
- `202606210003_director_signup_rate_limit.sql`
- `202607080001_assessor_workflow.sql`
- `202607240001_revised_portal_roles.sql` — **QUARANTINED (do not apply)**; launch role remains `director`
- `202608030001_production_hardening.sql` — signup lock, profile role protection, status CHECK, remap accidental administrator rows to director
- `202608030002_four_portal_roles.sql` — profiles.role CHECK for applicant|assessor|panel|director|scholar; fix accessor typo
- `202608030003_panel_account_lifecycle.sql` — shared `profiles.is_active` / deactivate fields; evaluation name/email snapshots; active-panel RLS helpers. Auth ban/delete remains in server Admin API (not SQL).
- `202608040001_assessor_account_lifecycle_and_governance.sql` — assessor lifecycle reuse; one active assignment per application; recommendation vocabulary; assessment FK SET NULL; active-assessor RLS. Assessors recommend only; Directors decide status.
- `202608040002_director_security_operations.sql` — `director_audit_events` append-only; interview slot status; announcement audience remap; director lifecycle fields reuse.
- `202608040003_profiles_self_read_rls.sql` — ensure users can SELECT own `profiles` row (fixes Director/staff login verification); `is_director()` SECURITY DEFINER + active-aware.
- `202608040004_cleanup_director_and_interview_rls.sql` — RLS cleanup (post-login recursion + production manual fixes): removes recursive Director RLS; standardizes Director policies on `public.is_director()`; adds `assessor_can_read_profile` / `panel_can_read_profile` SECURITY DEFINER helpers; fixes interview slot applicant visibility; aligns panel evaluation visibility; removes redundant Director read on evaluations; leaves `Group class roster sync` untouched. Verify: `docs/VERIFY-RLS-CLEANUP.sql`.

Launch canonical staff role: **`director`**. Do not apply administrator renames.
Public signup: **applicant only**. Assessor/panel/director accounts via director APIs or `scripts/create-staff-user.mjs` / `scripts/manage-director-user.mjs`.
Verify after apply: `docs/DIRECTOR-OPERATIONS-VERIFY.sql` and `docs/VERIFY-RLS-CLEANUP.sql`.
