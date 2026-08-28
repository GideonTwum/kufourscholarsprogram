# Confirm signup email template (production)

**This file documents a Supabase Dashboard setting.** Deploying the Next.js app does **not** update the hosted Auth email template. An operator must paste the template below.

## Why this change is required

The previous flow used PKCE `?code=` redirects to `/auth/callback` + `exchangeCodeForSession`. That requires the `code_verifier` cookie from the **same browser** that called `signUp`. Applicants who open Gmail on another device/browser/in-app WebView fail verification, stay unconfirmed, then see “Invalid email or password” on login.

The TokenHash flow uses `verifyOtp({ token_hash, type })` on `/auth/confirm` and works cross-browser.

## Supabase Dashboard steps

1. Open **Authentication → Email Templates → Confirm signup**
2. Replace the confirmation link with the HTML below (keep your branding/copy as needed)
3. Save
4. Confirm **Authentication → URL Configuration**:
   - **Site URL:** `https://www.kufuorscholarapplication.com` (or your canonical production origin — must match `NEXT_PUBLIC_SITE_URL`)
   - **Redirect URLs** include at least:
     - `https://www.kufuorscholarapplication.com/**`
     - `https://kufuorscholarapplication.com/**` (if apex is used)
     - `https://www.kufuorscholarapplication.com/auth/confirm`
     - `https://www.kufuorscholarapplication.com/auth/callback`

Note: Application `signUp` / resend `emailRedirectTo` uses the **Site URL origin** (allowlist-safe). The Confirm signup **email body** still links to `/auth/confirm` via TokenHash.
5. **Confirm email** remains **enabled**

## Exact confirmation link (paste into Confirm signup)

```html
<h2>Confirm your email</h2>
<p>Follow this link to verify your email for the Kufuor Scholars Program application portal:</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">
    Verify Email Address
  </a>
</p>
<p>If you did not create an account, you can ignore this email.</p>
```

Critical attributes:

- `token_hash={{ .TokenHash }}` — **required**
- `type=email` — **required** (app also accepts `signup`)
- Path: `/auth/confirm` — **required**

Do **not** use only `{{ .ConfirmationURL }}` for applicant signup if that resolves to a PKCE `code` redirect that depends on the signup browser.

## Optional: disable link tracking

Do not enable Resend/SMTP click-tracking that rewrites Auth confirmation URLs. Prefetch/scanners can also consume one-time links; if that happens, applicants should use **Resend verification email**.

## After deploy

Applicants who registered **before** the template change should use **Resend verification email** so they receive a fresh TokenHash link.
