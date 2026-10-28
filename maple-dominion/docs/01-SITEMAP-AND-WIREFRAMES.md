# 1. Sitemap, page wireframes and reference translation

**Maple Dominion Consulting Inc. — Practical Tech Clinic for SMBs**  
Prepared 28 October 2026 · Working Phase 1 preview · Separate from Yere

## The organising idea

Give a business owner a useful diagnosis, a first action and an honest price context before asking for a conversation. Keep the existing Ontario, independent, direct-access consultancy—not an invented agency team. Software & Web Development, Software Training and Data & Analytics remain the three underlying capabilities.

**Primary journey:** recognise a problem → take the Tech Check → see ungated results → use a checklist or guide → understand an engagement → optionally request help.

**Equally valid journeys:** search a fix and leave with an answer; realise Maple is not a fit and use a better support channel; explore a Maple-owned product without becoming a consulting lead.

## Sitemap and implemented routes

All routes below work beneath the standalone site’s own base URL. Hash routing is intentional for the portable preview; no Yere route or deployment configuration is changed.

| Page | Preview route | Job / primary next step |
|---|---|---|
| Homepage / clinic | `#/` | Orient, recognise a problem, start Tech Check |
| 10-Minute Practical Tech Check | `#/tech-check` | Introduction, then 10 questions with back/next |
| Own results | Same route, browser-memory result state | Top three wins, checklist, PDF, optional follow-up |
| Shared results | `#/report?v=1&…` | Validated results-only snapshot; no original answers |
| Fix Library | `#/fix-library` | Search and category filtering; 10 complete fixes |
| Individual fix | `#/fix-library/{slug}` | Symptoms, first action, sequence, cost, escalation, checklist |
| Straight pricing | `#/pricing` | Engagement picker, four scopes, inclusions/exclusions |
| Selected engagement | `#/pricing?engagement={id}` | Scroll to a specific scope; not a checkout |
| How I work | `#/about` | Three capabilities, solo/direct access, process |
| Products | `#/products` | Yere and Cart Compare as owned products |
| Cart Compare detail | `#/products/cart-compare` | Honest detail and enquiry; no invented public URL |
| Verified Fix Log | `#/fix-log` | Empty state, evidence standard, publishing template |
| When we’re not a fit | `#/not-a-fit` | Clear boundaries and useful alternatives |
| 15-Minute Tech Question | `#/question` | Context-first email request, not live availability |
| Contact / first call | `#/contact` | Free 30-minute project-call request |
| Privacy, data and trust | `#/trust` | Actual preview behaviour, limits, launch confirmations |
| Insurance note | `#/trust/insurance` | Coverage unconfirmed; ask for documentation |
| Unknown / invalid route | Any unrecognised route | Useful error state and navigation back |

Primary navigation: **Tech Check · Fix Library · Straight pricing · Products · How I work · Ask a tech question.** Footer adds Not a Fit, Fix Log, contact, privacy/data handling and insurance. No blog, newsletter gate or chatbot.

## Homepage wireframe, in reading order

```text
[Preview-only status: proposed prices / no invented outcomes]
[Maple identity] [five navigation links] [Ask a tech question]

1. HERO — two columns
   Left: clinic label → practical promise → useful-before-contact copy
         [10-Minute Tech Check] [Find a fix myself]
         No email needed / self-reported planning aid
         Ontario / one person / direct access
   Right: static intake card
         What is slowing the business down?
         spreadsheet / disconnected tools / access & backups
         Each choice preselects the headache question, not the score

2. VALUE STRIP — simpler work / time / control; no partner logos

3. COMMON PROBLEMS / FIX LIBRARY
   Heading + all-fixes link → three problem cards
   Full library has 10 complete, searchable entries

4. BENEFITS / DIRECT ACCESS
   Editorial statement left; four practical benefits right
   Direct access / usable advice / written scope / less complexity

5. PHILOSOPHY / PROCESS
   Talk → Scope → Build → Hand off, with clear responsibilities
   Existing plain-spoken anti-complexity promise

6. PRODUCTS
   Yere + supplied approved logo + tagline + getyere.com
   Cart Compare + labelled logo placeholder + honest detail link

7. PRICING
   Four proposed CAD ranges → scope / exclusions → picker link
   Notice: not approved offers or formal quotes; taxes/licences extra

8. VERIFIED FIX LOG
   Charcoal evidence panel → publishing template
   No fake outcome, testimonial, client logo or performance number

9. NOT A FIT + 15-MINUTE QUESTION
   Candid exclusions and alternatives / one-question email request

10. CONTACT
    Free 30-minute first call, one-business-day reply, no obligation

11. TRUST FOOTER
    Original supplied logo / Ontario / contact / privacy / insurance
```

## Other page wireframes

### Tech Check

- **Intro:** breadcrumb; purpose; 10-minute estimate; what the user receives; browser-local/no-email disclosure; not a scan/audit; Start button.
- **Question screen:** back-to-intro link; question count and progress; one fieldset/legend; plain-English helper; 3–7 radio choices; Back / Next. Next remains disabled until selected. Back preserves the choice. The headache may be preselected from the homepage but stays editable.
- **Results:** heading and attention score; explanation and limits; urgent referral where appropriate; PDF / share / print; three ordered quick wins with time/cost allowances and interactive checklist; matching guide links; DIY/service/referral recommendation; proposed-price warning; scoring explanation; **only then** optional follow-up form.
- **Shared results:** same useful output, clearly labelled editable snapshot; no original answers; malformed or unknown payloads produce a safe error rather than guessed results.

### Fix Library and fix detail

- **Library:** headline; problem/symptom search; category buttons; live result count; cards; no-results state; clear/reset; ask-a-question route.
- **Detail:** category and review date; symptoms; prominent immediate action; ordered next steps; when to call; provider reference where available; cost allowance; checklist/template; ungated `.txt` download; next useful action.
- **Mobile:** single-column cards, then guide content followed by cost/checklist. Nothing depends on a hover gesture or a sidebar staying on screen.

### Pricing

- Intro and proposed-price notice.
- Left: business size / problem / urgency picker. Right: recommendation, proposed range, timing, included/excluded, scope constraints, and written-scope enquiry.
- Four engagement cards, each with inclusions, expandable boundaries/exclusions and an enquiry link.
- Active fraud/compromise routes outside routine consulting; more than 100 staff requires a fit review. A deadline never fabricates availability.

### Verified Fix Log

- Explain the evidence standard.
- Show publishing structure, explicitly **not** a real case study.
- Show **0 verified entries published** and explain why.
- Evidence requirements, permission/redaction rules, meaning of verification and downloadable blank publishing template.
- Future populated entries must use actual dated evidence and measured limits. No outcome is prefilled by the site.

### Products

- Parent-company ownership and product-thinking introduction.
- Equal, coherent cards; actual Yere logo; pending Cart Compare mark explicitly labelled.
- Yere links to the confirmed web product. Cart Compare links to owned detail/enquiry, never a fabricated store or launch page.
- Ownership does not substitute for verified consulting outcomes.

### Not a Fit, question, contact and trust

- Not a Fit: condition → candid boundary → useful alternative; question CTA.
- Question: one specific problem, context-first form, no sales-pitch framing, request-versus-confirmation explanation.
- Contact: optional name/email/company; required non-sensitive context; required check that secrets/client identifiers were omitted; prepare email; fallback download.
- Trust: browser-local tools, share-link visibility, email-client handoff, hosting-metadata caveat, no analytics added, no unverified retention/insurance promise.

## ZikZag Home 3: translate the rhythm, not the fiction

Reference: <https://wgl-dsites.net/zikzag/home-3/>. Existing content anchor: <https://mapledominionconsult.com/>.

| Reference pattern | Maple translation | Deliberate rejection |
|---|---|---|
| Large animated hero | Quiet two-column promise + usable intake card | No animated hero, generic stock team or vanity metric |
| Partner strip | Principles of useful technology | No borrowed client/partner logos |
| Benefits cards | Direct-access and practical-work benefits | No unsupported scale, reach or credentials |
| Philosophy / core values | Original simple-solution promise | No generic agency manifesto |
| Principles / strategy | Talk → Scope → Build → Hand off | No ornamental service jargon |
| Portfolio tiles | Real Maple-owned Yere and Cart Compare | No invented client portfolio |
| Testimonial slider | Evidence-ready Verified Fix Log | No invented quotes, savings or star ratings |
| Pricing tiers | Scoped engagement ranges and picker | No fake urgency, fake popularity or checkout |
| Contact block | Context-first email request | No live calendar, address map or phone invented |

## Production information architecture decision

The preview is deliberately `noindex`. Before a public rebuild replaces the existing site, choose static pre-rendered or server-rendered real URLs, page-specific metadata, canonical URLs, redirects from the current site and a sitemap. Hash routes are functional for this review but are not presented as a finished search-indexing strategy. Approve the deployment separately; do not overwrite the current public Maple site or Yere.
