# Auth, email & MFA — staging live test checklist

Use foundation-controlled mailboxes only. Do not record real passwords, TOTP secrets, or API keys in this file.

Applicant verification is an **email confirmation link** (not typed OTP).

## Applicant

- [ ] Register test applicant
- [ ] Receive confirmation email
- [ ] Click confirmation link → lands via `/auth/callback` → applicant portal
- [ ] Request password reset from `/forgot-password?portal=applicant`
- [ ] Confirm generic success message (no account enumeration)
- [ ] Receive reset email
- [ ] Open link → `/reset-password` → set new password
- [ ] Confirm old password fails
- [ ] Confirm new password works on `/login`
- [ ] Logout returns to `/login`

## Assessor

- [ ] Director creates assessor (AAL2 session)
- [ ] Login via `/assessor-login`
- [ ] Password reset via `/forgot-password?portal=assessor`
- [ ] Reset password; return to `/assessor-login`
- [ ] Deactivate account
- [ ] Confirm password reset does **not** reactivate
- [ ] Confirm login remains blocked
- [ ] Reactivate and login
- [ ] Logout returns to `/assessor-login`

## Panel

- [ ] Equivalent create → login → reset → deactivate → reactivate flow
- [ ] Logout returns to `/panel-login`

## Director

- [ ] Secondary test Director login with password
- [ ] Enroll TOTP at `/director/mfa-setup` (QR + one code)
- [ ] Sign out
- [ ] Login again → MFA challenge at `/director/mfa-challenge`
- [ ] Confirm AAL1 cannot call privileged Director APIs (`403 MFA_REQUIRED`)
- [ ] Confirm AAL2 can access `/director` and APIs
- [ ] Password reset; MFA still required afterward
- [ ] Deactivate secondary Director; login blocked
- [ ] Confirm last-active Director protection still enforced
- [ ] Open `/director/auth-health` — statuses only, no secrets

## Email matrix (record sent time / provider / inbox / spam / links / branding / HTML safety)

- [ ] Signup confirmation (Supabase Auth)
- [ ] Password reset (Supabase Auth)
- [ ] Stage 1 submitted (Resend)
- [ ] Stage 2 submitted (Resend)
- [ ] Interview batch assign / reschedule / cancel (Resend)
- [ ] Assessor assignment (Resend)
- [ ] Assessment completion (Resend)
- [ ] Acceptance / rejection (Resend)
- [ ] Panel broadcast (Resend) — HTML escaped, newlines → `<br/>`
- [ ] Director email test

## Abuse / cooldowns

- [ ] Forgot-password rapid repeats hit cooldown / provider limit
- [ ] Verify-email resend shows countdown
- [ ] MFA challenge rejects invalid codes without leaking secrets

## Migration

- [ ] Applied `202608060001_auth_mfa_lifecycle_hardening.sql` on staging
- [ ] Ran `docs/VERIFY-AUTH-LIFECYCLE-HARDENING.sql` checks (placeholders only)
