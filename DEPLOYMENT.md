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
2. In **Authentication → Providers → Email**, enable email/password sign-up. For production, enable email confirmation and configure a verified custom SMTP provider; the built-in test mail service is not intended for production traffic.
3. In **Authentication → URL Configuration**, set the production Site URL (for example `https://getyere.app`) and add redirect URLs for local development, the production domain, and Vercel preview URLs. Keep the list limited to domains you control.
4. Apply the versioned schema in `supabase/migrations/`:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

   The migrations create profiles, reminders, contacts, custom lists, audit events, private attachment metadata, push subscriptions, rate-limit/security tables, RLS policies, the private `yere-attachments` bucket, and helper RPCs. The later invitation/delegated-controls migration automatically approves an accepted invitation and securely exposes only the recipient's list names to an approved contact creating a reminder. The recipient's reminder-review preference still controls whether each delegated reminder is added immediately or waits for review. Do not replace the migrations with client-side table creation.
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

### Supabase Edge Function secrets

Set server-side secrets in **Supabase → Edge Functions → Secrets** (or with `npx supabase secrets set NAME=value`). Never prefix a secret with `VITE_`, and never add the service-role key to Vercel or the browser bundle.

| Secret | Required? | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase-provided | Supabase project URL for Edge Functions. |
| `SUPABASE_ANON_KEY` | Supabase-provided | Validates caller sessions inside the functions. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase-provided, server only | Admin access used only after Edge Function authorization checks. |
| `PUBLIC_APP_URL` | Yes | Canonical HTTPS app origin used in secure invite and reminder links, e.g. `https://getyere.app`. |
| `YERE_CRON_SECRET` | Yes for scheduled delivery | Random secret shared with the pg_cron Vault entry. Generate with `openssl rand -hex 32`. |
| `RESEND_API_KEY` | For email invites/reminders | Resend API key for sending messages. |
| `RESEND_FROM_EMAIL` | For email invites/reminders | A sender identity verified with Resend, e.g. `Yere <reminders@your-domain.ng>`. |
| `TWILIO_ACCOUNT_SID` | For SMS invitations | Twilio account SID. |
| `TWILIO_AUTH_TOKEN` | For SMS invitations | Twilio auth token. |
| `TWILIO_FROM_NUMBER` | For SMS invitations | Twilio-enabled number in E.164 format. |
| `VAPID_PUBLIC_KEY` | For background web push | Public Web Push application-server key. It must match the browser value below. |
| `VAPID_PRIVATE_KEY` | For background web push | Private Web Push key; server only. |
| `VAPID_SUBJECT` | Recommended for web push | Contact URI, e.g. `mailto:hello@getyere.app`. |

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
| `VITE_PUBLIC_APP_URL` | Public, optional | `https://getyere.app`; used as the displayed canonical origin. |

The browser variables are embedded at build time. A change requires a new Vercel deployment. If Supabase variables are missing, Yere deliberately starts in local-demo mode and clearly warns that demo invitations are not safe to share. Nigeria holiday skipping includes fixed-date holidays and calculated Easter dates; Islamic-calendar dates are estimates and may differ from the Federal Government’s moon-sighting announcement, so adjust a recurrence when an official date is published.

### Server-only values

`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `YERE_CRON_SECRET`, and `PUBLIC_APP_URL` belong in Supabase Edge Function secrets only. Do **not** put them in `.env.local` with a `VITE_` prefix, Vercel browser variables, checked-in files, or client-side source.

## 4. Vercel and automatic GitHub deployment

1. In Vercel, choose **Add New → Project**, authorize the connected GitHub account, and import `YungChuckTaylor/getyere`.
2. Set the project root to the repository root. Use the **Vite** framework preset (or **Other** if the dashboard does not detect it).
3. Use the checked-in build settings:
   - Install command: `npm install`
   - Build command: `npm run build`
   - Output directory: `dist`
   - Development command: `npm run dev`
4. Add the four browser variables from the table above. Put the VAPID public key in the build environment if push will be enabled. Do not add a Supabase service-role key to Vercel.
5. In **Settings → Git**, set `main` as the Production Branch and leave Preview Deployments enabled. Vercel’s Git integration will create preview deployments for pull requests and production deployments for pushes/merges to `main`.
6. Verify **Deployments** shows a successful build after the first import. Push a harmless documentation change to a PR to confirm a preview deployment; merge it to the production branch to confirm an automatic production build. No GitHub Actions secret or manually copied deployment token is required.
7. To roll back, open **Deployments**, select the last known-good production deployment, and choose **Promote to Production** or use Vercel’s instant rollback control. Fix the branch and redeploy after the rollback.
8. Optional: add `getyere.app` (or the domain you control) under **Settings → Domains**, configure the DNS records Vercel provides, then update Supabase Auth URLs and `PUBLIC_APP_URL` to the final HTTPS origin.

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

- **Auth fails or redirects to the wrong place:** verify the project URL/key, email provider settings, Site URL, and exact allowed redirect URLs in Supabase Auth. Vercel preview domains must be allowed if you test sign-up there.
- **Cloud setup warning or empty signed-in workspace:** run `npx supabase db push`, confirm migrations are applied and RLS is enabled, then sign out/in. Check the browser console and Supabase API logs for table/RPC errors.
- **RLS/permission errors:** do not disable RLS as a workaround. Check that the matching `owner_id` policy and migration are present. Invite hashes, rate-limit buckets, and fire ledgers should remain inaccessible to anon/authenticated table queries.
- **Email invites do not send:** verify Resend API key, verified sender, domain DNS, and `RESEND_FROM_EMAIL` in Edge Function secrets. Review the `create-contact-invite` logs.
- **SMS invites do not send:** verify Twilio account SID, auth token, enabled sender number, recipient E.164 format, and account country/number permissions.
- **Push is permission-granted but no notification arrives:** install the PWA where required, check the browser subscription and `push_subscriptions` row, confirm public/private VAPID keys are a pair, confirm `VAPID_SUBJECT`, and inspect `test-notification`/`dispatch-reminders` logs. iOS push does not behave like a normal Safari tab.
- **Scheduled reminders do not fire:** check the cron job is enabled, Vault values match the `YERE_CRON_SECRET` Edge Function secret, `pg_net` is enabled, and reminders have an approved status and a Push/Email channel.
- **Vercel build fails:** check the Node version (20+), lockfile, `npm run build`, output directory `dist`, and that environment variables are set for the target environment. Public `VITE_*` changes require a new build.
- **PWA does not refresh after deployment:** check `/sw.js` is not cached, confirm the service worker activates, close existing installed windows once, and redeploy. Vite assets are content-hashed and safe to cache.
- **GitHub push does not deploy:** confirm the right GitHub repository is connected under Vercel → Settings → Git, `main` is the Production Branch, the commit reached the selected branch, and GitHub/Vercel integration has repository access.
- **Attachment upload fails:** confirm the private `yere-attachments` bucket and Storage RLS policies were created. Files are limited to 10 MB and accepted image/PDF/Word types.

## 7. Security checklist

- [ ] Supabase email confirmation and a production SMTP sender are configured.
- [ ] Every application table has RLS enabled; service-role access exists only inside Edge Functions.
- [ ] Invite codes and link tokens are hashed in Postgres, single-use, expire after 24 hours, and are rate-limited server-side.
- [ ] `contact_blocks` and workspace auto-suspension remain server-enforced.
- [ ] Attachments are in a private bucket with user-scoped object paths and signed download URLs.
- [ ] `YERE_CRON_SECRET` and Web Push private key are stored in Supabase secrets/Vault only.
- [ ] Vercel contains only public browser values; no service-role, provider, or VAPID private key.
- [ ] Production and preview Auth redirect URLs and `PUBLIC_APP_URL` match the intended HTTPS origins.
- [ ] Cron, Edge Function logs, and delivery failures are reviewed before enabling real reminders.
