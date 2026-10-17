# Google and Facebook sign-in

The existing Supabase project handles both social sign-up (first visit) and sign-in. Email/password remains available. The admin console remains password-only and invite-only; it does not gain public social sign-up.

## Required hosted configuration

App code alone cannot enable these providers. Configure them in the **existing** Supabase project's **Authentication → Sign In / Providers** settings:

1. **Google**: create/use a Web application OAuth client in Google Cloud, configure its consent screen and audience, and enter its Client ID and Client Secret into Supabase's Google provider settings. Use this authorized redirect URI:
   `https://nttspzlszckaxjsjdlqi.supabase.co/auth/v1/callback`
2. **Facebook**: create/use a Meta app with Facebook Login, add the same Supabase URL as a **Valid OAuth Redirect URI**, and enter the App ID and App Secret into Supabase's Facebook provider settings. Configure the app domains, privacy policy and data-deletion URL and switch the app to Live when ready. In development mode only app-role/test users can sign in. Ensure the email permission is available for the app's intended audience.
3. In **Authentication → URL Configuration**, allow:
   - `https://www.getyere.com/` and `https://www.getyere.com/**`
   - `https://getyere.com/` and `https://getyere.com/**`
   - `yere://auth/callback`
   - Any explicitly trusted development/preview origins you actually use.
4. Keep provider secrets in Supabase only. Do **not** add Google Client Secrets or Facebook App Secrets to `VITE_*`, GitHub public variables, app code, or the repository. No new database migration is required.

The provider callback is the **Supabase** URL above, not a Yere URL. Supabase subsequently returns the user to the web origin that started sign-in, or the native deep link. Returning web users to the same origin preserves the PKCE verifier even when the public configuration uses a different apex/www alias. Contact invitation tokens are preserved in the web return URL.

## Native behavior

Google and Facebook open in the system browser (`@capacitor/browser`), not the WebView. The shared Supabase JS client creates and exchanges the PKCE code, then the existing session synchronization updates the native client. The custom `yere://auth/callback` route is already registered in the Android and iOS projects. OAuth callbacks no longer incorrectly open the password-reset screen. A callback that launches a terminated app is also processed before sign-in.

Both native projects register the Browser plugin. Release through the existing configured native build/CI; never distribute the browser demo output as a native app. Existing Apple sign-in on iOS is retained.

## Password visibility

Sign-in, account creation, password recovery, and admin password forms get a keyboard-accessible eye button. Passwords start masked on each form render. The button toggles only the input type and accessible label/state, does not submit the form, and does not copy or persist the password.

## Acceptance checks after provider setup/deployment

- On web, try both Google and Facebook from **Sign in** and **Create account**, with a new user and a returning user. Both should open the same real cloud workspace, not demo content.
- Start from the canonical `www` origin and confirm the callback stays on `www`. Try an invitation link and confirm it is consumed after sign-in.
- Cancel/deny provider consent and verify an actionable error and working retry. A provider still disabled in Supabase should show an error, not create local content.
- On Android/iOS, check browser launch, app return, signed-in workspace and relaunch session restore. Also test returning to a terminated app. OAuth must not display “Choose a new password.”
- Tap the eye, type while visible, tap again, and submit. Test keyboard activation and screen-reader labels. Repeat for sign-up, reset and admin forms.

Automated coverage: `tests/auth-ui.test.js` covers routing to both providers, current-origin redirects, invitation preservation, native PKCE/browser exchange, config/provider errors, password visibility/accessibility and idempotent enhancement.

Live provider login requires project-owner configuration and a device/browser consent session; unit tests do not claim to verify hosted credentials or provider approval.
