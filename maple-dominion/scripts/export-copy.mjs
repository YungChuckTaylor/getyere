import fs from 'node:fs/promises';
import {questions,fixes,services,process,PRICING_NOTICE} from '../data.mjs';
const bullets=xs=>xs.map(x=>'- '+x).join('\n');
const sections=[];
sections.push(`# 2. Ready-to-use website copy

**Maple Dominion Consulting Inc. — Practical Tech Clinic for SMBs**  
Copy edition: 28 October 2026. Commercial prices, service hours and timing below are explicitly proposed for owner approval. No hypothetical client outcomes are presented as real.

This is a publishable copy deck, not just a list of headline ideas. It also exports all ten complete Fix Library entries. Working source of truth: \`app.mjs\` and \`data.mjs\`. Regenerate this file with \`npm run docs:copy\` after content edits.

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

${process.map(([n,title,body])=>`**${n}. ${title}:** ${body}`).join('\n\n')}

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
`);
for(const [i,q] of questions.entries())sections.push(`#### ${i+1}. ${q.label}\n\n${q.help}\n\n${q.options.map(([v,t,f])=>`- ${t}${q.weight?` — scoring factor ${f}`:''}`).join('\n')}\n\n${q.weight?`Internal scoring weight: ${q.weight}.`:'No risk-score weighting.'}`);
sections.push(`### Result and interaction copy

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

**Notice:** ${PRICING_NOTICE}

**Picker label:** The engagement picker. **Headline:** What kind of help fits? **Body:** Three choices. A starting point you can question.

**Inputs:** Business size · The problem · How soon do you need a next step?

**Urgency options:** Flexible—I want a sensible plan / I’m hoping to start this week / The business cannot wait today.

**CTA:** Find my starting point

**Scope heading:** Four ways to make progress.

**Scope body:** A written scope sets the actual fee, deliverables, access needs and start date. No checkout. No automatic commitment.
`);
for(const s of services)sections.push(`### ${s.name}\n\n**${s.subtitle}**\n\n**Proposed price:** CAD $${s.low.toLocaleString('en-CA')}–$${s.high.toLocaleString('en-CA')} ${s.period}. **Planning window:** ${s.time}.\n\n**Best for:** ${s.best}\n\n**Included:**\n${bullets(s.includes)}\n\n**Excluded:**\n${bullets(s.excludes)}\n\n**Boundary:** ${s.boundary}\n\n**CTA:** Ask about the scope`);
sections.push(`### Picker fallback and triage language

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
`);
for(const f of fixes)sections.push(`### ${f.number}. ${f.title}\n\n**Category:** ${f.category} · Editorial review: 28 October 2026\n\n**${f.short}**\n\n**Does this sound familiar?**\n${bullets(f.symptoms)}\n\n**Your immediate action:** ${f.immediate}\n\n**A practical next sequence:**\n${f.steps.map((s,i)=>`${i+1}. ${s}`).join('\n')}\n\n**What might it take?** ${f.cost}\n\nPlanning allowances only. Internal time is not a fee quote. Vendor terms, data volume and licences can change the cost.\n\n**When to call someone:** ${f.when}\n\n**Working checklist:**\n${f.template.map(t=>'- [ ] '+t).join('\n')}\n\n${f.source?`**Provider guidance:** [${f.sourceLabel}](${f.source}). Check current account features and terms.\n\n`:''}**CTA:** Download checklist. Plain text. Free. No email needed.`);
sections.push(`## L. Trust-footer language and facts that remain unconfirmed

**Privacy headline:** Your business details are not the product.

**Boundary:** This note describes the actual behaviour of this Phase 1 preview. It is not a promise about a future booking service, analytics integration or every client engagement.

**Tool behaviour:** Your choices are processed in this browser tab. This site does not send them to a scoring server, save them to browser storage or require an email. Refreshing clears the working answers.

**Contact behaviour:** The form prepares an email in your own email app; it does not submit to a website inbox or promise delivery. If you send email, the email providers and recipient will process it under their own arrangements.

**Security boundary:** Do not include passwords, access codes, confidential attachments or other people’s identifying information. The consultancy can request appropriate access later through an agreed secure method.

**Hosting/retention:** A production host, email-retention schedule, service-provider list and any operational analytics must be confirmed before public launch. No unverified hosting region, backup-expiry period or email-deletion guarantee is claimed here.

**Insurance:** Insurance details have not been provided for this website. No coverage, insurer, insured amount or certification is claimed. Ask for current documentation and confirm that the specific engagement is covered before relying on it.

**Privacy contact:** Write to Maple Dominion Consulting Inc. at contact@mapledominionconsult.com. Do not send sensitive identity documents in your first message.

**Never invent:** approved prices, client results, testimonials, team size, accreditation, insurance coverage, product markets, public links or available calendar slots.
`);
await fs.writeFile(new URL('../docs/02-READY-TO-USE-COPY.md',import.meta.url),sections.join('\n\n---\n\n')+'\n');
console.log('Exported complete copy deck and all 10 Fix Library entries.');
