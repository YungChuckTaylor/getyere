# Super-admin password sign-in and iOS reminder email links

## Source changes and security trade-off

Owner requested password-only super-admin access. `_shared/admin.ts` now requires
MFA for `admin`, not `super_admin`. This intentionally reduces the protection of
the highest-privilege role. Strong unique passwords and restricted account access
remain important. No MFA factor is deleted, no role is granted, and Supabase MFA
is not disabled globally. Auth validation, active server-side role lookup, role
rank checks, token-bound non-revoked/unexpired admin sessions, rate limits, audit
logging, origin checks, and secure HttpOnly cookies remain enforced. Invitation
and recovery continue to use their existing guarded paths.

### Production Edge rollout (required)

Changing a shared source module does NOT update existing deployed Edge bundles.
Redeploy ALL 19 admin functions that embed it, not just admin-session-create.
The PowerShell script below also deploys the direct-link change in the reminder
dispatcher. It touches no tables, migrations, cron schedules, APNs settings,
notification-test endpoint, or unrelated functions.

On the owner/developer PC, in a clean reviewed checkout of this branch:

```powershell
git pull --ff-only
npx.cmd supabase login
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-admin-link-fixes.ps1
```

The login command opens the supported CLI authentication flow. Never paste its
access token into chat or Git. Review the script before running. Deployment is
sequential, so use a maintenance window; partial rollout can temporarily reject
password-only super-admin requests on functions still using the old policy.
Regular-admin MFA must remain required throughout. `supabase/config.toml`
preserves verify_jwt=true for admin functions and false for dispatch-reminders;
the latter still authenticates with the existing cron secret.

After deployment test an existing active super-admin's fresh email/password
login, dashboard reads and an authorized operation, logout/revocation, rejection
of a normal user, and regular-admin AAL1 rejection/AAL2 access. Do not delete
factors or disable project-wide MFA as a workaround.

## Universal Links

The app already declares `applinks:getyere.com` and `applinks:www.getyere.com`
and forwards cold/warm scene events to Capacitor. The Xcode project references
App.entitlements in both configurations. Verify the actual signed IPA/profile
also carries Associated Domains; source entitlements alone do not prove that.

New reminder emails use `https://www.getyere.com/?reminder=...` directly rather
than the apex 308 redirect. Other configured deployment origins remain unchanged.
No new domain, backend, or redirect/tracking service is introduced. Email links
only view a reminder; crafted action=done/snooze query parameters cannot trigger
mutations. Native links reject foreign hosts, userinfo, non-HTTPS web URLs, ports,
admin routes and malformed identifiers. The existing auth/data-ready queue and
owner-scoped reminder state still control navigation; a URL is not authorization.

### Public Apple identifier (required, not a private key)

Set the existing getyere Vercel project's PRODUCTION environment variable:

```
APPLE_APP_ID=<actual signed application-identifier>
```

The value must be the exact `application-identifier` from the signed app, e.g. the
real 10-character App ID prefix followed by `.com.getyere.app`. The prefix is
usually the Developer Team ID but legacy prefixes can differ. Obtain it from the
owner's signed app/profile or Apple identifier record. Do not invent it or use
the numeric App Store Connect ID, APNs Key ID, or a placeholder. This public
identifier is not an Apple password/API/private key. Do not retrieve private-key
values merely to learn this identifier.

The two public association paths rewrite to `api/apple-app-site-association.js`:
- `/.well-known/apple-app-site-association`
- `/apple-app-site-association`

Without a verified identifier the handler returns an explicit non-cacheable 503,
never a successful placeholder association. With it, GET/HEAD return JSON/200,
short cache headers and no Location header. Admin, API and legal pages are not
claimed. The service worker never substitutes cached HTML for these paths.

Deploy the reviewed commit to the EXISTING Vercel getyere project after setting
the variable. Keep the frontend's public Supabase variables intact. Do not deploy
to the similarly named yereapp or maple-dominion project.

### Apex redirect

Vercel's project-domain setting currently redirects all getyere.com requests to
www.getyere.com with 308. Application rewrites cannot override that domain-level
redirect. New emails deliberately use the directly served www hostname. To
verify BOTH declared hosts and support old apex email links, the owner must edit
getyere.com's existing Vercel domain entry to serve this same deployment rather
than redirect. Do not remove the domain or change DNS blindly. If retaining an
apex redirect is required, only www links can be relied upon after verification;
do not claim old apex links are fixed. Test each host with redirects disabled.

### Resend tracking (owner-controlled, required if enabled)

Official reference: https://resend.com/docs/dashboard/domains/tracking
Resend's domain-level click tracking rewrites HTML URLs through its tracking
subdomain. The send-email request in this repository has no supported per-link
tracking override. Do NOT add invented click_tracking fields to the email API
payload or assume an undocumented HTML attribute disables tracking.

Owner: Resend > Domains > the actual RESEND_FROM_EMAIL sending domain >
Configuration / tracking metrics: disable CLICK tracking for transactional Yere
emails. No change to sending DNS records or open tracking is necessary for app
link association. Inspect a newly delivered message's actual href: it must begin
`https://www.getyere.com/?reminder=` and not a tracking host. Old messages may
retain old tracking URLs. Email-client security wrappers/embedded browsers can
still affect behavior independently of the sender.

### Acceptance / release

- Probe GET and HEAD on association paths: 200 JSON, correct appID, no redirect,
  no authentication, and no HTML. Test invalid configuration returns 503.
- Verify Apple CDN association/caching and actual signed Associated Domains.
- Website-only association fixes may work for the already installed build if its
  entitlement/handler was correct; do not require a rebuild merely for a server
  variable. A new Codemagic/TestFlight build is needed for the new native URL
  validation code or any provisioning/entitlement corrections.
- Install the new build using the existing signing pipeline if needed. Do not
  uninstall an app with unsynced reminders merely to reset association caching.
- Tap a NEW reminder email in Apple Mail, then the user's actual Gmail client,
  with the app cold and warm; verify the correct reminder. Signed-out links must
  wait for login/data. Test wrong-account/missing reminder, no installed app web
  fallback, and admin links remaining in the browser.
- iOS may honor prior user browser choices and Apple CDN caching; typing a URL
  into Safari is not an equivalent Universal Link test. Do not promise every
  email client's embedded browser will automatically hand off to the app.

## Status discipline

A source push is not an Edge deployment, Vercel production promotion, or signed
app update. Report each separately. The public identifier, domain setting,
provider tracking, and actual iPhone acceptance require verified evidence.
