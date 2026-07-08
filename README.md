# Kufuor Scholars Program

Next.js 16 application for the Kufuor Scholars public website, applicant workflow, director administration, and panel review. Supabase provides authentication, PostgreSQL, storage, and realtime data.

## Local setup

Requirements: Node.js 22, npm, and a Supabase project.

1. Copy `.env.example` to `.env.local`.
2. Set the Supabase URL, anonymous key, service-role key, site URL, and a long random director signup code.
3. Apply the required SQL migrations from `supabase/migrations` in filename order.
4. Install dependencies with `npm ci`.
5. Start the app with `npm run dev`.

Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code or commit `.env.local`.

## Quality checks

- `npm test` runs isolated workflow and validation tests.
- `npm run build` creates the production build.
- `npm run check` runs both checks in sequence.

GitHub Actions runs tests and the production build for pushes to `main` and pull requests.

## Database changes

New production changes belong in `supabase/migrations` as ordered, forward-only SQL. The SQL files in the repository root are legacy history and are not a verified clean-database migration chain. See `supabase/migrations/README.md` before provisioning another environment.

The current release requires:

1. Atomic application acceptance RPC.
2. Removal of the redundant director password hash.
3. Database-backed director signup throttling.
4. Assessor assignment and application assessment tables.

Apply these migrations before deploying the matching application code.

## External production configuration

- Configure applicant confirmation and redirect URLs in Supabase Auth.
- Configure Supabase SMTP for auth and invitation emails.
- Configure Resend variables for application-status emails.
- Use a staging Supabase project for end-to-end release verification.

See `docs/AUTH-EMAIL-SETUP.md` for email configuration.
