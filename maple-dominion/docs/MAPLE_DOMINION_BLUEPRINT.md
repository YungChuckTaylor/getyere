# Maple Dominion Consulting Inc.
# Practical Tech Clinic — Website & Blueprint

**Prepared 28 October 2026** · Independent Ontario consultancy · Phase 1 review build

## What has been delivered

A working, separate website plus all five requested planning deliverables. Open the live preview labelled **Maple Dominion website** (port **4190**) to use the check, library, pricing picker, products and request flows. Source: `maple-dominion/`. Yere has not been changed by this task. No replacement of the existing public Maple site has been deployed.

### Included in this combined document

1. Sitemap, page wireframes and ZikZag Home 3 section mapping.
2. Ready-to-use copy for the homepage, Tech Check, pricing, Not a Fit, products and complete 10-entry Fix Library.
3. Functional specifications for diagnostics, picker, PDF/sharing, products/logo placement and content operations.
4. Visual direction: accessible orange palette, typography, spacing and responsive translation.
5. Phased plan, priorities, launch approvals and proposed success metrics.

Individual editable source documents are alongside this file. The QA report is appended.

## Read these boundaries first

- **Prices are proposals in CAD**, not approved published offers: Tune-Up $450–$900; Fix Sprint $1,200–$3,000; Fractional Tech Lead $1,500–$3,500/month; Project Rescue assessment $900–$2,400. Scope, hours, taxes/exclusions and capacity need owner approval.
- **No outcomes were invented.** The Verified Fix Log is honestly empty, with an evidence-ready publishing template and a monthly review process.
- **Contact is an email draft, not a confirmed booking or background submission.** The optional request appears after useful check results. The existing contact address is preserved.
- **Privacy and insurance facts are not guessed.** The site describes its actual browser-local behaviour; operational practices and coverage remain confirmation gates.
- **Products are owned by Maple.** Yere uses the approved logo, exact tagline and confirmed getyere.com link. Cart Compare has an explicitly labelled logo placeholder and no fabricated public URL.
- **Booking and AI are future phases.** No live calendar or uncited chatbot has been slipped into Phase 1.

## Review sequence

1. Take the Tech Check without supplying contact details; download its PDF and try its share link.
2. Search a real business problem in the Fix Library and download its checklist.
3. Try the engagement picker, including an urgent incident and a large-team case.
4. Review proposed scope/prices and the honest Fix Log.
5. Confirm the operational and launch decisions in Deliverable 5 before authorising any public cutover.

---

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


---

# 2. Ready-to-use website copy

**Maple Dominion Consulting Inc. — Practical Tech Clinic for SMBs**  
Copy edition: 28 October 2026. Commercial prices, service hours and timing below are explicitly proposed for owner approval. No hypothetical client outcomes are presented as real.

This is a publishable copy deck, not just a list of headline ideas. It also exports all ten complete Fix Library entries. Working source of truth: `app.mjs` and `data.mjs`. Regenerate this file with `npm run docs:copy` after content edits.

## A. Global navigation and operating language

**Navigation:** Tech Check · Fix Library · Straight pricing · Products · How I work · Ask a tech question.

**Preview-only strip:** Website preview / Proposed prices, not approved offers. No client outcomes invented.

**Contact:** contact@mapledominionconsult.com. Ontario, Canada. One person. Direct answers. Reply within one business day. Not monitored for emergencies.

**Draft versus approved:** The preview strip remains until commercial and production review. Do not simply remove “proposed” from the prices to make the page look finished.

## B. Homepage

### 1. Hero

**Eyebrow:** A practical tech clinic for your business

**Headline:** Practical technology. A clearer next step.

**Body:** Practical technology help for small and mid-sized businesses. Find your top risks and quick wins before you talk to anyone.

**Primary CTA:** Take the 10-Minute Tech Check

**Secondary CTA:** Find a fix myself

**Reassurance:** No email required. Useful results, not a sales score.

**Identity:** One person. Direct answers. Independent consultancy, based in Ontario.

**Intake panel:** What’s slowing your business down? You don’t need to know the technical name. Start with what feels harder than it should.

**Choices:** Too much spreadsheet work · Tools that don’t talk to each other · Worry about access or backups.

**Panel footnote:** 10 questions. About 10 minutes. A little clarity goes a long way.

### 2. Value strip

Good technology should: Make work simpler. Give you back time. Leave you in control.

### 3. Common problems

**Eyebrow:** The Fix Library

**Headline:** Start with the problem. Not a service catalogue.

**Body:** Plain-English first steps you can use today. No form. No download gate.

**CTA:** All 10 practical fixes

**Featured problem cards:** The weekly Excel report takes half a day. / Move shared files without moving the mess. / Can the team put client data into AI?

**Card action:** Get a practical first step.

### 4. Direct access and benefits

**Eyebrow:** Why Maple Dominion

**Headline:** A small consultancy. A shorter route to an answer.

**Body:** You work directly with the person doing the work. No account-manager relay, no complicated answer to a simple question.

- **Direct access:** One person, from the first conversation to the final handoff.
- **Advice you can use:** Plain language, practical choices and a reason behind each recommendation.
- **A written finish line:** Fixed boundaries and a price agreed before the work begins.
- **Less, when less works:** If the sensible answer is to simplify or not buy something, I’ll say so.

**CTA:** Meet the approach

### 5. Philosophy and process

**Eyebrow:** How I work

**Headline:** No mystery in the middle.

**Body:** A clear process, start to finish. You should know what happens next.

**01. Talk:** Start with the problem, not a shopping list. A free first call helps us understand the goal, constraints and budget.

**02. Scope:** Agree the deliverables, boundaries, timeline and price in writing before work starts.

**03. Build:** See useful progress at agreed check-ins. Keep the solution small enough to understand and maintain.

**04. Hand off:** Get documentation and a walkthrough so your team can use the result confidently without me.

**Promise:** “If a simple solution will do, I’ll recommend it. If something isn’t worth building or buying, I’ll tell you.”

### 6. Products section introduction

**Eyebrow:** Built here, used out there

**Headline:** Product thinking. Not just recommendations.

**Body:** I build real products, too. The same care for useful features, clear choices and a thoughtful handoff goes into client work.

**CTA:** The products

Use the Yere and Cart Compare copy in section G.

### 7. Pricing section introduction

**Eyebrow:** Straight pricing

**Headline:** An honest starting point. Not a surprise invoice.

**Body:** See the likely shape of the work before a conversation. These ranges are proposed for approval.

**CTA:** Find the right engagement

Use the scoped cards and notice in section E.

### 8. Verified Fix Log

**Label:** The Verified Fix Log

**Headline:** Proof should come with the working.

**Body:** A useful outcome needs a before, an after and something you can inspect. Not a stock quote with five stars.

**CTA:** See how fixes will be documented

**Visible template fields:** Before — The original problem, in plain English. / The fix — What changed, and what stayed out of scope. / After — A dated result, with the limits attached. / Evidence — A permissioned, redacted artifact or quote.

**Mandatory label:** Publishing template · Not a client case study.

### 9. Fit and question

**Eyebrow:** A good fit goes both ways

**Headline:** Sometimes the right answer isn’t me.

**Body:** Need a 24/7 helpdesk, enterprise compliance assurance or a full-time internal IT person? I’ll point you towards a better kind of help.

**CTA:** When we’re not a fit

**Question card:** One specific tech question? Give me the context. Get an answer, a next step or a referral—not a sales pitch.

**CTA:** Request a 15-minute conversation

**Footnote:** Email request now. Time confirmed by reply.

### 10. Contact

**Eyebrow:** A real conversation

**Headline:** Let’s make the next step a useful one.

**Body:** Send a short note about what you’re trying to solve. I’ll reply within one business day with clear next steps.

**CTA:** Request a free first call

**Footnote:** 30 minutes. No obligation. No complicated pitch.

### 11. Footer

Practical technology. Direct answers. A little less complicated.

Independent. Ontario, Canada.

**Links:** Take the Tech Check · Find a practical fix · See proposed pricing · Request a free 30-minute first call · When I’m not a fit · Privacy & data handling · Insurance · Fix Log.

**Direct contact:** contact@mapledominionconsult.com. One-business-day reply. Not an emergency support service.

## C. How I work / underlying services

**Headline:** One person. Direct answers.

**Body:** I build websites and custom software, train teams to get more from Excel and other tools, and turn scattered data into clear reports. You work directly with me, from the first call to the final handoff.

**Software & Web Development:** Business websites, custom web apps and internal tools built around how the business actually works. Automate repetitive work only where it makes the job simpler.

**Software Training:** Hands-on Excel sessions, formulas, pivot tables and reporting. Workshops use the team’s real work—not a generic slide deck.

**Data & Analytics:** Data cleaning, dashboards and KPI reporting that answer a specific business question. Get clear on the question before buying another dashboard.

**Process heading:** Talk → Scope → Build → Hand off.

**Body:** Know what you are getting, what it costs and how you will use it.

## D. Tech Check

**Eyebrow:** A small check. A useful plan.

**Headline:** Find the friction. Know what to do next.

**Body:** Ten plain-English questions about your tools, access and everyday work. Get your top three priorities, a do-this-week checklist and an honest starting point.

**Reassurance:** About 10 minutes. Results before contact details. Answers stay in this tab.

**CTA:** Start my Tech Check

**Limit:** No scan is performed. This is a self-reported planning aid, not a security audit or compliance assessment. A low score is not a guarantee of safety.

**What you leave with:** A short list. Not a 40-page report.
- Your attention score: A consistent way to prioritise—not a certificate.
- Three practical quick wins: Small actions, with planning time and cost allowances.
- A next step you can own: DIY, a scoped engagement or a better referral.

Download a PDF or share a results-only link. No email gate. No account.

### Literal questions and helpers


---

#### 1. How many people use your business tools?

This helps size the advice. A larger team is not automatically a higher risk.

- Just me
- 2–10 people
- 11–30 people
- 31–100 people
- More than 100 people

No risk-score weighting.

---

#### 2. What is getting in the way most?

Pick the problem you most want to stop carrying around.

- Spreadsheets and repetitive work
- Tools or files that don’t work together
- Worry about access, backups or security
- People need help using the tools
- A project that has stalled
- Too many technology decisions
- Possible account compromise or payment fraud

No risk-score weighting.

---

#### 3. Do you know which tools you pay for and who owns them?

Think software subscriptions, administrator access and renewal dates.

- Yes—there is a current list and a named owner — scoring factor 0
- Some of it is written down — scoring factor 0.5
- I’m not sure — scoring factor 1

Internal scoring weight: 2.

---

#### 4. Could you restore an important file if it disappeared today?

Syncing a file is useful, but it is not proof that you can recover it.

- Yes—we have tested a restore recently — scoring factor 0
- We have backups, but haven’t tested them — scoring factor 0.65
- We rely on sync or have no separate plan — scoring factor 1
- I’m not sure — scoring factor 1

Internal scoring weight: 5.

---

#### 5. Do email and administrator accounts need more than a password?

For example, an authenticator, security key or another sign-in verification step.

- Yes—for every account that supports it — scoring factor 0
- Only for some accounts — scoring factor 0.6
- No, just passwords — scoring factor 1
- I’m not sure — scoring factor 1

Internal scoring weight: 5.

---

#### 6. How do you check a request to change bank or payment details?

This is about the real process, not just whether a spam filter is switched on.

- We verify through a trusted, separate contact method — scoring factor 0
- People know to be careful, but there is no process — scoring factor 0.6
- We usually rely on the email itself — scoring factor 1
- I’m not sure — scoring factor 1

Internal scoring weight: 3.

---

#### 7. Where does the team keep the current version of a shared file?

A clear home and individual access make handoffs much easier.

- A shared workspace with individual access and an owner — scoring factor 0
- A mix of attachments, shared drives and personal folders — scoring factor 0.6
- Mostly shared logins, public links or personal accounts — scoring factor 1
- I’m not sure — scoring factor 1

Internal scoring weight: 3.

---

#### 8. Do sales, customer and accounting records agree?

There does not have to be an expensive CRM—just a reliable source of truth.

- Yes—we know the source of truth and reconcile differences — scoring factor 0
- Mostly, but we retype or patch the numbers — scoring factor 0.6
- We regularly work from conflicting records — scoring factor 1
- I’m not sure — scoring factor 1

Internal scoring weight: 2.

---

#### 9. What happens when someone wants to use AI with client information?

Think names, contracts, customer records and confidential business documents.

- We have clear boundaries and approved tools — scoring factor 0
- We don’t use client information with AI — scoring factor 0
- People use AI, but the boundaries are unclear — scoring factor 0.7
- Client or confidential information goes into unapproved tools — scoring factor 1
- I’m not sure — scoring factor 1

Internal scoring weight: 3.

---

#### 10. What planning budget feels realistic right now?

This changes the next step, not your score. DIY is a valid answer.

- I need a do-it-myself starting point
- Under CAD 1,000
- CAD 1,000–3,000
- More than CAD 3,000
- I need to understand the scope first

No risk-score weighting.

---

### Result and interaction copy

**Headline:** A clearer place to start.

**Body:** Your top three priorities, a checklist and a route forward. No email address needed to see any of it.

**Score label:** Attention score /100. Higher means more to review.

**Score bands:** Keep the good habits going. / A few useful gaps to close. / Start with the basics this week.

**Method note:** Based on your selected answers, not a technical scan. Unknown control answers are treated as needing attention. Even a low score is not proof of security or compliance.

**Shared-link note:** This link is an editable, self-reported snapshot. It does not include the original answers or verify the recommendations.

**Win labels:** Do this week / Keep this habit. **Buttons:** Download my PDF · Copy results-only link · Print · Read the practical guide · Start a fresh check.

**Sharing disclosure:** No raw answers or contact details. Anyone with this link can view and edit the snapshot. Preview links need access to the preview; public sharing requires deploying this site.

**Recommendation supporting copy:** A recommendation. Not a sales requirement. Use the checklist yourself, share it with your existing provider or bring a specific question. You do not need to buy an engagement to use any of these results.

**Optional follow-up:** Want a human second look? Keep your results without contacting anyone. If you would like a follow-up, prepare an email request below. No mailing list and no background submission.

**Validation:** Please answer the displayed question before continuing. **Invalid share state:** This results link is incomplete or invalid. Try the free Tech Check or find a problem in the Fix Library.

## E. Straight pricing and engagement picker

**Eyebrow:** Clear boundaries before commitment

**Headline:** Straight pricing. No mystery scope.

**Body:** These are proposed CAD ranges for four clearly bounded engagements. Use them to decide whether a conversation is worth having—not as a formal quote.

**Notice:** Proposed CAD planning ranges for owner approval—not published offers or a formal quote. Taxes, licences and third-party fees are excluded. Timing starts after access, scope and availability are agreed.

**Picker label:** The engagement picker. **Headline:** What kind of help fits? **Body:** Three choices. A starting point you can question.

**Inputs:** Business size · The problem · How soon do you need a next step?

**Urgency options:** Flexible—I want a sensible plan / I’m hoping to start this week / The business cannot wait today.

**CTA:** Find my starting point

**Scope heading:** Four ways to make progress.

**Scope body:** A written scope sets the actual fee, deliverables, access needs and start date. No checkout. No automatic commitment.


---

### Tech Tune-Up

**Know what to fix first.**

**Proposed price:** CAD $450–$900 one scoped review. **Planning window:** 3–5 business days.

**Best for:** An unclear problem or too many possible next steps.

**Included:**
- A focused discovery session
- Review of one business workflow and its tools
- Prioritised action list with owners
- A plain-English handoff conversation

**Excluded:**
- Penetration tests or compliance certification
- Implementation, migrations or ongoing support

**Boundary:** Planning assumption: one workflow, up to 15 user accounts. Larger teams are scoped separately.

**CTA:** Ask about the scope

---

### Fix Sprint

**One problem. A useful finish line.**

**Proposed price:** CAD $1,200–$3,000 per sprint. **Planning window:** 1–2 weeks.

**Best for:** A specific spreadsheet, website, reporting or workflow problem.

**Included:**
- One agreed problem and a written finish line
- A bounded build, repair or automation
- Testing with a representative sample
- Documentation and a team walkthrough

**Excluded:**
- A whole-business transformation
- New software subscriptions or unlimited revisions

**Boundary:** Planning assumption: one workflow, up to two connected tools and one handoff session.

**CTA:** Ask about the scope

---

### Fractional Tech Lead

**A steady second opinion.**

**Proposed price:** CAD $1,500–$3,500 per month. **Planning window:** Monthly; start date agreed.

**Best for:** Ongoing priorities, vendor decisions and a practical roadmap.

**Included:**
- A prioritised monthly technology plan
- Planned decision and vendor-review sessions
- Clear action owners and progress notes
- 6–12 planned consulting hours per month

**Excluded:**
- 24/7 helpdesk or on-call cover
- Unlimited development or a full-time employee

**Boundary:** Monthly scope and hours must be agreed in writing. Availability is not guaranteed by the picker.

**CTA:** Ask about the scope

---

### Project Rescue

**Find the way forward.**

**Proposed price:** CAD $900–$2,400 for the assessment. **Planning window:** 2–5 business days.

**Best for:** A stalled software, website or reporting project.

**Included:**
- Review of one existing project
- Access and dependency inventory
- A recovery plan: fix, simplify or stop
- A walkthrough of findings and options

**Excluded:**
- Completing the entire rescue build
- Guaranteeing recovery of missing data or access

**Boundary:** Assessment only. Any implementation gets a separate scope and price.

**CTA:** Ask about the scope

---

### Picker fallback and triage language

**DIY:** Start with the free checklist. Do the low-risk steps you can own. Use the Fix Library before committing to paid work; a short question can help clarify a sticking point. Self-paced. No paid engagement required.

**Active compromise/fraud:** Contain the incident first. Possible account compromise or payment fraud is not a routine consulting enquiry. Contact your current IT/email provider through a trusted channel, and your bank immediately if money may be at risk. Do not wait for a call here.

**Large team:** Check the fit before choosing a package. A team of more than 100 needs a requirements conversation. An established managed-service provider or specialist may be a better fit for broad operational coverage. No package or start date assumed.

**Urgency limitation:** A deadline today does not imply same-day availability. Contact an established support provider if the business cannot wait.

## F. When we’re not a fit

**Eyebrow:** A useful no is still useful

**Headline:** You don’t need to hire me to get a straight answer.

**Body:** The right kind of help matters more than winning the work. Here are situations where another route is more sensible.

### You need a 24/7 helpdesk.
I’m one person, not a staffed support desk.

**A better route:** Look for a managed-service provider with a written response SLA and coverage that matches your hours.

### You need enterprise compliance assurance.
A practical review is not a regulated audit or certification.

**A better route:** Use a qualified compliance, legal or security specialist for the specific framework and jurisdiction.

### You need an incident-response team now.
This inbox is not an emergency containment channel.

**A better route:** Use your existing provider or an incident-response specialist. For payment fraud, call your bank through a known number.

### You need a full-time internal IT person.
Fractional help does not replace daily, embedded ownership.

**A better route:** Consider a permanent hire or a staffed contract role with the capacity you need.

### The only goal is the cheapest hourly rate.
I scope an outcome and a handoff, not a race to the lowest hour.

**A better route:** A clearly bounded task marketplace or your existing vendor may be better for a price-only purchase.

### You want unnecessary complexity—or unlimited scope.
I will not recommend a new tool just to make the project bigger.

**A better route:** Agree the real business need and a written finish line first. If that is not welcome, we are unlikely to fit.

**Closing:** Not sure which route fits? Describe one problem without passwords or client details. A referral can be the right result.

**CTA:** Ask a tech question

## G. Products

**Eyebrow:** The same discipline, in real products

**Headline:** Build something useful. Then make it usable.

**Body:** Maple Dominion owns Yere and Cart Compare. They show the same product thinking I bring to client work: understand the problem, keep the useful parts and make the next step clear.

### Yere

**Tagline:** Remember the times, together!

**Body:** An interactive reminder app that helps people capture and remember the moments and tasks that matter.

**CTA:** Explore Yere — https://getyere.com (opens in a new tab).

**Asset:** Approved existing Yere logo, contained without stretching. No unverified store badge or user count.

### Cart Compare

**Supporting line:** Less comparing. Clearer buying decisions.

**Body:** A straightforward price-comparison tool that helps people make faster, better-informed buying decisions without complexity.

**CTA:** About Cart Compare

**Pending note:** Public product link not yet supplied. Product logo to be supplied.

**Detail:** A straightforward price-comparison tool for everyday buying decisions. A public website, product logo and supported-market details have not been supplied, so this preview does not claim availability, retailer coverage or savings.

**Enquiry CTA:** Ask about Cart Compare

**Proof boundary:** Product ownership is evidence of building products—not a substitute for a client case study, independent assurance or guaranteed business results.

## H. Verified Fix Log page

**Eyebrow:** Evidence before adjectives

**Headline:** Show the fix. Keep the receipts.

**Body:** An anonymised, dated record of what changed, what it cost and what the result actually showed. This is where permissioned client outcomes will go.

**Count:** 0 verified entries published.

**Empty-state headline:** No borrowed proof. No made-up wins.

**Empty-state body:** No client evidence has been supplied for this preview. I have not turned hypothetical examples, product ownership or routine development activity into “verified” consulting outcomes. The log is designed for a monthly review. A record appears only after the result, redaction and publication permission have been checked.

**Meaning:** Checked against retained, authorised evidence—not an independent certification. Named references and client details remain private unless the client has expressly agreed otherwise.

**CTA:** Download the publishing template

## I. 15-Minute Tech Question and contact

**Question headline:** Bring the problem. Leave out the sales pitch.

**Question body:** Describe one specific technology problem. I’ll help clarify an answer, a next step or a better referral. A conversation is requested here—not automatically booked.

**Form heading:** Request a 15-minute tech conversation

**Operational note:** Phase 1: request by email. Live calendar booking is planned for Phase 2. Your time is confirmed in the reply.

**Contact headline:** Let’s make the next step a useful one.

**Contact body:** Send a short note about what you’re trying to solve. I’ll reply within one business day with clear next steps. The first 30-minute project call is free, with no obligation.

**Form labels:** Your name (optional) · Reply email (optional) · Business name (optional) · What is the one question? / What are you trying to solve? (required).

**Context placeholder:** What is happening, what have you tried, and what would a useful outcome look like?

**Required safety check:** I have left out passwords, access codes, client identifiers and confidential documents.

**CTA:** Prepare my email request

**Disclosure:** This opens a draft in your email app. Nothing is sent or booked until you send it. This website does not receive the form. No mailing-list subscription.

**Fallback:** Email draft prepared—not sent. If your email app did not open, download the request or copy it into an email to contact@mapledominionconsult.com.

**Fallback action:** Download my request (.txt)

**Sidebar:** No perfect brief needed. A little context is enough to start. I’ll tell you if it needs a project, a small fix or someone else.

## J. Fix Library landing and reusable entry template

**Eyebrow:** Useful before we talk

**Headline:** A fix for the problem. Not another article to read.

**Body:** Find the symptoms. Try a sensible first step. Know the likely cost and when to stop doing it yourself.

**Search:** Search problems, symptoms or tools. Try ‘Excel’, ‘email’ or ‘files’…

**No results:** No exact match. Still a useful next step. Try a shorter search or another problem category. Show all fixes.

**Cost note:** Every fix includes an ungated checklist. Cost allowances are planning estimates, not vendor prices or approved consulting rates.

### Reusable editorial template — not a client result

- **Title:** [State the business problem in the reader’s language.]
- **Short promise:** [One bounded useful first step, not a guaranteed outcome.]
- **Category / editorial review date:** [Approved category / actual review date.]
- **Does this sound familiar?** [Two or more observable symptoms.]
- **Your immediate action:** [A reversible, low-risk first step; urgent external channel if needed.]
- **A practical next sequence:** [Three concrete steps with scope, test and rollback/stop boundaries.]
- **What might it take?** [CAD allowance, team/sample assumptions, internal effort versus fees, licence/tax exclusions.]
- **When to call someone:** [When the next step needs Maple, an existing provider or a specialist.]
- **Take this with you:** [Checklist fields; no passwords or identifying client records.]
- **Provider guidance:** [Exact maintained reference URL where useful; no fabricated citation.]
- **CTA:** Download checklist. Plain text. Free. No email needed.

## K. Ten complete initial Fix Library entries


---

### 01. An employee’s email looks compromised.

**Category:** Email & access · Editorial review: 28 October 2026

**Contain the problem without losing the evidence.**

**Does this sound familiar?**
- Unexpected forwarding rules, sent messages or sign-in alerts.
- A supplier receives a payment request that your team did not send.

**Your immediate action:** Use a known-clean device and contact your current IT or email provider through a trusted channel. If money may have moved, call the bank immediately using a known number. Do not wait for this consultancy’s reply.

**A practical next sequence:**
1. Have an authorised administrator secure the account, reset access and revoke active sessions using provider guidance.
2. Review forwarding rules, delegated access, recovery methods and other affected accounts. Preserve relevant logs and messages.
3. Notify the appropriate business decision-maker; assess privacy, reporting and financial obligations with qualified help.

**What might it take?** Routine prevention planning: CAD 0–150 in internal time/tools. Active incident-response costs are case-specific and cannot be estimated here.

Planning allowances only. Internal time is not a fee quote. Vendor terms, data volume and licences can change the cost.

**When to call someone:** Use your bank and a qualified incident-response provider for active fraud or compromise. Maple can help review a non-emergency workflow after containment, if within scope.

**Working checklist:**
- [ ] Incident lead and trusted contact number
- [ ] First observed time, timezone and symptoms
- [ ] Affected accounts and business systems
- [ ] Actions taken, evidence location and next review

**Provider guidance:** [Microsoft: respond to a compromised email account](https://learn.microsoft.com/en-us/defender-office-365/responding-to-a-compromised-email-account). Check current account features and terms.

**CTA:** Download checklist. Plain text. Free. No email needed.

---

### 02. Move shared files without moving the mess.

**Category:** Files & teamwork · Editorial review: 28 October 2026

**A small SharePoint pilot beats a big-bang migration.**

**Does this sound familiar?**
- People email attachments because nobody knows which copy is current.
- A personal account owns important business files.

**Your immediate action:** Choose one low-risk folder, an owner and two pilot users. Do not move the whole business on day one.

**A practical next sequence:**
1. Inventory ownership, permissions, file types and any retention obligations.
2. Agree a simple folder structure and test read/edit access with named accounts.
3. Test version recovery, document the workflow and keep originals until acceptance. Plan a supported migration for the rest.

**What might it take?** Pilot allowance: CAD 0–300 in existing tools and internal effort. Additional licences and a full migration are excluded; paid help may fit the draft Fix Sprint range.

Planning allowances only. Internal time is not a fee quote. Vendor terms, data volume and licences can change the cost.

**When to call someone:** Call before moving sensitive data, complex permissions or a large folder tree. A migration needs a written scope and rollback plan.

**Working checklist:**
- [ ] Folder and business owner
- [ ] Who may read and who may edit
- [ ] Pilot success checks
- [ ] Original location, rollback owner and acceptance date

**Provider guidance:** [Microsoft: migration guidance](https://learn.microsoft.com/en-us/sharepointmigration/migrate-to-sharepoint-online). Check current account features and terms.

**CTA:** Download checklist. Plain text. Free. No email needed.

---

### 03. Your POS and accounting totals don’t match.

**Category:** Data & reporting · Editorial review: 28 October 2026

**Find the first difference, not another spreadsheet patch.**

**Does this sound familiar?**
- Sales and settlement totals disagree.
- Someone retypes daily figures to make the report balance.

**Your immediate action:** Compare a single closed trading day using the same timezone and reporting basis. Keep raw exports unchanged.

**A practical next sequence:**
1. Separate gross sales, tax, refunds, tips, fees and settlement timing.
2. Match stable transaction identifiers and mark duplicates or missing rows.
3. Ask your bookkeeper to confirm accounting treatment before changing mappings or building automation.

**What might it take?** Sample reconciliation allowance: CAD 0–250 in internal effort/tools. Professional accounting advice and implementation are separate; a bounded repair may fit a draft Fix Sprint.

Planning allowances only. Internal time is not a fee quote. Vendor terms, data volume and licences can change the cost.

**When to call someone:** Call for repeatable data cleanup or integration work once the accounting rules are confirmed. Financial sign-off belongs with your qualified accountant.

**Working checklist:**
- [ ] System and export date range
- [ ] Gross sales, tax, refunds and fees
- [ ] Transaction ID and unmatched amount
- [ ] Business owner and accounting decision

**CTA:** Download checklist. Plain text. Free. No email needed.

---

### 04. Is Microsoft 365 sync enough of a backup?

**Category:** Files & teamwork · Editorial review: 28 October 2026

**Start with what you can actually restore.**

**Does this sound familiar?**
- The team assumes OneDrive sync protects against every loss.
- Nobody has rehearsed a restore or checked the retention settings.

**Your immediate action:** Pick one non-sensitive sample file and test the supported recovery method into a separate location. Never overwrite the only original as a test.

**A practical next sequence:**
1. Record the recovery window, covered workloads, exclusions and who has authority.
2. Compare deletion, version history and retention features with your actual recovery needs.
3. Review separate backup options and test them where the existing protection does not meet those needs.

**What might it take?** Initial test: CAD 0 where existing recovery features cover it. Optional backup-tool planning allowance: CAD 0–200/month for a small team; obtain a vendor quote for actual users and storage.

Planning allowances only. Internal time is not a fee quote. Vendor terms, data volume and licences can change the cost.

**When to call someone:** Call when recovery ownership is unclear or you need a documented plan. A full disaster-recovery programme is a separate specialist scope.

**Working checklist:**
- [ ] Data or workload covered
- [ ] Recovery point and retention period
- [ ] Test file, separate restore location and result
- [ ] Owner and next test date

**Provider guidance:** [Microsoft: Microsoft 365 Backup overview](https://learn.microsoft.com/en-us/microsoft-365/backup/backup-overview). Check current account features and terms.

**CTA:** Download checklist. Plain text. Free. No email needed.

---

### 05. Can the team put client data into AI?

**Category:** AI & decisions · Editorial review: 28 October 2026

**A useful boundary comes before another tool.**

**Does this sound familiar?**
- Staff paste customer details into personal AI accounts.
- Nobody knows the provider’s retention, training or access terms.

**Your immediate action:** Pause confidential-data uploads into unapproved tools. Experiment with invented information while an authorised owner reviews the proposed use.

**A practical next sequence:**
1. Classify the information and consider whether the task needs personal data at all.
2. Check applicable obligations, client commitments and the provider’s current account-specific terms and controls.
3. Approve defined uses, set a human review step and document how to raise a concern.

**What might it take?** Initial rules draft: CAD 0–300 in internal effort. Paid tool seats, privacy/legal advice and any contractual review are extra.

Planning allowances only. Internal time is not a fee quote. Vendor terms, data volume and licences can change the cost.

**When to call someone:** Get qualified privacy/legal advice for sensitive or regulated information. Maple can help document an approved workflow, not certify every AI use as compliant.

**Working checklist:**
- [ ] Allowed use and approved tool/account
- [ ] Information that must not be entered
- [ ] Who reviews terms and outputs
- [ ] Approval owner and review date

**CTA:** Download checklist. Plain text. Free. No email needed.

---

### 06. A password manager for a team of twelve.

**Category:** Email & access · Editorial review: 28 October 2026

**Set up ownership and recovery, not just twelve accounts.**

**Does this sound familiar?**
- Passwords are shared in messages or spreadsheets.
- A departing employee still knows a shared login.

**Your immediate action:** Choose an organisation-managed trial with a non-critical account. Name two authorised recovery owners and plan the MFA rollout before migrating everything.

**A practical next sequence:**
1. Check organisational ownership, named access, export and recovery options.
2. Roll out to a small pilot; store recovery information separately and securely.
3. Create joining/leaving checklists and replace shared credentials where named access is possible. Never email a password export.

**What might it take?** Provisional licence allowance: CAD 3–15 per person/month, not a vendor quote. Setup and training may fit a scoped Tune-Up or Fix Sprint; confirm current vendor pricing.

Planning allowances only. Internal time is not a fee quote. Vendor terms, data volume and licences can change the cost.

**When to call someone:** Call if shared logins and recovery ownership need untangling. Privileged access and regulated environments may require a specialist.

**Working checklist:**
- [ ] Tool owner and authorised recovery owners
- [ ] Pilot users and MFA check
- [ ] Joiner/leaver access checklist
- [ ] Secure recovery location—not the recovery secret

**Provider guidance:** [CISA: strong passwords and password managers](https://www.cisa.gov/secure-our-world/use-strong-passwords). Check current account features and terms.

**CTA:** Download checklist. Plain text. Free. No email needed.

---

### 07. The weekly Excel report takes half a day.

**Category:** Data & reporting · Editorial review: 28 October 2026

**Make one repeatable report before buying another platform.**

**Does this sound familiar?**
- Copy-and-paste work repeats every week.
- Formulas break when a new month or staff member is added.

**Your immediate action:** Save an untouched source copy. Write down each manual step and the decision the finished report supports.

**A practical next sequence:**
1. Use consistent input columns, types and naming; separate source data from calculations.
2. Build one repeatable transformation with appropriate Excel features, and test totals against a known sample.
3. Document refresh steps and train the person who will run it. Add a check for missing or unexpected data.

**What might it take?** Initial cleanup or learning allowance: CAD 0–300 using an existing licence. A repeatable report build may fit the proposed CAD 1,200–3,000 Fix Sprint range.

Planning allowances only. Internal time is not a fee quote. Vendor terms, data volume and licences can change the cost.

**When to call someone:** Call when the workflow is repeatable but fragile, or your team wants hands-on Excel training. A new platform is not automatically the answer.

**Working checklist:**
- [ ] Inputs and responsible owner
- [ ] Manual steps and expected output
- [ ] Control totals and exception checks
- [ ] Refresh instructions and handoff person

**CTA:** Download checklist. Plain text. Free. No email needed.

---

### 08. Too many subscriptions. No clear owner.

**Category:** AI & decisions · Editorial review: 28 October 2026

**Know what you own before buying or cancelling.**

**Does this sound familiar?**
- Renewals surprise the business.
- Two tools appear to do the same job, but nobody is sure.

**Your immediate action:** Make a list from invoices and named business owners. Do not cancel an unfamiliar tool until you know which workflow and data depend on it.

**A practical next sequence:**
1. Record purpose, owner, renewal, access and data-export options—never passwords.
2. Flag duplicates and tools that have no owner, then confirm usage with the team.
3. Trial a change, export necessary records lawfully and document the agreed cancellation or renewal.

**What might it take?** Inventory allowance: CAD 0–200 using a spreadsheet. A proposed CAD 450–900 Tech Tune-Up can help prioritise one workflow; cancellation fees are extra.

Planning allowances only. Internal time is not a fee quote. Vendor terms, data volume and licences can change the cost.

**When to call someone:** Call when the business needs a neutral second opinion on buying, keeping or simplifying tools.

**Working checklist:**
- [ ] Tool, business purpose and owner
- [ ] Renewal and contract notice dates
- [ ] Dependencies, data location and export option
- [ ] Decision, approver and next review

**CTA:** Download checklist. Plain text. Free. No email needed.

---

### 09. Your customer list has three versions.

**Category:** Data & reporting · Editorial review: 28 October 2026

**Agree the source of truth before merging anything.**

**Does this sound familiar?**
- Sales and finance use different customer records.
- Duplicate contacts cause repeated messages or missing history.

**Your immediate action:** Take an authorised backup/export and work on a small copy. Decide who can approve changes before deduplicating.

**A practical next sequence:**
1. Define a stable identifier and agree which system owns each important field.
2. Test merge rules on a small sample and preserve relevant history and consent records.
3. Check results with the owner, record exceptions and agree a repeatable import process.

**What might it take?** Small-sample planning allowance: CAD 0–300 with existing tools. A production cleanup/import may fit a Fix Sprint; CRM licences and broader migration are excluded.

Planning allowances only. Internal time is not a fee quote. Vendor terms, data volume and licences can change the cost.

**When to call someone:** Call for conflicting systems or a repeatable import. Legal retention and marketing-consent decisions need the appropriate business or legal owner.

**Working checklist:**
- [ ] Source of truth by field
- [ ] Match rule and exception owner
- [ ] Sample records and validation result
- [ ] Backup location and rollback decision

**CTA:** Download checklist. Plain text. Free. No email needed.

---

### 10. Your website form has stopped bringing enquiries.

**Category:** Websites & software · Editorial review: 28 October 2026

**Test the whole journey, not just the green tick.**

**Does this sound familiar?**
- Visitors see a success message but nothing reaches the inbox.
- The contact form fails on a phone or lands in spam.

**Your immediate action:** Send a clearly labelled fictional test from a phone and desktop. Check the receiving inbox and spam folder; do not send real client details during a test.

**A practical next sequence:**
1. Check form validation, delivery configuration and provider logs without exposing secrets.
2. Confirm successful receipt, error handling and an obvious alternative contact method.
3. Minimise collected fields, document retention and set a periodic delivery check.

**What might it take?** Initial test allowance: CAD 0–100 with current tools. A bounded repair may fit the draft Fix Sprint range; hosting, email and third-party charges are extra.

Planning allowances only. Internal time is not a fee quote. Vendor terms, data volume and licences can change the cost.

**When to call someone:** Call if delivery is unreliable or the site needs a maintainable repair. Do not send account passwords or production secrets in the enquiry.

**Working checklist:**
- [ ] Test time, device and fictional test marker
- [ ] Submission result and actual inbox receipt
- [ ] Failure behaviour and alternative contact
- [ ] Owner, provider and next test date

**CTA:** Download checklist. Plain text. Free. No email needed.

---

## L. Trust-footer language and facts that remain unconfirmed

**Privacy headline:** Your business details are not the product.

**Boundary:** This note describes the actual behaviour of this Phase 1 preview. It is not a promise about a future booking service, analytics integration or every client engagement.

**Tool behaviour:** Your choices are processed in this browser tab. This site does not send them to a scoring server, save them to browser storage or require an email. Refreshing clears the working answers.

**Contact behaviour:** The form prepares an email in your own email app; it does not submit to a website inbox or promise delivery. If you send email, the email providers and recipient will process it under their own arrangements.

**Security boundary:** Do not include passwords, access codes, confidential attachments or other people’s identifying information. The consultancy can request appropriate access later through an agreed secure method.

**Hosting/retention:** A production host, email-retention schedule, service-provider list and any operational analytics must be confirmed before public launch. No unverified hosting region, backup-expiry period or email-deletion guarantee is claimed here.

**Insurance:** Insurance details have not been provided for this website. No coverage, insurer, insured amount or certification is claimed. Ask for current documentation and confirm that the specific engagement is covered before relying on it.

**Privacy contact:** Write to Maple Dominion Consulting Inc. at contact@mapledominionconsult.com. Do not send sensitive identity documents in your first message.

**Never invent:** approved prices, client results, testimonials, team size, accreditation, insurance coverage, product markets, public links or available calendar slots.



---

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


---

# 4. Visual direction and responsive system

## Character

A useful independent consultancy, not a generic corporate agency. The visual language is editorial, warm, grounded and calm: generous paper-like space, practical cards, visible boundaries, local typography and one strong orange accent. It should feel as easy to understand as the advice.

ZikZag Home 3 contributes **section rhythm**: strong opening, compact value strip, differentiated benefits, a clear philosophy/process, product portfolio, pricing and contact. Maple substitutes inspectable evidence for the reference’s testimonial rhetoric. No animated hero, copied composition, stock team, borrowed client logo, fake count or decorative chatbot.

## Colour tokens

| Token | Value | Use |
|---|---|---|
| Brand orange | `#E25112` | Main CTA fill, rules, decorative icons, highlights |
| Accessible orange | `#AC3808` | Small links, eyebrow labels, selected states, emphasized words |
| Ink | `#131713` | Text on paper and orange buttons |
| Paper | `#FBFAF7` | Main canvas |
| White | `#FFFFFF` | Working cards and form surfaces |
| Warm neutral | `#F1EFE8` | Benefits, supporting information |
| Intake peach | `#F2E6D8` | Static diagnostic intake card |
| Muted text | `#62645C` | Supporting copy with tested contrast |
| Hairline | `#DCDCD2` | Section and card boundaries, not sole control affordance |
| Deep charcoal | `#222B27` | Evidence panel and preview status strip |

Do **not** put small white text on brand orange and assume it passes AA. Ink on orange exceeds 4.5:1; accessible orange on paper is about 6.05:1. Muted text on paper is about 5.75:1 and on warm neutral about 5.22:1. Interactive boundaries, input borders, selected states and focus rings are stronger than decorative hairlines.

Decorative product wordmark text also meets its large-text contrast requirement. The original logo is preserved, not recoloured to force a palette match; logo artwork is not used as body text.

## Typography

- **DM Serif Display**, regular: headings, editorial quote and price numerals. Strong character, calm rather than performative.
- **DM Sans**, 400/500/600/700: navigation, body, labels, controls, practical instructions.
- Local WOFF2 assets with `font-display:swap`; both open-font licences are bundled. No runtime Google Fonts call.
- Desktop hero roughly 65px, page H1 up to 68px; H2 roughly 36–46px. Mobile H1 roughly 35–48px depending on available width. Body 16px baseline, supporting copy 13–15px, compact microcopy smaller but deliberately high contrast.
- Small uppercase labels use moderate letter-spacing. Main body copy is sentence case, short and plain-spoken. Never make a label the only explanation for an action.

## Layout, space and components

- Content cap: 1,240px. Desktop gutters: 48px; tablet: 28px; narrow phone: 20px.
- Main vertical spacing: 88px desktop, 65px tablet, 52px phone. Smaller 8/12/16/24/32px steps inside cards and forms.
- Hero: roughly 1.15:1 split, 60px gap. Static intake panel, offset neutral shadow, no motion or photographic stock asset.
- Cards: one-pixel borders, 2–4px corners; avoid glossy gradients and excessive floating shadows. Product logos may have softer corners without changing the card system.
- CTA: at least 44–50px high; clear action verb; charcoal text on brand fill. Secondary: neutral outlined button. Small orange text links use the darker accessible orange.
- Library cards show category, problem, short action promise and a clear next-step link. No author headshot, “read time” filler or blog-like date-led marketing.
- Pricing cards show CAD, range, period and scope together. Never detach a tempting number from exclusions.
- Evidence panel uses charcoal to mark a change of pace; the template is visibly labelled, not disguised as a real result.
- Form controls are full-width in their column with persistent labels, visible required/optional text, helper notes and plain failure/fallback language. Do not replace labels with placeholders.

## Responsive rules

| Width / breakpoint | Adaptation |
|---|---|
| Wide desktop | Two-column hero, three library cards, four pricing cards, two product cards |
| ≤1,200px | Tighter navigation, hero/card gaps and type scale |
| ≤1,000px | Accessible menu toggle, two-column pricing; hero remains a compact split |
| ≤760px | Hero stacks; product cards stack; library two columns where comfortable; process 2×2; picker, contact and report next-step blocks stack |
| ≤500px | Single library/pricing column; context forms stack; quick-win numbers move above content; tighter but readable controls |
| ≤360px | Hero CTAs stack; smaller editorial type; no hidden information |

The mobile page is not a desktop page squeezed smaller. It keeps the same truthful sequence while putting every action in the natural reading flow. Do not use horizontal carousels to hide an engagement or a price exclusion. No essential information depends on hover, animation or a fixed sidebar.

## Accessibility and interaction

- Native links, buttons, radio inputs, selects, checkboxes, fieldsets and legends.
- Logical heading hierarchy, landmark regions, skip-to-content link and visible keyboard focus.
- Menu has an explicit expanded state and Escape behaviour; route navigation closes it.
- Radio selection remains keyboard operable. Next is disabled until a choice exists. Back preserves answers. Main/legend receives deliberate focus after navigation without an animated scroll.
- Search preserves input focus while results update. Result count/status changes are announced without moving the cursor.
- Icon-only controls have names; redundant decoration is hidden from assistive technology. Product logo text has meaningful alternatives.
- Reduced-motion preference suppresses transitions. Hero has no animation in any mode.
- Print stylesheet removes navigation/contact capture while keeping the recommendations and commercial caveats.
- Automated audits are useful evidence, **not** an accessibility certification. Manual screen-reader checks, zoom, forced colours and independent Safari/Firefox testing remain release review items.

## Asset handoff

1. Original supplied `assets/maple-dominion-logo.png`, unchanged, displayed fully in the footer.
2. `assets/maple-mark.png`, leaf crop from the supplied original, used for compact header/favicon alongside accessible company text.
3. Approved existing `assets/yere-logo.png`, contained without distortion.
4. Cart Compare typography is explicitly a placeholder. Replace after the owner supplies its approved logo; do not commission an unrelated substitute without approval.
5. Local font files and licences under `assets/fonts/`.

## What must not creep into the design

No spinning/maple-leaf hero, fake partner strip, “most popular” tier without evidence, scarcity countdown, mandatory-email PDF, cookie banner for trackers that are not present, product-install badge implying an unverified store listing, anonymous five-star quote, insurance shield implying coverage, or uncited Ask Maple AI widget.


---

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


---

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
