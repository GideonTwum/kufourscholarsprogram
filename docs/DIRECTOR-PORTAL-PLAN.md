# Director portal status

## Current implementation

The director portal is enabled and protected by role-aware middleware. Directors have dedicated signup and login routes and are redirected to `/director` after authentication.

Implemented areas:

- Application review and status transitions
- Assessor invitations, assignment, and pre-interview assessment workflow
- Announcements
- Applicant messaging
- Interview scheduling
- Panel member management and invitations
- Scholars, projects, events, news, teams, and scholar videos
- Site settings and email diagnostics

`/director/materials` remains a placeholder feature. The legacy requests pages remain in the codebase but are not promoted from the dashboard because the applicant workflow does not currently create requests.

## Security and deployment requirements

- Director signup uses `DIRECTOR_SIGNUP_CODE`; generate a long random value per environment.
- Supabase Auth is the only password authority. Do not store an additional password hash.
- Signup attempts are throttled through the `consume_director_signup_attempt` database function.
- Application acceptance uses the `accept_application` database function so application and profile changes commit atomically.
- Apply every migration in `supabase/migrations` before deploying matching application code.

## Remaining work

1. Replace shared-code director signup with expiring, single-use invitations.
2. Add authenticated end-to-end tests for every role and critical workflow.
3. Decide whether to implement or remove materials and legacy requests.
4. Add structured audit logging for director and panel mutations.
5. Add production error monitoring and alerting for email failures.
