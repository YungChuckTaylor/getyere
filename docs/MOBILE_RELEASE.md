# Yere mobile release pack

Bundle/package ID: `com.getyere.app`
Marketing version: `1.0`
Primary language: English
Primary category: Productivity
Secondary category: Lifestyle

## App Store / Play listing copy

**Name**
Yere

**iOS subtitle**
Remember the times, together

**Google Play short description**
Thoughtful reminders you can keep and share with people you trust.

**Promotional text**
Capture the why, choose when it returns, and let trusted people help with the reminders that matter.

**Full description**

Yere is a thoughtful reminder space for the moments, tasks, renewals, and people you do not want to lose track of.

Capture a reminder by typing or speaking naturally. Add the reason it matters, a helpful link, or a private attachment. Choose a one-time or adaptive schedule, skip weekends or Nigerian public holidays, and receive the reminder by push, email, or both.

With trusted contacts, people you approve can suggest or set reminders without seeing the rest of your workspace. You remain in control: require approval, revoke access, block a contact, and review your audit history.

Yere includes:

- natural-language and voice capture;
- recurring, adaptive, expiry, and renewal reminders;
- native notifications with Done, Snooze, and View actions;
- offline access and queued sync after your connection returns;
- private account sync across web, Android, and iOS;
- trusted-contact invitations and approval controls;
- private attachments, lists, calendar, search, and completion insights;
- dark and light themes.

Yere does not sell personal information, show third-party ads, or use the content of your notes to train an AI model.

**iOS keywords** (keep within App Store Connect's limit)
reminder,tasks,recurring,shared,contacts,snooze,renewal,planner,offline

**URLs**

- Marketing: `https://www.getyere.com`
- Support: `https://www.getyere.com/support.html`
- Privacy policy: `https://www.getyere.com/privacy.html`
- Account deletion information: `https://www.getyere.com/support.html#delete-account` (add that anchor before Play submission if the console requires a dedicated deep URL)

## App Review notes

Yere uses the existing responsive web experience inside a Capacitor native shell, with substantial native integration:

1. Native Supabase authentication stores/restores the mobile session and mirrors its JWT into the shared data layer.
2. Native APNs/FCM notifications work while the app is closed and include Done, Snooze, and View actions.
3. A private native Filesystem snapshot, network monitoring, and a queued-write flag let users view and edit while offline and sync on reconnect.
4. The app supports universal/custom links, Android system-back navigation, haptics, a native splash/icon, safe areas, and native status-bar behavior.
5. Account deletion is available in Settings → Account & data.
6. Microphone access is requested only after the user chooses voice capture. Raw audio is not intentionally retained by Yere.

**Suggested review path**

1. Sign in with the review account supplied in App Store Connect.
2. Create “Call Aunty tomorrow at 4pm” and save it.
3. Open Settings, turn on push, and tap Send a test notification.
4. Disable connectivity, edit/create a reminder, reconnect, and observe sync.
5. Open Trusted contacts to inspect invitation and approval controls.
6. Settings → Account & data contains privacy/support links and permanent account deletion.

Do not put review credentials in Git. Supply a functioning non-production reviewer account in the private App Review Information field. Ensure its email is already confirmed and that it contains no personal data.

## App Privacy / Data safety guidance

Answer from the production configuration, not only from this repository. Current expected declarations are:

| Data | Linked to user | Tracking | Purpose |
| --- | --- | --- | --- |
| Name and email | Yes | No | Account and app functionality |
| User ID | Yes | No | Authentication, security, sync |
| Reminder/notes/contact content | Yes | No | App functionality |
| User files/attachments | Yes | No | App functionality |
| Push device token | Yes | No | App functionality / notifications |
| Product interaction/completion history | Yes | No | App functionality / user-visible insights |
| Diagnostics collected by configured providers | Verify provider settings | No | App functionality / troubleshooting |

Yere declares no advertising, third-party advertising, cross-app tracking, or sale of data. Re-check Supabase, Vercel, Firebase, email/SMS, crash-reporting, and analytics settings before answering store questionnaires. `ios/App/App/PrivacyInfo.xcprivacy` must stay consistent with the answers.

## Screenshot plan

Capture real, populated-but-fictitious app screens with no personal data:

1. **My Day** — “Remember what matters”
2. **Quick capture** — natural-language reminder and voice button
3. **Reminder details** — why, link, recurrence, and delivery choice
4. **Trusted contacts** — “Remember together, safely”
5. **Calendar / recurring** — adaptive schedule
6. **Native notification** — Snooze, Done, View
7. **Offline state** — changes saved and queued
8. **Dark and light themes** — optional final frame

Provide every device class and pixel size App Store Connect currently requests. Avoid compositing device frames in screenshots where a store forbids them. For Play, include a phone feature graphic and at least two phone screenshots.

## Universal/app-link files

These files require values from the final signing accounts. Do not deploy placeholders.

### Apple `/.well-known/apple-app-site-association`

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appIDs": ["APPLE_TEAM_ID.com.getyere.app"],
        "components": [
          { "/": "/*", "comment": "Yere invite, auth, and reminder links" }
        ]
      }
    ]
  }
}
```

Serve as `application/json` over HTTPS with no extension and no redirect.

### Android `/.well-known/assetlinks.json`

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.getyere.app",
      "sha256_cert_fingerprints": ["PLAY_APP_SIGNING_SHA256_FINGERPRINT"]
    }
  }
]
```

Use the Play App Signing certificate fingerprint for store installs. Add the debug/release fingerprint only to the controlled test environment that needs it.

## Final release checklist

### Both platforms

- [ ] Production Supabase migrations and all Edge Functions are deployed.
- [ ] RLS remains enabled; no service-role/provider private key is in a client bundle.
- [ ] Production privacy/support pages are reachable over HTTPS.
- [ ] Sign-up, confirmation/recovery, sign-in, sign-out, and account deletion are tested.
- [ ] Offline create/edit/complete/reconnect behavior is tested with conflict expectations documented.
- [ ] Native push registration, test delivery, reminder delivery, tap, Done, Snooze, token refresh, and sign-out cleanup are tested.
- [ ] Invite, delegated reminder, block/revoke, attachment, theme, and accessibility paths are tested.
- [ ] Version/build numbers and release notes are updated.

### iOS

- [ ] Distribution profile contains Push, Associated Domains, and Sign in with Apple.
- [ ] Release APNs secret uses production and bundle topic `com.getyere.app`.
- [ ] 1024px icon has no alpha; launch art and all screenshots are approved.
- [ ] Privacy manifest and App Privacy answers match production behavior.
- [ ] Archive validates in Organizer and passes TestFlight smoke testing on a physical device.
- [ ] Reviewer account/instructions and export-compliance answers are supplied.

### Android

- [ ] `google-services.json` matches `com.getyere.app`.
- [ ] Release AAB is signed through the protected release/Play key path.
- [ ] Play App Signing fingerprint is in `assetlinks.json`.
- [ ] Data safety, account deletion, content rating, target audience, ads, and access declarations are complete.
- [ ] Closed testing requirement shown by this developer account is complete.
- [ ] Pre-launch report and physical-device notification tests pass.
