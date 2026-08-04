# Clerk auth and email migration plan

## Recommendation

Use a **hybrid transition**, not a full Clerk migration immediately before launch.

Keep Supabase Auth for the July 12 production launch unless there is enough time to complete a full Clerk identity migration in staging. The current application relies on Supabase Auth user IDs for:

- `profiles.id`
- `applications.user_id`
- storage folder ownership
- RLS policies
- middleware role routing
- director, panel, and assessor API authorization

Moving to Clerk changes the authenticated user identity source. That requires a careful `clerk_user_id -> profile_id` mapping and broad API/RLS updates. Clerk should be adopted deliberately, not as a last-minute email-only swap.

## What Clerk should own

Clerk should handle authentication-related email flows after migration:

- signup verification
- login verification / MFA if enabled
- password reset
- staff invitations for panel and assessor accounts
- account lifecycle emails

Clerk invitations are appropriate for staff invites because Clerk sends an invitation email with a unique link and can auto-verify the invited email address when the invite is accepted.

## What should stay on Resend

Application workflow emails should remain on Resend unless a dedicated Clerk-supported transactional workflow is intentionally built:

- Stage 1 submitted
- Stage 1 approved
- Stage 2 approved
- called for interview
- interview batch assigned
- accepted
- rejected
- director-to-panel broadcast

These are application events, not authentication events. Resend is the right provider for them in the current architecture.

## Required Clerk environment variables

Use the current Clerk variable names:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SIGNING_SECRET=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/applicant-register
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/applicant
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/applicant
```

Do not expose `CLERK_SECRET_KEY` or `CLERK_WEBHOOK_SIGNING_SECRET` to the browser.

## Migration phases

### Phase 1: Prepare identity mapping

Add Clerk identity columns without changing runtime auth:

- `profiles.clerk_user_id text unique`
- optional `profiles.auth_provider text default 'supabase'`

Backfill only after Clerk users exist.

### Phase 2: Add Clerk in staging

- Install `@clerk/nextjs`.
- Add `ClerkProvider`.
- Add `clerkMiddleware()` to `proxy.js`.
- Keep current Supabase Auth middleware until route parity is proven.
- Create a public Clerk webhook endpoint.
- Verify webhook signatures with `CLERK_WEBHOOK_SIGNING_SECRET`.
- On `user.created`, upsert `profiles` with `clerk_user_id`, email, full name, and default role.

### Phase 3: Update server authorization

Every server API that currently calls `supabase.auth.getUser()` must be updated to:

1. Get Clerk `userId`.
2. Resolve `profiles` by `clerk_user_id`.
3. Check role from `profiles`.
4. Use Supabase admin client only after role verification.

### Phase 4: RLS compatibility

Supabase RLS currently depends on `auth.uid()`. Clerk sessions do not automatically populate Supabase `auth.uid()`.

Choose one:

1. Keep server APIs as the data access boundary and use service role after Clerk role checks.
2. Configure Supabase JWT integration with Clerk so RLS can evaluate Clerk-authenticated users.

Option 1 is faster. Option 2 is cleaner but requires careful JWT claims work and testing.

### Phase 5: Move auth emails

After Clerk sign-in/sign-up/invites are live:

- Disable Supabase applicant email verification UI.
- Replace panel and assessor invite APIs with Clerk invitations.
- Keep Resend for application workflow notifications.

## Email event matrix

| Event | Provider target | Current provider | Required change |
|---|---|---|---|
| Applicant signup verification | Clerk after migration | Supabase Auth | Migrate with Clerk signup |
| Password reset | Clerk after migration | Supabase Auth | Migrate with Clerk auth |
| Panel invite | Clerk after migration | Supabase Auth invite | Replace invite API |
| Assessor invite | Clerk after migration | Supabase Auth invite | Replace invite API |
| Director signup/invite | Clerk after migration | Supabase/Auth custom route | Prefer invite-only Clerk staff flow |
| Stage 1 submitted | Resend | Resend | Keep |
| Stage 1 approved | Resend | Resend | Keep |
| Stage 2 approved | Resend | Resend | Keep |
| Called for interview | Resend | Resend | Keep |
| Interview batch assigned | Resend | Resend | Keep |
| Accepted | Resend | Resend | Keep |
| Rejected | Resend | Resend | Keep |
| Director-to-panel broadcast | Resend | Resend | Keep |

## Launch decision

For the July 12 launch, keep Supabase Auth unless a full Clerk staging migration is completed and role/RLS tests pass.

Recommended production path:

1. Launch with Supabase Auth + Resend.
2. Stabilize applicant/director/panel/assessor flows.
3. Migrate auth emails to Clerk in a separate Clerk-auth branch.
4. Cut over only after E2E tests pass for all roles.
