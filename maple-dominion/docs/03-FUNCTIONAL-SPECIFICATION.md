# 3. Functional specification and content operations

**Status:** Phase 1 implemented as a standalone static site. Booking, CRM delivery, analytics and AI are not implemented. Owner approval remains required for proposed commercial terms and public launch.

## A. Architecture and boundaries

- Plain HTML, locally hosted CSS/fonts and ES modules; no application framework, build step, account system or new backend.
- `data.mjs`: company constants, pricing, diagnostic questions, recommendations, 10 Fix Library records and process.
- `engine.mjs`: deterministic scoring, engagement routing, search, whitelist-validated sharing, plain-text report generation, PDF writer and encoded email-draft creation.
- `app.mjs`: rendering, hash router, keyboard-accessible native controls, actions and local state.
- `server.py`: preview-only static server bound to `0.0.0.0:4190`, serving this folder rather than the parent repository.
- `assets/`: supplied full Maple logo, derived leaf crop, approved existing Yere logo, local fonts/licences. Cart Compare logo remains pending.
- Working diagnostic state is memory-only. No cookies/localStorage/sessionStorage, background submission, fetch API, analytics or external font request is added.
- Source lives only under `maple-dominion/`; root Yere application, dependencies, configuration and deployment files remain unchanged by this task.

## B. Tech Check inputs

Ten required, single-choice questions. No free-text business data is required to score.

| Input | Meaning | Role |
|---|---|---|
| Team | Solo, 2–10, 11–30, 31–100, >100 | Scope/fit, never score inflation |
| Headache | Repetition, disconnected tools, security, training, stalled project, ongoing decisions, active incident | Recommendation/triage only |
| Tool inventory | Current / partial / unknown | Weight 2 |
| Restore readiness | Tested / untested / sync-or-none / unknown | Weight 5 |
| MFA | All / some / none / unknown | Weight 5 |
| Payment-email verification | Trusted separate check / informal / none / unknown | Weight 3 |
| Shared files | Named managed access / mixed / open-shared-personal / unknown | Weight 3 |
| Record consistency | Reconciled / manual / conflicts / unknown | Weight 2 |
| AI boundaries | Approved / no client-data use / unclear / sensitive unapproved / unknown | Weight 3 |
| Budget | DIY / under CAD 1,000 / CAD 1,000–3,000 / above / unsure | Scope/route, never score inflation |

The full literal questions, helpers, options and fractional weights are in Deliverable 2 and `data.mjs`.

### Scoring rule

`attention = round(100 × Σ(answerFactor × questionWeight) / 23)`.

Safe control answer = 0. Partial factors vary with the question (0.5, 0.6, 0.65 or 0.7). No/unsafe/unknown = 1. The complete factor table is exported with the copy. Unknown means “check this”, not proof that a breach or failure exists.

- **0–29:** Keep the good habits going.
- **30–64:** A few useful gaps to close.
- **65–100:** Start with the basics this week.
- These are editorial attention bands, not statistically validated security probabilities or audit grades.
- Team size, headache and budget do not affect the score.
- Seven domain contributions are sorted descending; ties favour the larger control weight, then stable question order. Return exactly three known quick wins. If a selected win has no reported gap, label it **Keep this habit**, not a discovered problem.
- Invalid/missing/inherited answer values are rejected. UI choices are allowlisted; there is no inference from arbitrary strings.

### Results contract

Score + band; number of unknown controls; three priority identifiers/titles; actionable steps; bounded DIY time/cost allowances; matching library guide; DIY/service/external recommendation; planning date in UTC; unambiguous limitations. No score-gated upsell or email gate.

Time and cost estimates are allowances for a small initial sample, not a promise to fix an entire system. List tool costs separately from labour and actual consulting scopes. An active incident warning must not be buried by a low numeric score.

### PDF, print, checklists and sharing

- **PDF:** generated locally as an actual multipage `application/pdf` file; includes score, three wins, checklist, time/cost, recommendation and scope/price caveats. No server rendering/upload. The dependency-free PDF is ASCII text with valid object/xref offsets, conservative line wrapping and page numbers. It is not claimed to be a fully tagged accessible PDF; accessible HTML remains available.
- **Print:** printable results with commercial caveats preserved and contact forms/navigation removed.
- **Checklist:** per-fix ungated `.txt` template, plus interactive browser checkboxes on results. Checkmarks are not stored; the PDF provides the reusable checklist, not a persisted task manager.
- **Share:** URL fragment schema `v=1&s={0..100}&w={three-known-domain-ids}&p={known-service-id|diy|external}&d={valid-ISO-date}`.
- Exactly five recognised parameters; bounded length; known IDs; three unique wins; finite integer score; valid date; known version. Reject unknown or malformed content safely. No executable HTML is constructed from raw query text.
- Shared snapshots contain no raw answers, contact details, free text or secrets. The base is origin + pathname, not arbitrary query parameters. Do not copy preview access tokens.
- Anyone with a link can read and edit its summary; no signature, private-access claim or authenticity guarantee. The original unknown count and maintenance status cannot always be reconstructed; shared reports disclose that original answers are absent.
- Preview links depend on preview access. Public, durable sharing requires deployment to an approved public host.

## C. Recommendation engine and engagement picker

The dedicated picker accepts team size, headache/problem and urgency. The diagnostic additionally supplies budget. Both call the same `recommend()` function.

| Precedence | Condition | Output |
|---|---|---|
| 1 | Possible active compromise/fraud | External containment/provider/bank referral; no package quote |
| 2 | More than 100 people | Requirements/fit review; no package or start date assumed |
| 3 | DIY budget | Free checklist and Fix Library; no required paid service |
| 4 | Under CAD 1,000 | Proposed Tune-Up, not an over-budget implementation promise |
| 5 | Stalled project | Project Rescue assessment |
| 6 | Ongoing decisions | Fractional Tech Lead |
| 7 | Repetition, tools, training, website or data | Bounded Fix Sprint |
| 8 | Other/uncertain security basics | Tech Tune-Up |

31–100 staff adds an explicit scope-confirmation warning. “Need help today” never fabricates a same-day slot; recommend an existing support provider if the business cannot wait. “This week” remains subject to availability. Turnaround is a planning window after agreed access, scope and availability—not an SLA.

Every service recommendation includes its range/period, turnaround, included and excluded work, scope boundary and a written-scope enquiry. There is no booking payment, quote acceptance or automatic contract.

## D. Fix Library schema and publishing

Each record requires:

```text
id / category / title / short problem statement
symptoms[] / immediate action / steps[]
cost allowance with currency, assumptions and exclusions
when to call / when to use a specialist
checklist or template fields[]
optional provider reference URL + descriptive label
editorial review date / urgent flag when applicable
```

Ten complete initial entries are implemented; Deliverable 2 contains publishable copy. Search is local, case-insensitive token matching against titles, short descriptions, categories and symptoms. Every token must match; category is an additional filter. No-results state offers reset and a human question route. This is search, not semantic AI.

Review provider-dependent instructions before publishing and when material features change. Treat AI/privacy, fraud and accounting guidance as bounded operational information, not legal, security or accounting certification. Never ask a visitor to upload customer data to demonstrate a problem.

## E. Products and logos

**Placement:** homepage after philosophy/process; dedicated products page in primary navigation; optional future product-specific pages. This positions owned products as evidence of building, not unrelated projects.

**Yere:** approved supplied existing logo, no replacement artwork; tagline exactly **“Remember the times, together!”**; description: interactive reminder app to capture/remember moments and tasks; confirmed `https://getyere.com`; visible external-link cue and new-tab screen-reader notice. No new store-availability, user-count or compatibility claim.

**Cart Compare:** reserved equal visual slot; clearly labelled typographic placeholder; description focused on straightforward price comparison and informed everyday buying decisions. Detail/enquiry CTA works without a fabricated public URL. Replace the placeholder with a supplied approved logo, with meaningful alt text and `object-fit:contain`; keep aspect ratio. Confirm public URL, supported markets and feature wording before claiming availability or savings.

**Maple identity:** supplied original full logo in footer; leaf cropped from that asset for compact horizontal header/favicon. No recolouring of the supplied art or synthetic replacement logo. Provide proper company text alongside the compact mark, empty alt for the redundant leaf and full-company alt for the original logo.

## F. Verified Fix Log operations

No evidence has been supplied. Initial state is **0 verified entries** plus a blank downloadable publishing template. Do not seed plausible-looking outcomes.

Monthly workflow:
1. Identify a completed, permission-eligible engagement.
2. Capture actual work date, scope, original problem and authorised before evidence.
3. Record action, time, actual cost band/exclusions and measurement method.
4. Check the result against retained evidence. State limits and remaining work.
5. Redact identities, secrets, client records, filenames and identifying context; assess re-identification risk.
6. Obtain explicit publication permission covering the artifact or quote and wording.
7. Record private evidence/permission references; publish only approved redacted material.
8. Review monthly; correct material inaccuracies with a dated correction history. Archive or withdraw permission-sensitive material as appropriate.

“Verified” means checked against authorised evidence, not independently audited. A content update may be a reviewed source change; a CMS is optional Phase 2 work. Minimum public fields: date, before, action, measured after, time, cost, limits, redacted artifact/quote and verification note. Private supporting documents must never be committed to this repository.

## G. Requests, privacy and fallbacks

- Name, reply email and business are optional. One specific non-sensitive context field is required. HTML length and email validation apply; a required checkbox prompts removal of secrets/client identifiers.
- Prepare an encoded draft to the fixed existing `contact@mapledominionconsult.com` address. The UI must say “draft prepared, not sent”.
- Do not claim delivery or confirmation. If no mail handler opens, show destination and a downloadable request that can be pasted into an email.
- No website-side contact capture or automated follow-up exists. A visitor may add contact information after the results, but only their chosen email client sends it.
- Retention, hosting region, insurance and contractual access policies are not invented. Launch review must confirm operational practices. Do not reuse Yere’s privacy policy as though it described this separate consultancy website.

## H. Acceptance and non-goals

Acceptance: ten-answer completion/back navigation; deterministic score; invalid input rejected; three wins; useful results without email; real PDF and text downloads; valid/safe share reload; library search/filter/empty state; complete entries; four scoped ranges; matching referral paths; no fake evidence; honest requests; local fonts; keyboard/focus/mobile operation; no unintended remote HTTP calls.

Not Phase 1: live calendar, confirmed booking, server mail delivery/CRM, payments, visitor login, persisted tasks, client-document upload, real client outcomes without evidence, production-domain replacement, analytics, compliance certification, 24/7 support or AI answers.
