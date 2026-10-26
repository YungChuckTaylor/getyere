# Canadian legal, bilingual UI and operational retention update

Published/revised 25 October 2026 (America/Toronto); legal revision effective
26 October 2026 (Toronto), subject to any existing-user notice/agreement requirement.
The publishing clock was checked in Toronto rather than inferred from Lagos's date.

## Confirmed operator

**Maple Dominion Consulting Inc.** — supplied explicitly by the owner.

1004 Kicking Horse Path
Oshawa, Ontario L1J 0B4
Canada

English and French legal/support documents identify the same contracting operator.
Privacy contact: **Privacy Officer / Responsable de la protection des renseignements
personnels**, support@getyere.com and the business address above. The actual assigned
person/delegation and mailbox staffing still need the operator's confirmation.
No incorporation jurisdiction, corporate number, telephone number or individual name
was invented. An Ontario mailing address was not treated as a governing-law instruction.

## Public documents

French is the first-visit language **only for the privacy, terms and support pages**.
The app defaults to English; its language choice is independent of these documents:
- https://getyere.com/privacy-policy (explicit French: `/fr/privacy-policy`)
- https://getyere.com/termsofuse (explicit French: `/fr/termsofuse`)
- https://getyere.com/support.html (explicit French: `/fr/support.html`)

English:
- https://getyere.com/en/privacy-policy
- https://getyere.com/en/termsofuse
- https://getyere.com/en/support.html

Terms and Conditions and Terms of Use remain the same agreement. Existing canonical
URLs and legacy redirects are preserved. An explicit `/en/` or `/fr/` URL chooses that
language; a saved English **legal-page** preference redirects an unprefixed legal URL to its English
version without showing the wrong-language document. French documents are real static
HTML, not a network translation widget, and remain French without JavaScript.

Canadian privacy/consumer protections, PIPEDA where applicable, provincial rights,
meaningful consent, access/correction, complaints, conditional deletion/portability,
incident duties and CASL remain covered. No Nigerian governing law, mandatory arbitration
or class-action waiver was reintroduced. Québec consumers' non-waivable liability and
French-language protections remain intact.

Terms §§3/13 identify amendable non-essential elements, 30-day advance written email
notice with only amendment/date/rights details, express agreement for essential changes,
and email refusal/cancellation without cost, penalty or cancellation indemnity within
at least the applicable 30-day post-effective window. A dated page is not proof of notice.
No notice campaign, billing cancellation integration or consent ledger was implemented.

Support distinguishes active cloud deletion from separately retained records, backups
and recipient/device copies; online is not proof that syncing completed. Instructions
include confirming recent edits before sign-out/clearing/reinstall, contact invitation
and revocation help, redacted bug reports and realistic non-emergency email availability.

## Adopted retention schedule — not a universal industry mandate

The owner asked for industry-standard schedules. There is no single period suitable for
all Canadian data categories. These purpose-based Yere business limits are implemented
in the application database; they are not represented as statutory periods or certification.

| Application record | Normal eligibility for cleanup | Purpose |
| --- | --- | --- |
| Notification delivery logs | 90 days from creation | Delivery troubleshooting and misuse investigation |
| Closed/resolved in-app support tickets | 12 months after last update, while still closed/resolved | Follow-up and complaint handling |
| Administrative audit logs | 24 months from creation | Administrative accountability, security and disputes |
| Expired/revoked admin sessions | 30 days after expiry/revocation, whichever is later | Session security investigation; does not extend access |
| Retention job aggregate counters | 90 days | Operational monitoring; no content, tokens or user identifiers |
| Active account/workspace | Until content/account deletion, subject to documented exceptions | Providing the account and selected features |

Migration **20261025234615_operational_retention.sql** is applied to production project
`nttspzlszckaxjsjdlqi`; the version was confirmed from migration history. The private
`yere-operational-retention` cron is active at `17 * * * *` UTC. It processes at most
5,000 eligible rows per category each hour, with an advisory lock to avoid overlapping
runs. Cleanup cannot start before **25 November 2026 00:00 Toronto / 05:00 UTC**. The
production verification returned `grace_period`; no production purge was performed.
The existing reminder-dispatch cron was not changed.

### Holds and audit protection

- Only database-owner administration can create/release `retention_holds`. It supports
  a row-specific or category-wide hold, documented reason and review date. Release is
  explicit; passing the review date does **not** silently drop a legal hold.
- Hold changes serialize with the retention lock. Operators must review due holds,
  document the continued need, or release them when the basis ends.
- Ordinary audit updates/deletes still fail. Only the owner-run retention function's
  scoped transaction may delete an unheld audit row older than 24 months, after the
  grace date. Browser roles and service_role cannot invoke this function or access
  hold/run tables. Application-role attempts to spoof the flag are tested and denied.
- The job does not delete reminders, accounts, attachments, contacts or reminder-fire
  delivery checkpoints. Account deletion remains a separate user-requested flow.
- Security/privacy-incident records and legal claims must satisfy their own legal
  minimums, event-based dates and holds; a generic 24-month audit TTL does not prove
  compliance with a breach-record duty. Counsel must review the schedule in context.

### Monitoring (database-owner operations only)

Check `cron.job` for the named job and `cron.job_run_details` for failures. Inspect
`retention_runs` for aggregate counts; a repeated batch count of 5,000 signals backlog.
Check `retention_holds` where `released_at IS NULL AND review_at <= now()` for review.
Do not put passwords, raw tokens or unnecessary personal content into hold reasons.
Do not grant application roles access to the maintenance function or hold tables.

### Not covered by database cleanup

Backup expiry is provider-plan/configuration dependent and remains **unverified**;
no invented 7/30/90-day maximum is published for backups. Provider-managed platform/auth
logs and separate support email are not controlled by this database job. Their actual
settings, necessity and legal obligations still need verification. Recipient/device
copies are not a purge guarantee. Production metadata confirms database region
`eu-west-1` (Ireland) and web function region `iad1` (United States), not an exhaustive
list of all processing locations or a completed transfer assessment.

Source review of `delete-account` still finds an attachment lookup cap of 5,000. Complete
removal for a larger account needs separate backend work and verification. No destructive
account-deletion test was performed. Recipient-owned reminders survive sender deletion;
notification references can be cleared while logs remain until normal cleanup/hold rules.

## Language module

- `public/language.js`, `language.css`, `locales/app.js`: shared local-only UI catalog,
  accessible selectors, English app default and French legal/support default,
  independent `Yere.appLanguage` / `Yere.legalLanguage` preferences, explicit document
  routes, `fr-CA`/`en-CA` dates and voice locale, and a small French date-grammar bridge.
- The former shared `Yere.language` key is ignored (not deleted), so an old default
  or legal-page choice cannot make the app open in French. Explicit new app choices
  still persist. Storage events are scoped to the corresponding preference key.
- `index.html` explicitly marks source-authored labels and attributes. Translation
  never walks arbitrary text, translates stored content, changes business enum values,
  rewrites form values or calls a remote translation service. Dynamic UI parameters
  are escaped; select options keep explicit machine values.
- Language switches do not re-render auth/editor forms or settings, preserving drafts.
  Catalog fallbacks leave unknown provider/technical errors unchanged. Admin console
  and owner release handbooks remain English, as do externally supplied announcements,
  support replies and user-authored content. The grammar bridge is not a general-purpose
  French NLP engine; users must still review proposed dates before saving.
- French/English legal pages use the same section IDs, accessibility/style, contact
  details, retention criteria and rights. Long French headings wrap on small screens.
- Service worker v3 precaches the language module/catalog for offline use and never
  falls back to the app shell for either language's legal/support routes.
- This is one shared PWA, not a replacement app. Web deployment updates the website;
  installed native apps need a new owner-produced native build to bundle these assets.
  No APK, TestFlight build or new backend project was generated.

To edit a marked UI label, update its English/French entries together in
`public/locales/app.js`; stable keys identify source-authored copy. `tests/language.test.js`
checks catalog coverage and interpolation parity. New enum choices must preserve their
machine `value`; never derive stored values from translated labels. Legal translations
are static HTML and should be reviewed together by Canadian/Québec-qualified counsel.

## Outstanding operational/legal work

1. Confirm the actual privacy officer and inbox staffing; process requests and
   cancellation notices in practice. No SLA or continuous-monitoring claim is made.
2. Determine Québec launch scope and have counsel review both languages. Publishing
   French pages/default French does **not** alone prove compliant French-first
   contracting, express English-language agreement, consent records or store flows.
3. Complete required transfer/privacy-impact assessments and processor agreements.
4. Verify provider backup/auth/platform-log settings, separate email retention and
   legal/incident records. Review holds and cleanup health; resolve large-account
   attachment deletion. No copy change certifies these operational duties.
5. Provide existing-user notices and obtain consent/agreement where required before
   treating material amendments as binding. A future effective date is not that notice.
6. Keep actual age handling, CASL consent/identification/unsubscribe, paid-feature
   disclosures and refund/cancellation mechanisms aligned with the documents.

## Verification

`npm test` (269 passing at implementation), production build, `git diff --check`;
isolated PostgreSQL tests for age thresholds, closed/open cases, grace period,
row/category holds, audit immutability and role restrictions. Production migration,
cron activation, grace response and RPC permissions were verified without user data.

Original implementation headless browser: French default, remembered English, live sign-in/tour/editor changes,
unchanged names/form/recurrence machine values, French date parsing, all six legal/support
language variants, 320/390/768/1440 widths, light/dark, print, language navigation and no
JavaScript errors. Native build verification was unavailable because this checkout has
no `.env.local` cloud configuration; the existing native no-demo guard is unchanged.

The scope correction restores English app markup/title/voice fallback, keeps French
legal/support defaults, and adds regression tests for independent preferences and
legacy-key isolation. Corrected-scope validation: **271 tests passing**, production
build and `git diff --check` passing. Headless browser passed English app startup with
the legacy French preference present, live switch/input preservation, independent
app/legal choices across navigation, all six document variants at 320–1440px, and no
JavaScript errors. No native build was generated for this web correction.

## Official references

- [PIPEDA scope](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda_brief/)
- [Meaningful consent](https://www.priv.gc.ca/en/privacy-topics/business-privacy/collecting-personal-information/consent/gl_omc_201805/)
- [Access requests](https://www.priv.gc.ca/en/privacy-topics/accessing-personal-information/obligations-for-organizations/02_05_d_54_ati_02/)
- [Breach duties](https://www.priv.gc.ca/en/privacy-topics/business-privacy/breaches-and-safeguards/privacy-breaches-at-your-business/gd_pb_201810/)
- [CASL](https://crtc.gc.ca/eng/com500/faq500.htm)
- [Québec private-sector privacy statute](https://www.legisquebec.gouv.qc.ca/en/document/cs/P-39.1)
- [Québec Consumer Protection Act, including §§10–11.4](https://www.legisquebec.gouv.qc.ca/en/document/cs/P-40.1)
- [Québec French-language contracting guidance](https://cdn-contenu.quebec.ca/cdn-contenu/adm/min/langue-francaise/fr/publications/emissaires/Guide_Contrats.pdf)
