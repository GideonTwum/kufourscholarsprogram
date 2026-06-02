# Auth email setup (Supabase)

Auth emails are **not** sent by `RESEND_API_KEY` in `.env.local`. They are sent by **Supabase Auth** when users sign up, verify email, or receive panel invites.

Transactional emails (application status, interviews, director test) use Resend via the Next.js app — see `.env.example` and `/director/email-tests`.

---

## What this app uses auth email for

| Flow | Code | Email sent? |
|------|------|-------------|
| Applicant registration | `app/(auth)/applicant-register/page.js` → `signUp()` | Yes, if **Confirm email** is enabled in Supabase |
| Resend verification | `app/(applicant)/applicant/verify-email/page.js` → `auth.resend({ type: 'signup' })` | Yes (same Supabase mailer) |
| Email confirmation link target | `app/auth/callback/route.js` | User lands after clicking link in email |
| Panel member invite | `app/api/panel/invite/route.js` → `inviteUserByEmail()` | Yes (Supabase “Invite user” template) |
| Director self-signup | `app/api/director/signup/route.js` → `createUser({ email_confirm: true })` | **No** — email is auto-confirmed |

Applicants are blocked from the portal until `email_confirmed_at` is set (`middleware.js`).

---

## Checklist (Supabase Dashboard)

Open your project → **Authentication**.

### 1. Enable email confirmation (applicants)

1. **Authentication** → **Providers** → **Email**
2. Turn **Confirm email** **ON** (recommended for production).
3. Save.

If this is off, signups may not send a confirmation email and applicants may access the portal without verifying.

### 2. URL configuration (required)

**Authentication** → **URL configuration**

| Setting | Local development | Production |
|---------|-------------------|------------|
| **Site URL** | `http://localhost:3000` | `https://your-production-domain.com` |
| **Redirect URLs** | Add both lines below | Add production URLs too |

**Redirect URLs to allow** (one per line):

```
http://localhost:3000/auth/callback
http://localhost:3000/**
https://your-production-domain.com/auth/callback
https://your-production-domain.com/**
```

The app registers applicants with:

`{origin}/auth/callback?next=/applicant`

If `/auth/callback` is not allowed, confirmation links will fail after the user clicks them.

Also set in your app env (Vercel / `.env.local`):

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Email templates (optional but recommended)

**Authentication** → **Email Templates**

Customize at least:

- **Confirm signup** — applicant verification
- **Invite user** — panel invite from director portal

You can use your program name and support contact. Links in templates use `{{ .ConfirmationURL }}` (Supabase default).

### 4. Rate limits

**Authentication** → **Rate limits**

Supabase limits how many auth emails can be sent per hour on the built-in mailer. For production traffic, use **custom SMTP** (step 5).

---

## Production: send auth mail through Resend (SMTP)

Use the **same Resend account** as transactional email, but configure SMTP **inside Supabase**, not in `.env.local`.

### Prerequisites

1. [Resend](https://resend.com) account and API key.
2. **Domain verified** in Resend (Dashboard → Domains).
3. Sender address on that domain, e.g. `noreply@yourdomain.com`.

### Supabase SMTP settings

**Project Settings** → **Authentication** → **SMTP Settings** (or **Authentication** → **Emails** → **SMTP** depending on dashboard version)

Enable custom SMTP and enter:

| Field | Value |
|-------|--------|
| **Host** | `smtp.resend.com` |
| **Port** | `465` (recommended) or `587` |
| **Username** | `resend` |
| **Password** | Your Resend API key (`re_...`) — same type as `RESEND_API_KEY` |
| **Sender email** | Address on verified domain, e.g. `noreply@yourdomain.com` |
| **Sender name** | `Kufuor Scholars Program` |

Resend docs: [Send with SMTP](https://resend.com/docs/send-with-smtp) · [Send with Supabase](https://resend.com/docs/send-with-supabase)

**Important:** The sender must use a **verified domain** in Resend. `onboarding@resend.dev` is for API testing only and is not suitable for auth mail to arbitrary applicants.

### After saving SMTP

1. Use **Send test email** in Supabase if available.
2. Register a **new test applicant** with a real inbox you control.
3. Confirm the message arrives and the link opens `.../auth/callback?...` and lands on `/applicant`.

---

## Two email systems (quick reference)

```
┌─────────────────────────────────────────────────────────────┐
│  SUPABASE AUTH EMAILS                                       │
│  • Signup confirmation                                      │
│  • Resend verification                                      │
│  • Panel invite                                             │
│  Configured in: Supabase Dashboard (SMTP optional)          │
│  NOT controlled by RESEND_API_KEY in Next.js alone          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  APP TRANSACTIONAL EMAILS (Resend API)                      │
│  • Stage 1 submitted / approved                             │
│  • Interview, accept, reject                                │
│  • Director → panel broadcast                             │
│  Configured in: .env.local / Vercel                         │
│    RESEND_API_KEY, EMAIL_FROM, NEXT_PUBLIC_SITE_URL         │
│  Test: /director/email-tests                                │
└─────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| No email after applicant signup | Confirm email off, or rate limit | Enable confirm email; check Auth logs; add SMTP |
| Link in email errors / “redirect not allowed” | Redirect URL missing | Add `/auth/callback` and site URL in Supabase |
| Panel invite never arrives | SMTP not set / spam | Configure Resend SMTP; check spam; Auth logs |
| Auth email works but status emails don’t | Resend app env | Set `RESEND_API_KEY` in `.env.local`; restart `npm run dev` |
| Only your email receives mail | Resend sandbox | Verify domain; set production `EMAIL_FROM` |
| Director can log in without verification | By design | Directors use `email_confirm: true` on create |

**Supabase logs:** Dashboard → **Logs** → filter **Auth** for send failures.

---

## Security notes

- Do not commit API keys. Use `.env.local` locally and Vercel/host secrets in production.
- Rotate any key that was pasted into `.env.example` or committed to git.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only; never expose it to the browser.

---

## Related files

- Applicant signup: `app/(auth)/applicant-register/page.js`
- Verify / resend: `app/(applicant)/applicant/verify-email/page.js`
- Auth callback: `app/auth/callback/route.js`
- Panel invite API: `app/api/panel/invite/route.js`
- Director signup (no auth email): `app/api/director/signup/route.js`
- Transactional email: `lib/email/send.js`, `.env.example`
