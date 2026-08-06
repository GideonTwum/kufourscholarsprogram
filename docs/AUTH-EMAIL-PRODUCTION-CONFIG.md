/**
 * Production auth & email configuration (no secrets).
 *
 * Companion live checklist: docs/AUTH-EMAIL-MFA-LIVE-TEST.md
 * Lifecycle SQL verify: docs/VERIFY-AUTH-LIFECYCLE-HARDENING.sql
 * In-app status: /director/auth-health (active Director + AAL2)
 */

# Auth & email production configuration

## Canonical Resend sender

`EMAIL_FROM` is the only runtime source of truth for transactional Resend sends.

**Expected production value:**

```text
Kufuor Scholars Program <noreply@kufuorscholarapplication.com>
```

Do not hardcode this address in application send paths. Set it in environment / secrets.

### Sender rules

| Environment | EMAIL_FROM | Behavior |
|-------------|------------|----------|
| Development / test (`NODE_ENV` ≠ `production`) | Set & valid | Use `EMAIL_FROM` |
| Development / test | Missing | Use sandbox `Kufuor Scholars Program <onboarding@resend.dev>` + warn |
| Production | Set & valid (not sandbox) | Use `EMAIL_FROM` |
| Production | Missing / invalid / sandbox | **Fail closed** — do not send (`EMAIL_FROM_MISSING` / `EMAIL_FROM_INVALID`) |

## Vercel environment variables

Set these in Vercel (Production + Preview as appropriate). Never commit real values.

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser/server anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Admin client (never `NEXT_PUBLIC_`) |
| `DIRECTOR_MFA_REQUIRED` | `true`/unset = enforce Director TOTP (AAL2); `false` = temporary password-only Director access for testing (never `NEXT_PUBLIC_`) |
| `RESEND_API_KEY` | Transactional email via Resend (Next.js direct send path) |
| `EMAIL_FROM` | Verified sender, e.g. `Kufuor Scholars Program <noreply@kufuorscholarapplication.com>` |
| `NEXT_PUBLIC_SITE_URL` | Canonical site origin, e.g. `https://www.example.com` (no trailing slash) |

## Supabase Edge Function secrets

The `send-email` Edge Function reads **its own** secrets. Vercel env vars are **not** automatically available to Edge.

Set the same logical configuration on the Edge Function:

| Secret | Required |
|--------|----------|
| `RESEND_API_KEY` | Yes — may be a different Resend key than Vercel, but must be allowed to send |
| `EMAIL_FROM` | Yes — same display identity as Vercel production |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes — authorize invokes |
| `ALLOW_RESEND_SANDBOX_FALLBACK` | Optional — set to `true` **only** for local Edge experiments. Default / unset = **no** sandbox fallback |

### Dashboard

Supabase Dashboard → Project Settings → Edge Functions → Secrets

Add `EMAIL_FROM` and `RESEND_API_KEY` (and service role if not already present).

### CLI (if you use Supabase CLI)

```bash
supabase secrets set EMAIL_FROM="Kufuor Scholars Program <noreply@kufuorscholarapplication.com>"
supabase secrets set RESEND_API_KEY="re_xxxxxxxx"
```

After changing the function source, redeploy:

```bash
supabase functions deploy send-email
```

## Supabase Auth dashboard

| Setting | Expected |
|---------|----------|
| Site URL | Same origin as `NEXT_PUBLIC_SITE_URL` |
| Redirect allowlist | Include `{SITE}/auth/callback` and production/staging origins |
| Confirm email | Enabled for applicant self-registration |
| Password recovery | Enabled; recovery redirects through `/auth/callback?next=/reset-password` |
| MFA (TOTP) | Enabled in Supabase Auth. App enforcement via `DIRECTOR_MFA_REQUIRED` (see below) |
| Rate limits | Keep Supabase defaults (or stricter); app adds best-effort cooldowns only |
| Custom SMTP | Optional; use if Auth emails (confirm / reset) must leave Supabase default mailer |

Auth SMTP is separate from the Next/Edge Resend API path. Do not confuse Auth SMTP password with `EMAIL_FROM`.

## Resend

| Check | Expected |
|-------|----------|
| Domain | `kufuorscholarapplication.com` verified (SPF/DKIM) |
| FROM | Matches `EMAIL_FROM` |
| Test mailbox | Use foundation-controlled addresses for staging |
| Delivery logs | Confirm message IDs after inbox tests |

## Application behavior notes

- Applicant verification uses a **confirmation email link**, not typed OTP and not SMS OTP.
- Director MFA remains **implemented** (`/director/mfa-setup`, `/director/mfa-challenge`, AAL2 helpers).
  Enforcement is controlled by server-side **`DIRECTOR_MFA_REQUIRED`** (not `NEXT_PUBLIC_*`):
  - `true` or unset → Directors must complete TOTP MFA (AAL2) before `/director` and privileged APIs.
  - `false` → temporary password-only Director access for local/staging (routes still exist; proxy redirects MFA pages to `/director`).
  - **Before production launch set `DIRECTOR_MFA_REQUIRED=true`.**
- Password reset uses `resetPasswordForEmail` → `/auth/callback` → `/reset-password`.
- Staff lifecycle fields (`role`, `class_name`, `is_active`, `deactivated_at`, `deactivated_by`) are writable only via **service_role** after migration `202608060001`.
- App-level forgot-password rate limiting is **best-effort** on serverless (per isolate). Supabase Auth limits remain authoritative.
- Turnstile is **not** integrated (P1). Documented as follow-up.
- Production never silently sends as `onboarding@resend.dev`.

## Emergency Director MFA recovery

There is **no public MFA reset**.

1. Foundation developer signs into the Supabase Dashboard for the project.
2. Authentication → Users → select the Director user.
3. Remove or reset MFA factors for that user (or disable MFA temporarily only if required for break-glass).
4. Director signs in with password, re-enrolls at `/director/mfa-setup`, then uses AAL2 normally.
5. Re-enable MFA project settings if temporarily changed.
6. Prefer a secondary active Director account before removing factors on the last Director.

Password reset does **not** bypass MFA and does **not** reactivate deactivated accounts.
