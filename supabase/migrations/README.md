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
