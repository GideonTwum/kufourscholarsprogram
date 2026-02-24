# Director Portal — Implementation Plan

## Current State

### What Exists (but is currently blocked)
The director portal code already exists under `app/(dashboard)/director/` but is **inaccessible** because:

1. **Middleware** redirects all `/director` traffic to home (`/`)
2. **Login** sends directors to home (`/`) instead of `/director`
3. **Director registration** was removed from the public register page

### Existing Director Pages

| Route | Status | Notes |
|-------|--------|-------|
| `/director` | Exists | Dashboard home with quick actions (some links broken) |
| `/director/applications` | Complete | List applications with status filters |
| `/director/applications/[id]` | Complete | Review app, update status, view documents (signed URLs) |
| `/director/announcements` | Complete | List, create, delete announcements |
| `/director/announcements/new` | Complete | Create targeted or global announcements |
| `/director/messages` | Complete | Conversation list with applicants |
| `/director/messages/[id]` | Complete | Real-time chat |
| `/director/requests` | Exists | Lists "Scholar Requests" (scholars removed; applicants don't use this) |
| `/director/requests/[id]` | Exists | Request detail/response page |

### Dashboard Quick Actions (Broken Links)
The director home page links to routes that **do not exist**:
- `/director/scholars` — Scholars removed from scope
- `/director/materials` — Not implemented
- `/director/analytics` — Not implemented

---

## Scope: What Directors Need

Based on the current applicant flow and the existing director code:

1. **Access** — Directors must be able to log in and reach the portal
2. **Registration** — Directors need a way to create accounts (director code)
3. **Applications** — Review, filter, update status, view documents ✅ (already built)
4. **Announcements** — Create and manage announcements ✅ (already built)
5. **Messages** — Communicate with applicants ✅ (already built)
6. **Requests** — Currently scholar-only; applicants cannot create requests. Options: remove from nav, or add applicant "Contact / Request" later.

---

## Implementation Phases

### Phase 1: Enable Access (Required)
*Get directors into the portal.*

| Task | Description |
|------|-------------|
| 1.1 | **Update middleware** — Remove redirect from `/director` to `/`. Add `/director` to protected routes. Allow directors to reach `/director`; redirect non-directors away. |
| 1.2 | **Update login** — When `role === "director"`, redirect to `/director` instead of `/`. |
| 1.3 | **Director registration** — Add a separate director sign-up flow: either a dedicated page (e.g. `/director-signup`) or a role selector back on `/register` with director code verification. |
| 1.4 | **Entry point** — Decide how directors reach login: a "Director Login" link (e.g. on navbar, footer, or a dedicated director landing URL). |

### Phase 2: Fix Dashboard Home (Required)
*Make the director dashboard home accurate.*

| Task | Description |
|------|-------------|
| 2.1 | **Update quick actions** — Replace scholars/materials/analytics with links to Applications, Announcements, Messages. Add stats/counts if desired. |
| 2.2 | **Remove placeholder** — Remove or replace "Full director features coming soon" with a concise overview of what exists. |

### Phase 3: Requests (Optional / Defer)
*Align with current user roles.*

| Task | Description |
|------|-------------|
| 3.1 | **Option A** — Remove Requests from director nav (applicants don’t use it). |
| 3.2 | **Option B** — Keep it for future "applicant requests" or "general inquiries" feature. |
| 3.3 | **Option C** — Rename to "Inquiries" and wire it to a future applicant request form. |

### Phase 4: Polish & Error Handling (Recommended)
*Match the polish done on the applicant side.*

| Task | Description |
|------|-------------|
| 4.1 | **Director layout** — Add error handling for profile load; ensure role check. |
| 4.2 | **Applications list** — Add loading/error states. |
| 4.3 | **Announcements** — Add error handling for create/delete. |
| 4.4 | **Messages** — Update copy from "scholars" to "applicants" where relevant. |

---

## Recommended Approach

### Minimal (Fastest path to a working director portal)
1. **Phase 1** — Enable access (middleware, login, director registration).
2. **Phase 2** — Fix dashboard quick actions.
3. **Phase 3** — Remove or hide Requests for now (no applicants use it).

### Full (More complete experience)
1. Phases 1–4 above.
2. Consider a simple `/director-login` or "Director Login" link on the main site for directors.
3. Add basic stats on the dashboard (e.g. application counts by status).

---

## Auth Flow Summary

```
Director Registration (new flow):
  /register or /director-signup
  → Select "Director" + enter director code
  → Create account (role: director in metadata)
  → Sign out → Redirect to /login
  → Director logs in → Redirect to /director

Director Login (existing):
  /login
  → Email + password
  → Check profile.role
  → If director → /director
  → If applicant → /applicant
```

---

## Files to Modify (Phase 1 + 2)

| File | Change |
|------|--------|
| `middleware.js` | Remove `/director` redirect; add `/director` to protected; route directors to `/director` |
| `app/(auth)/login/page.js` | Director → `router.push("/director")` |
| `app/(auth)/register/page.js` | Add director option + director code, OR create `app/(auth)/director-signup/page.js` |
| `components/landing/Navbar.jsx` | Optionally add "Director Login" link (or keep hidden) |
| `app/(dashboard)/director/page.js` | Update quick actions; remove broken links; remove placeholder |

---

## Database / Backend

- **Director code** — Already exists: `DIRECTOR_REGISTRATION_CODE` in `.env.local` (e.g. `KUFOUR-DIRECTOR-2026`).
- **API** — `/api/verify-director-code` already exists.
- **RLS** — `supabase-migration-fix-profiles-rls.sql` (if run) fixes profiles recursion and allows applicants to read director profiles for Contact Director.
