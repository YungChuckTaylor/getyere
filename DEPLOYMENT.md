# Yere deployment and service setup

Yere is a Vite-built, installable PWA. The browser uses the Supabase **publishable/anon key only**; authentication, RLS, private Storage, invitation delivery, web push, and minute-based reminder dispatch are backed by Supabase. When no Supabase browser variables are provided, the app opens in an explicitly labelled local demo mode.

## 1. Run locally

1. Install Node.js 20 or later.
2. Copy `.env.example` to `.env.local` and fill the four browser variables described below. Leave the `VITE_*` Supabase values blank to use the local demo.
3. Run:

   ```bash
   npm install
   npm run dev
   ```

4. Open the Vite URL shown in the terminal (normally `http://localhost:5173`). A localhost origin is considered secure for service workers, PWA install prompts, microphone access, and local notifications.
5. Verify a production build with `npm run build`. The deployable static files are written to `dist/`.

## 2. Create and configure Supabase

1. Create a Supabase project and keep its project URL, project reference, publishable/anon key, and service-role key in a secure password manager.
2. In **Authentication → Providers → Email**, enable email/password sign-up and email confirmation. Configure Resend as the custom SMTP provider and apply the branded confirmation template in **Authentication → Email Templates** (steps below). The built-in test mail service is not intended for production traffic.
3. In **Authentication → URL Configuration**, set the production **Site URL** to `https://getyere.com`. Add `https://getyere.com/**` as a redirect URL; keep localhost URLs only if you use local development. The exact legacy URL `https://getyere.vercel.app/**` may stay temporarily so already-sent links still work; `vercel.json` forwards that host to `getyere.com`. Do not allow every `*.vercel.app` host.
4. Apply the versioned schema in `supabase/migrations/`:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

   The migrations create profiles, reminders, contacts, custom lists, audit events, private attachment metadata, push subscriptions, rate-limit/security tables, RLS policies, the private `yere-attachments` bucket, and helper RPCs. The later invitation/delegated-controls migration automatically approves an accepted invitation and securely exposes only the recipient's list names to an approved contact creating a reminder. The recipient's reminder-review preference still controls whether each delegated reminder is added immediately or waits for review. The latest `202610140001_admin_backend.sql` migration creates the private admin roles/sessions/audit trail, settings, support tickets, and notification logs; it intentionally does not add direct cross-account RLS access for browser clients. Apply all migrations before deploying any functions that use these tables. Do not replace the migrations with client-side table creation.
5. Confirm **Database → Tables** has the Yere tables and that RLS is enabled. The service-only invite hashes, rate-limit buckets, and reminder-fire ledger intentionally have no browser policies. The public storage bucket must remain private.
6. Deploy the Edge Functions:

   ```bash
   npx supabase functions deploy create-contact-invite
   npx supabase functions deploy redeem-contact-invite
   npx supabase functions deploy revoke-contact-invite
   npx supabase functions deploy create-delegated-reminder
   npx supabase functions deploy test-notification
   npx supabase functions deploy dispatch-reminders
   ```

   `dispatch-reminders` intentionally has JWT verification disabled in `supabase/config.toml`; it verifies a separate high-entropy cron secret on every request. All other functions verify the caller’s Supabase JWT and re-check the user server-side. The delegated-reminder form lets an approved contact set the recipient's due date/time, recurrence, notes, link, list, reminder type, delivery channel, and cost. Private file attachments remain account-owner-only.

   Deploy the admin functions only after the admin migration is applied:

   ```bash
   for function in admin-me admin-session-create admin-session-revoke admin-overview admin-users-list admin-user-detail admin-user-action admin-reminders-list admin-reminder-detail admin-reminder-action admin-notification-list admin-support-list admin-support-update admin-audit-list admin-settings admin-admin-list admin-admin-invite admin-admin-role-update admin-admin-session-revoke; do
     npx supabase functions deploy "$function"
   done
   ```

   These functions keep Supabase JWT verification enabled and validate the user's admin role, active/revocable admin session, MFA level when required, and reason before privileged reads/writes. Do not set admin functions to `verify_jwt = false`; only the existing cron dispatcher uses that setting.

### Send Supabase Auth emails through Resend

Supabase Auth creates the secure confirmation token, while Resend delivers the message. This uses Resend SMTP; it does not expose a provider key to the browser. In the Supabase Dashboard:

1. Open **Authentication → SMTP Settings**, enable custom SMTP, and enter:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: a Resend API key with email-sending permission (the key is private; enter it only in the Supabase dashboard).
2. Set **Sender name** to `Yere` and **Sender email** to the same verified address used by `RESEND_FROM_EMAIL` in the Edge Function secrets. The sending domain must be verified in Resend.
3. Open **Authentication → Email Templates → Confirm signup**. Set the subject to `Confirm your Yere account` and paste the HTML from `supabase/email-templates/confirm-signup.html` into the message body. The template uses Supabase’s `{{ .ConfirmationURL }}` variable and loads Yere’s public icon from `https://getyere.com`.
4. Send a test sign-up and check the Resend email logs. The confirmation link should redirect to `getyere.com`.
5. Open **Authentication → Email Templates → Invite user**. Set the subject to `You're invited to Yere` and paste `supabase/email-templates/invite-user.html` as the body. `inviteUserByEmail` redirects administrators to `https://getyere.com/admin-access?flow=invite`; the template's `{{ .ConfirmationURL }}` is the secure Supabase confirmation URL. The invite callback lets the recipient choose a password before signing in. Test with an address you control.
6. Open **Authentication → Email Templates → Reset Password**. Set the subject to `Reset your Yere password` and paste `supabase/email-templates/reset-password.html` as the body. The admin sign-in screen's reset link redirects to `/admin-access?flow=recovery`, where the recipient sets a new password and completes TOTP if required.
7. In the Supabase Auth MFA settings, enable TOTP authenticator enrollment and verification. The local Supabase configuration in `supabase/config.toml` enables both. The hosted project must also allow TOTP; the Edge Functions require AAL2 for `admin` and `super_admin` roles. `support` and `read_only` do not require TOTP. Do not globally require AAL2 for ordinary Yere users unless that is a separate product decision.

Custom SMTP is the delivery provider for **all Supabase Auth emails** (including password reset and email-change messages), not just sign-up confirmations. Their content remains controlled by the corresponding Supabase Email Templates. Admin invitations and password resets use the Yere-branded templates above; regular invitation and reminder emails from Edge Functions continue to use the Resend API.

### Supabase Edge Function secrets

Set server-side secrets in **Supabase → Edge Functions → Secrets** (or with `npx supabase secrets set NAME=value`). Never prefix a secret with `VITE_`, and never add the service-role key to Vercel or the browser bundle.

| Secret | Required? | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase-provided | Supabase project URL for Edge Functions. |
| `SUPABASE_ANON_KEY` | Supabase-provided | Validates caller sessions inside the functions. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase-provided, server only | Admin access used only after Edge Function authorization checks. |
| `PUBLIC_APP_URL` | Yes | Canonical HTTPS app origin used in secure invite and reminder links, e.g. `https://getyere.com`. |
| `YERE_CRON_SECRET` | Yes for scheduled delivery | Random secret shared with the pg_cron Vault entry. Generate with `openssl rand -hex 32`. |
| `RESEND_API_KEY` | For Edge Function email invites/reminders | Resend API key for sending messages; Auth SMTP credentials are configured separately in the Supabase dashboard. |
| `RESEND_FROM_EMAIL` | For email invites/reminders | A sender identity verified with Resend, e.g. `Yere <reminders@your-domain.ng>`. |
| `TWILIO_ACCOUNT_SID` | For SMS invitations | Twilio account SID. |
| `TWILIO_AUTH_TOKEN` | For SMS invitations | Twilio auth token. |
| `TWILIO_FROM_NUMBER` | For SMS invitations | Twilio-enabled number in E.164 format. |
| `VAPID_PUBLIC_KEY` | For background web push | Public Web Push application-server key. It must match the browser value below. |
| `VAPID_PRIVATE_KEY` | For background web push | Private Web Push key; server only. |
| `VAPID_SUBJECT` | Recommended for web push | Contact URI, e.g. `mailto:hello@getyere.com`. |

Supabase automatically provides its project URL and keys to Edge Functions in hosted projects. Check **Edge Functions → Secrets** before adding duplicate values. The service-role key bypasses RLS; restrict it to these functions and rotate it if it is ever exposed.

### Generate Web Push keys

Generate a VAPID pair once and keep it stable for this app installation:

```bash
npx --yes web-push generate-vapid-keys
```

Store the private key as the Supabase secret `VAPID_PRIVATE_KEY`, the public key as the Supabase secret `VAPID_PUBLIC_KEY`, and also set the **same public key** as `VITE_VAPID_PUBLIC_KEY` in the browser build environment. A key mismatch prevents subscriptions or delivery. Never expose the private key.

### Per-minute reminder dispatch

The migration creates the idempotent `reminder_fires` ledger; the pg_cron job calls the Edge Function once per minute. After deploying the function and setting `YERE_CRON_SECRET`:

1. Open `supabase/schedule-reminders.sql.example` and replace `YOUR_PROJECT_REF` and the placeholder secret.
2. Run the SQL in the Supabase SQL editor. It stores the endpoint and cron secret in Vault, enables `pg_cron`/`pg_net`, and registers `yere-reminder-dispatch`.
3. Verify the job in **Database → Cron Jobs** and inspect **Edge Functions → dispatch-reminders → Logs** after its next minute tick.
4. Keep the cron secret in sync: changing the Edge Function secret requires updating the matching Vault secret. Do not put either value in a browser variable.

If your project does not expose Vault or the `pg_cron`/`pg_net` extensions, enable them in **Database → Extensions** first, then rerun the example SQL.

## 3. Environment variables

### Browser build (local and Vercel)

Set these in `.env.local` for local work and in **Vercel → Project → Settings → Environment Variables** for Production, Preview, and Development as appropriate:

| Variable | Exposure | Example |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Public | `https://YOUR_PROJECT_REF.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Public | Supabase publishable/anon key (never the service-role key). |
| `VITE_VAPID_PUBLIC_KEY` | Public, optional | Matching VAPID public key for push subscriptions. |
| `VITE_PUBLIC_APP_URL` | Public, canonical | `https://getyere.com`; used for sign-up confirmation and password-reset redirects. Set it in every Vercel environment. |

The browser variables are embedded at build time. A change requires a new Vercel deployment. If Supabase variables are missing, Yere deliberately starts in local-demo mode and clearly warns that demo invitations are not safe to share. Nigeria holiday skipping includes fixed-date holidays and calculated Easter dates; Islamic-calendar dates are estimates and may differ from the Federal Government’s moon-sighting announcement, so adjust a recurrence when an official date is published.

### Server-only values

For the Vercel Node admin guard/session/proxy routes, set `SUPABASE_URL` and `SUPABASE_ANON_KEY` as server-side environment variables; these are project identifiers/publishable credentials, never service-role secrets. The Edge Functions use Supabase-provided `SUPABASE_URL` and `SUPABASE_ANON_KEY` automatically. `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `YERE_CRON_SECRET`, and `PUBLIC_APP_URL` are server-side configuration. Put Edge Function values in **Supabase → Edge Functions → Secrets**; enter the Resend SMTP password separately in **Supabase → Authentication → SMTP Settings**. Do **not** put secrets in `.env.local` with a `VITE_` prefix, Vercel browser variables, checked-in files, or client-side source.

## 4. Vercel and automatic GitHub deployment

1. In Vercel, choose **Add New → Project**, authorize the connected GitHub account, and import `YungChuckTaylor/getyere`.
2. Set the project root to the repository root. Use the **Vite** framework preset (or **Other** if the dashboard does not detect it).
3. Use the checked-in build settings:
   - Install command: `npm install`
   - Build command: `npm run build`
   - Output directory: `dist`
   - Development command: `npm run dev`
4. Add the browser variables from the table above. Set `VITE_PUBLIC_APP_URL` to exactly `https://getyere.com` for Production, Preview, and Development. Put the VAPID public key in the build environment if push will be enabled. Also configure `SUPABASE_URL` and `SUPABASE_ANON_KEY` for Vercel's serverless admin guard/session/proxy routes (the project URL and publishable/anon key; not a service-role credential). The routes can fall back to the matching `VITE_*` values, but server-side variables are clearer. Never add `SUPABASE_SERVICE_ROLE_KEY` to Vercel.
5. In **Settings → Git**, set `main` as the Production Branch and leave Preview Deployments enabled. Vercel’s Git integration will create preview deployments for pull requests and production deployments for pushes/merges to `main`.
6. Verify **Deployments** shows a successful build after the first import. Push a harmless documentation change to a PR to confirm a preview deployment; merge it to the production branch to confirm an automatic production build. No GitHub Actions secret or manually copied deployment token is required.
7. To roll back, open **Deployments**, select the last known-good production deployment, and choose **Promote to Production** or use Vercel’s instant rollback control. Fix the branch and redeploy after the rollback.
8. In **Settings → Domains**, confirm `getyere.com` is verified, has HTTPS enabled, and is set as the Primary Domain. The checked-in Vercel host redirect forwards `getyere.vercel.app` requests to `https://getyere.com` while preserving invite query parameters.

`vercel.json` serves the Vite output with service-worker/manifest cache headers. Vercel redeploys only after Git integration is configured in the project dashboard; this repository file alone cannot authorize a Vercel project.

## 5. PWA and notification verification

Run the deployed app over HTTPS (or localhost for development), then verify:

1. `/manifest.webmanifest`, `/sw.js`, `/yere-mark.svg`, and the three PNG icons return successfully. The manifest starts in standalone mode with the dark theme color.
2. In Chrome/Edge DevTools → **Application**, confirm the manifest is installable and the service worker is activated. Use **Offline** in the Network panel and reload after the first visit; the app shell and compiled styles/scripts should still load.
3. On Android, install from the browser install prompt or browser menu. On iPhone/iPad, open the site in Safari, tap **Share → Add to Home Screen**, then open the installed icon. iOS web push requires a supported iOS/iPadOS version and an installed Home Screen web app.
4. Toggle the theme in the header and Settings. The first visit is dark; your explicit choice persists in local storage and the signed-in profile.
5. Enable push from Settings. Confirm browser permission, a row in `push_subscriptions`, and use **Send a test notification**. For server push, verify the VAPID public key is configured in both the Vercel build and Supabase secrets.
6. Create a test reminder due in the next few minutes with Push or Email selected. Confirm a `reminder_fires` row is created once, then inspect Edge Function logs and delivery status. Re-running cron must not duplicate the same reminder fire.
7. Test offline behavior, keyboard search (`/`), quick capture (`n`), swipe-to-snooze/complete on touch, and mobile bottom navigation at phone and tablet widths.

## 6. Troubleshooting

- **Auth fails or redirects to the wrong domain:** verify Supabase Auth Site URL is `https://getyere.com`, the allowed redirect includes `https://getyere.com/**`, Vercel has `VITE_PUBLIC_APP_URL=https://getyere.com`, and Supabase Edge Function Secrets has `PUBLIC_APP_URL=https://getyere.com`. Redeploy Vercel after changing its build variable.
- **Cloud setup warning or empty signed-in workspace:** run `npx supabase db push`, confirm migrations are applied and RLS is enabled, then sign out/in. Check the browser console and Supabase API logs for table/RPC errors.
- **RLS/permission errors:** do not disable RLS as a workaround. Check that the matching `owner_id` policy and migration are present. Invite hashes, rate-limit buckets, and fire ledgers should remain inaccessible to anon/authenticated table queries.
- **Sign-up confirmation is not delivered by Resend:** check Supabase **Authentication → SMTP Settings** for `smtp.resend.com`, port `465`, username `resend`, the private Resend API key, and a sender address verified in Resend. Check the Confirm signup template and Resend email logs.
- **Email invites do not send:** verify Resend API key, verified sender, domain DNS, and `RESEND_FROM_EMAIL` in Edge Function secrets. Review the `create-contact-invite` logs.
- **SMS invites do not send:** verify Twilio account SID, auth token, enabled sender number, recipient E.164 format, and account country/number permissions.
- **Push is permission-granted but no notification arrives:** install the PWA where required, check the browser subscription and `push_subscriptions` row, confirm public/private VAPID keys are a pair, confirm `VAPID_SUBJECT`, and inspect `test-notification`/`dispatch-reminders` logs. iOS push does not behave like a normal Safari tab.
- **Scheduled reminders do not fire:** check the cron job is enabled, Vault values match the `YERE_CRON_SECRET` Edge Function secret, `pg_net` is enabled, and reminders have an approved status and a Push/Email channel.
- **Vercel build fails:** check the Node version (20+), lockfile, `npm run build`, output directory `dist`, and that environment variables are set for the target environment. Public `VITE_*` changes require a new build.
- **PWA does not refresh after deployment:** check `/sw.js` is not cached, confirm the service worker activates, close existing installed windows once, and redeploy. Vite assets are content-hashed and safe to cache.
- **GitHub push does not deploy:** confirm the right GitHub repository is connected under Vercel → Settings → Git, `main` is the Production Branch, the commit reached the selected branch, and GitHub/Vercel integration has repository access.
- **Attachment upload fails:** confirm the private `yere-attachments` bucket and Storage RLS policies were created. Files are limited to 10 MB and accepted image/PDF/Word types.

## 7. Security checklist

- [ ] Supabase Auth custom SMTP uses Resend, and the branded Confirm signup template is saved.
- [ ] Every application table has RLS enabled; service-role access exists only inside Edge Functions.
- [ ] Invite codes and link tokens are hashed in Postgres, single-use, expire after 24 hours, and are rate-limited server-side.
- [ ] `contact_blocks` and workspace auto-suspension remain server-enforced.
- [ ] Attachments are in a private bucket with user-scoped object paths and signed download URLs.
- [ ] `YERE_CRON_SECRET` and Web Push private key are stored in Supabase secrets/Vault only.
- [ ] Vercel contains only public browser values; no service-role, provider, or VAPID private key.
- [ ] Supabase Auth Site URL, Vercel `VITE_PUBLIC_APP_URL`, and Edge Function `PUBLIC_APP_URL` use `https://getyere.com`.
- [ ] Cron, Edge Function logs, and delivery failures are reviewed before enabling real reminders.
- [ ] Admin backend migration and all admin Edge Functions are applied/deployed; Supabase TOTP enrollment and verification are enabled.
- [ ] First super administrator is provisioned from `supabase/admin-bootstrap.sql.example`; every later account is invited/role-managed through Admin access.
- [ ] Vercel admin guard routes use the project URL and anon/publishable key only; no service-role or provider secret is in Vercel/browser configuration.
- [ ] On a Vercel Preview, unauthenticated and non-admin `/admin` requests return HTTP `404`, while `/admin-access` is `noindex`.
- [ ] AAL2 is enforced for `admin`/`super_admin`; revocation, last-super-admin protection, append-only audit grants, and reason-gated reads/writes are verified.

## 8. Hidden admin console: provisioning, rollout, and incidents

This section describes the Vite + Vercel server-side guard and Supabase Edge Function design in this repository. It is a deployment checklist, not evidence that the hosted project has been configured or tested.

### Security boundary and route behavior

- The admin console has no public app navigation link. `robots.txt` disallows `/admin` and `/admin-access`; Vercel also sends `X-Robots-Tag: noindex, nofollow`. These are discovery controls only, not authorization.
- On Vercel, `/admin` and `/admin/*` rewrite to `api/admin-shell.js`. The server calls the session-validated `admin-me` Edge Function and serves the app shell only for an active admin session. Missing, invalid, expired, revoked, inactive, or under-privileged sessions receive an actual HTTP `404`. `/admin-access` is the intentionally public sign-in/invitation callback page; it is not a sign-up page.
- `api/admin-proxy.js` permits only the allow-listed admin Edge Functions. Cross-account user, reminder, support, audit, and settings operations go through those session-validated functions. Do not add broad client RLS policies to enable the admin UI.
- The browser's Supabase refresh session is scoped to tab `sessionStorage`; the server's `__Host-yere-admin-session` cookie is `HttpOnly; Secure; SameSite=Strict; Path=/`. The database stores a SHA-256 hash of the access token, not the raw cookie. Session rows expire after eight hours and can be revoked; the browser cookie follows the access token's one-hour lifetime and is renewed by Supabase Auth while the signed-in tab is active. Sign out revokes the server session and clears browser auth storage.
- The Vite development server does not execute Vercel serverless rewrites. Validate the real HTTP 404 on a Vercel Preview deployment, not only with `npm run dev`. Never expose a development server as a production admin endpoint.

### Bootstrap the first super administrator

1. Apply all Supabase migrations and deploy the admin Edge Functions before inviting administrators. Enable custom SMTP and configure the **Invite user** template. Set Supabase Auth's production Site URL to `https://getyere.com` and include that exact origin in the redirect allow-list.
2. Create the first administrator's Auth account. Use an owner-controlled email address; confirm it, and ensure the owner can sign in through the regular Yere Auth flow. This step creates an Auth identity only; it does not grant admin access.
3. In the Supabase SQL Editor, open `supabase/admin-bootstrap.sql.example`, replace the example email with that exact Auth account email, and run it once. The script inserts the first `super_admin` record and an immutable bootstrap audit event. Do not use the bootstrap script to provision later administrators; use **Admin access** so role changes are reason-logged. Keep at least one active super administrator at all times.
4. Confirm TOTP authenticator enrollment and verification are enabled in the hosted Supabase Auth MFA settings. `supabase/config.toml` carries the matching setting for local Supabase. `admin` and `super_admin` roles require an AAL2 TOTP session; the Edge Functions enforce this even if the UI is bypassed.
5. Visit `https://getyere.com/admin-access`, sign in with the bootstrap account, and enroll/verify a TOTP authenticator if prompted. The invitation link also returns to `/admin-access`. After a successful session, the browser navigates to `/admin`.
6. Use a normal, non-admin account and an unauthenticated browser to confirm `/admin` returns HTTP `404`; confirm `/admin-access` returns the sign-in page. Use the exact Vercel Preview/production origin you are testing (do not paste cookies or access tokens into shared terminals or tickets):

   ```bash
   APP_URL='https://YOUR-VERCEL-DEPLOYMENT-HOST'
   curl -sS -o /dev/null -w '%{http_code}\n' "$APP_URL/admin"
   curl -sS -o /dev/null -w '%{http_code}\n' "$APP_URL/admin-access"
   curl -sS "$APP_URL/robots.txt"
   ```

   The unauthenticated `/admin` request should print `404`; `/admin-access` should print `200`. A signed-in admin's `/admin` request should print `200`. Do not use the local Vite server for this check.

### Role matrix and everyday operations

| Role | Available access |
| --- | --- |
| `read_only` | Overview metrics only. |
| `support` | Overview, user/reminder inspection, notification logs, support tickets, and admin audit. Sensitive-content reads require a reason of at least eight characters. |
| `admin` | Support access plus account ban/unban, reminder edits, feature-flag and announcement management. Requires TOTP. Account/reminder deletion, role management, and global maintenance/app settings remain unavailable. |
| `super_admin` | All admin operations, including account/reminder deletion, admin invitations and role changes, session revocation, global app settings, and maintenance mode. Requires TOTP. |

- Add accounts only from **Admin access → Invite administrator**. The available invitation roles are `support`, `read_only`, and `admin`; a super administrator may promote a trusted invited account to `super_admin` after verifying its identity. The promoted account is redirected to `/admin-access` to enroll/verify TOTP before administrative requests continue. Admins cannot grant themselves privileges. Reasons are required for role, session, settings, support, and destructive operations; user/reminder content inspection also requires an audited view reason.
- The regular Users list excludes administrator identities. Auth user search uses Supabase's 100-user pages; the current search UI filters within each fetched page. User details include sensitive account/reminder/support content and are reason-gated. Attachment links are short-lived.
- User-owned support tickets can be submitted and read from **Settings → Contact Yere support**. Admin replies appear in the user's account. **Email delivery for support replies is not connected**; do not promise email notifications.
- The Settings page stores feature flags, announcements, maintenance state, and global app-setting JSON. Maintenance mode is wired into the regular app and blocks it while preserving admin access; active announcements are displayed in-app for their configured audience. Enabled flags are exposed through `window.YERE_PUBLIC_CONFIG.featureFlags`, but a flag has no effect until the corresponding app feature checks it. The generic `app_settings` values are stored for administration but are not currently consumed by the regular app. Announcements do not send email or push broadcasts. Test audience, start/end times, and public messaging with a test account before activating.
- The dashboard reports operational counts from profiles, reminders, invitations, and notification attempts. It does not yet include feature-usage analytics, crash reporting, or Vercel deployment health. **Vercel deployment/rollback controls are not integrated into this console**; use the Vercel dashboard under its own access controls. User search is page-limited, and support email delivery is not configured.

### Rollout sequence

1. Build and test the Vercel Preview deployment first. Apply this migration set to a non-production Supabase project if one is available, deploy the listed Edge Functions there, and verify sign-in, TOTP, role gating, audit writes, and 404 behavior using test accounts.
2. Before production migration, take/confirm a Supabase database backup and record the current Vercel production deployment. Apply migrations with `npx supabase db push`; deploy the existing app functions and all admin functions. Confirm Vercel has `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and the public build variables, but no service-role key. Confirm Edge Function secrets and Auth SMTP/MFA settings.
3. Bootstrap one super administrator and test the roles with separate accounts. Verify that unauthorized `/admin` requests return `404`, `/admin-access` is `noindex`, admin MFA is required, view reasons and writes reach the append-only audit log, and revoking a session prevents further access.
4. Only after those checks, invite the minimum required support/admin users and enable operational use. Review audit and notification logs regularly. Use Settings feature flags to stage optional app features; leave maintenance mode disabled unless needed.
5. Vercel can roll back the app/API deployment from its Deployments dashboard. Database schema changes are not automatically rolled back with Vercel; prefer a forward fix. Restore a database backup only under the project's recovery procedure after assessing data loss. Do not assume reverting the front-end also reverts Supabase changes.

### Incident response

1. **Suspected administrator compromise:** a super administrator should open **Admin access** and revoke every active session row for the affected account with a reason (the console revokes sessions individually), then deactivate or downgrade the account. Deactivation blocks all current admin requests; revoking each row also prevents old cookies from working if the account is later reactivated. The affected user should change their password and re-enroll TOTP from a clean device.
2. **Suspected session/token leak:** revoke the session in the Admin access table (or sign the account out), clear the affected browser tab/session, review the immutable Admin audit page for the token's activity, and check Vercel/Supabase function logs. Do not put raw access tokens, refresh tokens, cookie values, or service-role keys into the audit metadata or incident ticket.
3. **Suspected service-role or provider-key exposure:** rotate the affected Supabase/Resend/Twilio/VAPID/cron credentials in their source dashboards/secrets, update the matching Edge Function secrets and Vault values, redeploy/retest affected functions, and review logs. Never copy the service-role key to the browser or Vercel environment.
4. **Unexpected content change or exposure:** preserve the audit trail, identify the actor/action/reason/time, disable the affected feature flag or announcement, and use maintenance mode only if the regular service must be paused. A private-content view is recorded in `admin_audit_logs`; do not delete or edit audit rows.
5. **Last-super-admin protection:** the database blocks demoting or deactivating the last active super administrator. Before removing any super-admin, verify another active one exists and can sign in with TOTP. If no super administrator is reachable, use the Supabase project owner's controlled SQL recovery process with a second owner-approved account; do not disable the protection trigger or delete audit history.
6. Record incident timing, containment, affected accounts/data, key rotation, restoration steps, and follow-up actions in the organization's incident record. This repository does not automatically send incident alerts or support-reply emails.

### Current deployment status

The repository contains the Vercel guard, admin UI/Edge Functions, schema migration, support workflow, settings/announcement integration, and this runbook. Local tests and mock migration checks are not a substitute for applying the migration to the real Supabase project, checking the hosted Auth/MFA/email settings, or testing a deployed Vercel Preview. No production deployment or production validation is claimed here.
