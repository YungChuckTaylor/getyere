# Scoped QA report

**Tested:** 28 October 2026. **Target:** separate `maple-dominion/` preview on port 4190; not the Yere application and not the existing public Maple website.

## Observed automated results

- **13/13 Node unit tests passed.** Content completeness, score endpoints and weighting, unknowns, non-scoring size/budget, invalid/inherited answers, DIY/incident/large-team/service routing, results-only round-trip, malformed/injected shares, search and category filtering, PDF xref/stream correctness, and encoded fixed-recipient email draft.
- **84/84 page-width checks passed** with no horizontal document overflow: 14 page/result routes at widths **320, 390, 768, 1024, 1440 and 1920px**.
- **29 automated axe audits passed with zero reported violations** in the selected WCAG 2 A/AA, WCAG 2.1 A/AA and best-practice rules. Coverage includes all ten library articles, homepage, diagnostic question/results, pricing, products, honest Fix Log, question/contact/trust/fit pages, unknown route and selected mobile flows.
- **Zero runtime page exceptions** in the browser run.
- **Zero unexpected remote HTTP(S) requests** from the implemented flows. The deliberate `mailto:` action is a user-requested handoff to an email client, not website-side delivery, and is excluded from the HTTP check.
- Actual PDF and text-checklist downloads exercised in Chromium. Results-only share reload, invalid-share failure, intro preselection, answer back/next retention, fresh restart, search/filter/reset/no-results, incident routing, email-draft fallback and mobile menu closure exercised.
- Share-link generation strips arbitrary base query parameters, including a fictional preview-token regression case. It does not copy a preview credential into the summary link.
- The generated result PDF was independently opened with Python `pypdf`: the tested DIY result parsed successfully, with score, priority content, DIY route and proposed-price caveat present. This is format/content verification, not accessible-PDF certification.

## Reproduction

Unit tests: `cd maple-dominion && npm test`.

Browser tests: start `python3 server.py`; install the independent subproject’s dev dependencies; run `npm run test:browser`. On this minimal sandbox, browser dependencies were installed in `/home/user/maple-tools` and bundled Chromium’s compatible shared libraries were provided separately. These helpers/artifacts are not application runtime dependencies or committed client evidence.

Browser run uses Chromium 153 via Playwright, with the problematic single-process flag removed. Run outputs live in `/tmp/maple-qa`: screenshots, JSON audit details, PDF and checklist. They are intentionally outside the deliverable source tree. The server remains bound to `0.0.0.0` for Arena preview and does not reject the preview host or prevent embedding.

## Human visual review

Reviewed the desktop homepage and results layout, phone hero/navigation and content stacking. The supplied original Maple logo is shown fully in the footer; its derived leaf appears in the compact header. Yere uses its approved existing logo; Cart Compare remains explicitly labelled pending. Pricing and proof are visibly draft/empty rather than disguised as approved claims.

## Limits and still-required release checks

- Automated axe results are not a declaration of complete WCAG conformance. Manual screen-reader, high-contrast/forced-colour, text zoom and supported-browser/device review remain required.
- Firefox, Safari/iOS, native mail-app combinations and production clipboard permissions were not independently tested in this sandbox.
- Browser-only PDF is a readable text document, not a fully tagged accessible PDF. Accessible HTML results remain available.
- Preview access/lifetime can prevent a shared link from working for someone outside the preview. Approve a public deployment before advertising durable public sharing.
- No email was actually sent, appointment booked, client data processed, client outcome verified, live Maple domain replaced or Yere release changed.
- No field performance, traffic, conversion, response-time or business-outcome baseline was measured. Proposed targets are in Deliverable 5.
- Production privacy, retention, hosting, insurance, scope/prices and capacity require owner confirmation.

**Verdict:** working Phase 1 review build with passing scoped automated checks; production approval and operational confirmations remain separate.
