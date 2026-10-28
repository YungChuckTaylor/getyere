# Maple Dominion — Practical Tech Clinic

A **separate, working Phase 1 website** for Maple Dominion Consulting Inc. Nothing in this folder replaces or configures the Yere application. No production deployment or domain change has been made.

## Review the website

The current Arena preview runs on **port 4190**. Use the live preview labelled **Maple Dominion website**.

To run elsewhere (Python 3):

```sh
cd maple-dominion
python3 server.py
```

Then open the server URL. The server binds to `0.0.0.0`; there is no browser-facing localhost API, backend or external font call. Open through HTTP, not directly as a `file://` page, because ES modules require an appropriate origin. `PORT` may override 4190.

## The five deliverables

The combined [Maple Dominion Blueprint](docs/MAPLE_DOMINION_BLUEPRINT.md) includes all five, with a QA and approval summary. Individual source documents:

1. [Sitemap, wireframes and ZikZag section mapping](docs/01-SITEMAP-AND-WIREFRAMES.md)
2. [Ready-to-use copy, including all ten complete fixes](docs/02-READY-TO-USE-COPY.md)
3. [Functional specification: diagnostic, picker, products/logos and operations](docs/03-FUNCTIONAL-SPECIFICATION.md)
4. [Visual direction: palette, type, spacing, accessibility and responsive rules](docs/04-VISUAL-DIRECTION.md)
5. [Phased plan, priorities, launch gates and success metrics](docs/05-PHASED-PLAN-AND-METRICS.md)

## What works now

- 10-question browser-local Tech Check, weighted self-reported attention score, top three wins, this-week checklist, bounded time/cost allowances and engagement recommendation.
- Real local PDF download, print layout and validated results-only share-link reload. A link contains a summary, not raw answers, and is editable/readable by anyone who has it. Preview access and lifetime still apply.
- 10 complete Fix Library entries, keyword/category search, useful empty state and ungated text checklist downloads.
- Engagement picker with team/problem/urgency, four scoped proposed CAD ranges, inclusions/exclusions and referral/DIY branches.
- Existing Maple principles/process, three service foundations, actual Maple/Yere branding and owned-product presentation.
- Honest empty Verified Fix Log and blank evidence-ready publishing template.
- Not a Fit alternatives and context-first 15-minute/free-first-call **requests**.
- Optional contact only after check results; encoded email draft and download fallback, **not** website-side delivery or confirmed booking.
- Responsive layout, keyboard-native controls, focus/status handling, reduced-motion support and local fonts.

## Commercial and truthfulness guardrails

All rates are **proposed CAD planning ranges**, not owner-approved published offers:

| Engagement | Draft range |
|---|---|
| Tech Tune-Up | CAD $450–$900 |
| Fix Sprint | CAD $1,200–$3,000 |
| Fractional Tech Lead | CAD $1,500–$3,500/month; proposed 6–12 planned hours |
| Project Rescue assessment | CAD $900–$2,400; implementation excluded |

Taxes, licences and third-party charges are excluded. Scope/timing/availability need agreement. Active incidents are referred to existing provider/bank channels, not sold a routine sprint. No client outcomes, testimonials, savings, insurance, certification or availability have been invented. Cart Compare’s logo/public URL are explicitly pending.

## Development and testing

Runtime: no npm dependencies or build step. Scoped unit tests use Node 22+ and need no install:

```sh
cd maple-dominion
npm test
```

Optional automated Chromium/axe QA:

```sh
# Install only in this independent subproject, not the Yere root.
npm ci --ignore-scripts
# Start python3 server.py in a separate terminal first.
npm run test:browser
```

The bundled Chromium requires compatible Linux shared libraries. On a slim host, supply them or set `CHROMIUM_PATH` to a working locally installed Chromium. The script uses the bundled launch flags without `--single-process`. Set `MAPLE_BASE_URL` if not testing port 4190 and `MAPLE_QA_DIR` for screenshot/JSON/download output (default `/tmp/maple-qa`, intentionally outside Git). `MAPLE_TOOLS` can point to an external dependency installation prefix. A custom `CHROMIUM_PATH` must be compatible with the bundled Linux flags.

Test artifacts are not client evidence. No screenshots, PDFs, recordings or test dependencies need to be committed. See [QA report](docs/QA-REPORT.md) for the observed run and limits.

Regenerate editable documentation:

```sh
npm run docs:copy
npm run docs:blueprint
```

## Where to edit

- `data.mjs`: questions/factors/weights, scoped prices, quick wins, fixes and process.
- `engine.mjs`: deterministic logic, whitelist validation, PDF and email draft.
- `app.mjs`: routes, page copy, composition and interactions.
- `styles.css`: palette, local font faces, layout, responsive and print.
- `assets/maple-dominion-logo.png`: unchanged supplied original, fully displayed in footer.
- `assets/maple-mark.png`: cropped supplied leaf for header/favicon.
- `assets/yere-logo.png`: existing approved Yere logo.
- `docs/`: planning deliverables, copy and QA.

When changing copy in `app.mjs`, update the manual portions of `scripts/export-copy.mjs` too. Its library/pricing/question sections come directly from `data.mjs`; the narrative copy is intentionally editorial.

## Deployment handoff — not performed

Host this folder as its **own** static project, with no Yere build command, environment secret or backend. An approved static host must serve `.mjs` as JavaScript, WOFF2 as fonts and HTTPS for reliable clipboard access. Do not point the existing Yere project at this folder. Do not overwrite the existing Maple site until approved, backed up and reversible.

The preview is intentionally `noindex`. Before public cutover: approve prices/capacity and guide wording; confirm privacy/hosting/email-retention/insurance facts; supply or approve pending Cart Compare assets; verify the real inbox and supported browsers; decide real URLs/prerendering, canonical metadata, redirects and sitemap; then remove the preview status and change indexing only with approval.

Recommended HTTP headers for an approved production host mirror the preview: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and a restrictive CSP allowing only local scripts/fonts/images and no network API calls. Current inline styling is limited to the progress indicator and needs the declared inline-style allowance. No frame-blocking header is added to the preview, so Arena embedding continues to work. Adapt framing policy deliberately for production.

Phase 2: real calendar/optional delivery and more guides. Phase 3: approved-source, cited AI with human escalation only if it is demonstrably more useful than search. Neither is falsely represented as implemented.
