# Administrator invitations

## Existing vs new accounts

Only an active super administrator, with an MFA-verified and registered admin session, can invite an administrator. Public signup never grants an admin role.

- **New or unconfirmed Auth account:** Supabase `inviteUserByEmail` sends the usual invitation confirmation email.
- **Existing confirmed Auth account:** reuse its user ID and call Supabase `resetPasswordForEmail` with `/admin-access?flow=invite`. This sends a secure password-setup link through the existing Auth email provider. The invitation does not create another account, change its password, or modify reminders. Recipients may sign in with their existing password, or choose one using the setup link (including accounts originally created through Google). Using the link to choose a password changes the password of the same Yere account.
- **Already an administrator, active or inactive:** reject the invitation without changing or reactivating the role. Use the existing roster controls for deliberate role/status changes; use Forgot password for password recovery.
- **Disabled/banned or ambiguous account:** reject without sending mail or granting access.

The UI prevents duplicate submissions. The server retains the five-invitations-per-hour limit, reason requirement, role allowlist and existing MFA enforcement.

## Database and deployment

Apply `supabase/migrations/20261019141922_admin_invite_existing_accounts.sql` **before** deploying `admin-admin-invite`:

- `lookup_admin_invite_target(text)` performs a narrow, service-role-only email lookup. It never exposes email enumeration to browser clients.
- `grant_admin_invitation(...)` requires an active super-admin actor and locks against concurrent role changes, refuses to overwrite any existing admin, and uses the existing atomic/audited `set_admin_role` function.
- Execute privilege is revoked from PUBLIC, anon and authenticated on both functions. Existing tables, reminders, contact-invite approval and administrator records are not rewritten.

The Edge Function still uses server environment variables; no secrets belong in source. Deploy with the existing CLI instructions in `DEPLOYMENT.md`, or produce a standalone entrypoint for a single-file deployment tool:

```sh
node_modules/.bin/esbuild supabase/functions/admin-admin-invite/index.ts \
  --bundle --platform=neutral --format=esm '--external:npm:*' \
  --legal-comments=none --outfile=.cache/admin-invite-deploy.js
```

Deploy this bundle as `admin-admin-invite`, preserving `verify_jwt: true`. It bundles the local shared helpers, not credentials; do not deploy the unbundled entrypoint alone via a single-file tool.

## Failure handling

Email delivery is attempted before the admin role is granted. A delivery failure does not grant administrator access. If role persistence fails after email delivery, the response explicitly reports this partial state rather than claiming success. Auth email delivery and database writes are not a single transaction; a setup email may already have been sent. Never delete an existing account or its data to recover from an invitation failure.

Expected conflicts and limits have explicit messages. Unexpected errors return a safe message with a reference; function logs record the reference, stage and error code, not raw SMTP/Auth/database error objects. Check Auth email logs/SMTP configuration for delivery failures. Supabase's built-in email provider can restrict recipients and rate-limit mail; production SMTP configuration remains necessary.

## Verification

- `tests/admin-invite.test.js` executes the actual Edge Function handler with mocked Auth/RPC boundaries for new, confirmed and unconfirmed users, existing/banned/ambiguous admins, concurrent conflicts, authorization, rate limits, email errors, missing migrations and partial failures.
- `tests/admin-invite-db.test.js` runs the actual migration and existing role/audit SQL in an isolated PGlite PostgreSQL database. It verifies service-only privileges, normalized lookup, grants/audits, actor/role/ban checks, and non-overwriting/re-activation protection. Fixtures never touch hosted Auth users.
- Run `npm test`, `npm run build` and `git diff --check`.
- Hosted deployment status and permissions can be checked without sending mail. End-to-end delivery/MFA setup still requires an authorized super admin to invite a real recipient and complete the email flow. Do not invent a production invitation or bypass an MFA session for testing.
