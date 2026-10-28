# 5. Phased delivery plan, priorities and success measures

All dates below are sequencing proposals, not promises of capacity. There is no authorised replacement of the existing public Maple website or change to Yere.

## Phase 1 — Useful before contact

**Implemented in this preview:**
- Standalone responsive clinic homepage and supporting pages.
- Ten-question, browser-local Tech Check, explicit attention score/method, top three priorities, interactive this-week checklist, time/cost allowances and recommendation.
- Actual local PDF export, print and validated results-only share links.
- Ten complete Fix Library records, search/categories, cost context and ungated text templates.
- Business size / problem / urgency engagement picker and four clearly proposed CAD engagement ranges, with scope, timing and exclusions.
- Actual Maple/Yere branding and product pages; honest Cart Compare placeholder/link status.
- Verified Fix Log empty state, evidence standard and downloadable publishing template.
- Not a Fit alternatives, direct-access approach and preserved Talk → Scope → Build → Hand off process.
- 15-minute question and free 30-minute first-call **email requests**, not live booking or background delivery.
- Preview-specific privacy/security/insurance note; no invented operational policy or coverage.
- Five planning deliverables and reproducible scoped tests.

**Phase 1 launch gates — still required:**

| Priority | Owner action | Why it blocks or constrains launch |
|---|---|---|
| P0 | Approve or replace proposed prices, included hours, boundaries, tax treatment and turnaround wording | These are draft commercial terms, not existing offers |
| P0 | Confirm service capacity, actual response process and first-call availability | Avoid selling an SLA/slot that does not exist |
| P0 | Review privacy, email/hosting arrangements, retention, engagement access/revocation and insurance wording | Do not turn missing facts into a polished false promise |
| P0 | Approve production domain/hosting, backup of current site and a reversible cutover plan | No overwrite has been authorised |
| P0 | Resolve production URL/SEO strategy, old-page redirects, canonical metadata and robots policy | Preview hash routes/noindex are not the final indexing plan |
| P0 | Test real mail-client behaviour, fallback requests and receipt with the actual inbox owner | A mailto click proves intent, not delivery |
| P1 | Supply Cart Compare approved logo, public URL if any, and confirmed feature/market details | Current honest pending state can remain if approved |
| P1 | Human editorial review of every guide and provider-dependent instruction | General guidance must fit the actual services offered |
| P1 | Manual screen-reader/keyboard/zoom testing and Safari/Firefox/device checks | Automated Chromium/axe checks are not comprehensive |
| P1 | Make public sharing durable on the approved host | Preview links require preview access and may expire |

No client evidence is a reason to preserve the empty state, **not** a reason to invent proof. No claim of insurance coverage can be added until documentation supports it.

## Phase 2 — Make the handoff easier

Only after Phase 1 approval and actual visitor/usability feedback:

1. **Real appointment scheduling:** choose a provider and approved calendar; support timezones, realistic availability, buffers, cancellations, confirmation/reschedule messages and contact alternatives. State provider data handling before embedding it. A request must remain a request until the provider confirms a slot.
2. **Optional server-side enquiry delivery:** only if needed. Use a separately approved integration, validation, rate limiting/spam protection, secret management and minimal data. Confirm retention/deletion and receipt/retry/failure behaviour. Do not silently add the visitor to marketing.
3. **Expand the Fix Library by observed problems:** prioritise roughly 5–10 additional useful entries, not SEO filler. Improve aliases/search and provider reference maintenance. Templates stay ungated.
4. **Publish actual verified fixes:** use the monthly evidence/permission workflow. Add a small CMS only if reviewed source updates are genuinely too difficult.
5. **Improve production information architecture:** real routes and pre-rendering/SSR, page-specific metadata, redirects, sitemap and measured performance budgets.
6. **Approved, privacy-conscious measurement:** instrument only the events needed to answer specific questions. Do not record raw answers, pasted context, share fragments, emails or replay sessions. Obtain the necessary review/consent before enabling analytics.

**Exit:** booking confirmation is real and tested; no false delivery claims; content remains maintained; actual inquiries show the tools help people describe a problem.

## Phase 3 — Ask Maple AI, only if it earns its place

This is a future specification, **not** a Phase 1 widget.

### Approved knowledge only

- Retrieval corpus: reviewed Fix Library, approved current pricing/scopes, published policies, fit boundaries and confirmed product facts.
- Every answer cites the exact approved source entry and its current review/version date. No citation → no substantive answer; provide the nearest relevant guide or human escalation.
- Do not treat draft prices as approved or fill missing insurance/retention/product facts from general model knowledge.
- No unrestricted web answers, fabricated savings, diagnosis, legal/security/accounting certification or invented availability.

### Guardrails and human handoff

- State clearly that it is AI and not a staffed live agent. No answer implies an engagement or confirmation.
- Detect active compromise/fraud, requests for secrets/client data, urgent operations and high-stakes compliance/legal issues; route to the relevant human/provider/bank channel rather than improvising instructions.
- Ask visitors not to paste personal/confidential data; minimise collection and establish actual processing/retention/vendor terms before launch.
- Treat retrieved and visitor text as untrusted data, not instructions. Enforce source allowlists, citation validation and safe rendering outside the model. No autonomous email, account changes, production access or payment actions.
- Human escalation includes the visitor’s consented non-sensitive summary only. No automatic CRM record or silent transcript retention.
- Test prompt injection, unsupported questions, outdated rates, invalid citations, sensitive-data attempts and incident escalation. Include adversarial and accessibility review.

**Go/no-go:** only launch if the grounded assistant answers materially better than search, refuses unsupported assertions, cites current approved content and makes human escalation easier. Otherwise keep the excellent library and question form.

## Prioritisation rule

1. Truth and safety: stop unsupported commercial, emergency, proof, privacy or insurance claims.
2. Useful core: check → clear action → guide → honest scope.
3. Accessibility, responsive behaviour, reliability and understandable fallback.
4. Real operations and evidence upkeep.
5. Optimisation or AI only after the simpler route works.

## Success metrics — proposed, not measured results

No analytics were installed in Phase 1. The following are evaluation definitions and proposed usability targets, **not** traffic claims or promises of business improvement.

| Question | Measure / denominator | Initial proposed target |
|---|---|---|
| Can owners finish without help? | Completed checks ÷ started checks, in a consented observed trial | ≥80% of 5–8 representative SMB participants; investigate hesitation |
| Is “10 minutes” reasonable? | Start-to-results time, excluding deliberate interruptions | Typical observed completion ≤10 minutes; shorten if not |
| Is the output understood? | Participants explain the score, first action and limitations in their own words | 4 of 5 can name a next step and know it is not a scan |
| Can a real problem be found? | Correct useful fix found for a representative scenario | ≥80% of a defined task set without facilitator hints |
| Can users carry results away? | Successful PDF download/open and shared-link reload in test sessions | All supported release-browser test cases pass |
| Are commercial boundaries clear? | Participants distinguish proposed range, formal quote, included/excluded work and availability | 4 of 5 explain the distinctions correctly |
| Is optional contact really optional? | Results/PDF available with no email or request submitted | 100% of test paths; no forced capture |
| Are enquiries relevant? | Owner-coded fitting enquiries ÷ actual received enquiries, with a minimal agreed category list | Establish a baseline first; do not invent a conversion target |
| Is the response promise met? | Actual substantive replies within one Ontario business day ÷ eligible received enquiries | Track against the preserved one-business-day promise; define holidays/hours |
| Is evidence maintained? | Permissioned entries reviewed monthly; stale or corrected records addressed | Monthly review completed; zero fabricated entries |
| Does the website protect privacy? | Unapproved remote trackers/raw answer or context captures found in audit | Zero |

Do not count “Prepare my email” as “email received”, “call booked” or “lead qualified”. A link copy does not prove sharing. A checkbox tick does not prove a technical fix occurred. Keep denominators, observation windows and limitations attached to every reported number.

### Suggested release performance budgets

Proposed targets after production hosting is selected: LCP ≤2.5s, INP ≤200ms and CLS ≤0.1 at the relevant 75th percentile, plus no unexpected third-party runtime calls. These are targets, not measurements from this sandbox. Establish a field baseline before claiming them. Current static architecture/local fonts are supportive design choices, not proof of scores.

## Operating cadence and ownership

- **Monthly:** owner reviews fixes, evidence/permission status, recurring enquiries, pricing validity and contact links.
- **On provider change:** review affected library instructions and privacy/provider disclosures.
- **Before each release:** run scoped unit/browser tests, manual key journeys and no-secret checks; record changes and rollback steps.
- **Quarterly:** review whether the site is attracting fitting work or generating avoidable complexity. Remove features that do not help.

The solo owner remains accountable for commercial approval, publication permissions and service delivery. Implementation support does not imply a new agency team or round-the-clock operations.
