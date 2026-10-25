# Canadian legal/support update — published 25 October 2026 (Toronto)

Public URLs remain:
- https://getyere.com/privacy-policy
- https://getyere.com/termsofuse — one agreement also called Terms and Conditions.
- https://getyere.com/support.html

The HTML files, canonical links, local/Vercel rewrites, legacy redirects, app links,
branding and responsive legal-page design are retained. This is a legal-copy change,
not a change to notification, authentication, billing or backend behavior.

## Changes

Removed Nigerian governing-law, NDPA and Nigerian-regulator references from both legal
pages. Privacy now addresses PIPEDA where applicable, provincial private-sector law,
meaningful consent, access/correction, complaints, conditional portability/deletion,
processing outside Canada, incidents and CASL. Existing explanations of actual auth,
voice processing, providers, local/offline copies, retention and deletion remain.

Terms now use applicable Canadian federal/provincial/territorial law without inventing
a province, exclusive venue or Canadian incorporation. The follow-up publishes the
user-supplied Ontario business address without treating it as a governing-law selection. Consumer
protections, Québec civil-law/language rights, billing disclosures, anti-spam duties
and non-waivable remedies are preserved. No mandatory arbitration or class-action
waiver was added. The service's minimum-age wording now consistently excludes under-14
users in Québec rather than claiming a blanket right to collect their information.
This is a service restriction, not a statement that Canadian law universally sets
14 as the age of consent or that all minors can contract.

## Not a compliance certification

The operator must have a Canadian lawyer review the text against the actual business,
province, user population and provider arrangements. In particular:

- **Still required: full legal operator name/entity.** Only the service name Yere is
  known. The user supplied the business mailing address: 1004 Kicking Horse Path,
  Oshawa, Ontario L1J 0B4, Canada. It is now identical across privacy, terms and
  support; it does not establish incorporation or identify the contracting legal person.
  No company suffix, personal name or governing-law selection was inferred from it.
- Privacy enquiries are explicitly routed to **Privacy Officer — person responsible
  for the protection of personal information**, support@getyere.com and the supplied
  postal address on all three pages. The operator must still confirm the actual
  responsible person/delegation and mailbox monitoring. No named officer, staffing
  hours, response-time guarantee or continuous monitoring was invented.
- Ensure access-request deadlines, identity checks, correction, deletion, portability,
  incident records/reporting, retention schedules and processor contracts work in practice.
  This change does not implement new privacy-request automation or audit those processes.
- Verify hosting locations and transfer assessments/agreements, including Québec rules
  where applicable. No Canadian-only data-residency guarantee or completed assessment
  was claimed. Read-only production metadata confirms the Supabase database project
  region `eu-west-1` (Ireland) and Vercel function region `iad1` (United States); the
  policy names these but does not present them as an exhaustive provider/country list.
  Other processing locations and transfer assessments/agreements still need review.
- Assess Québec French-language requirements. No French translation or French-first
  contracting/consent flow was implemented by this copy change. A rights-preservation
  sentence is not a substitute for those obligations.
- Align actual age/consent handling and store audience disclosures with the service's
  eligibility limits; no age verification or parental-consent collection was added.
- Before sending marketing or covered invitations, verify the actual CASL consent,
  sender identity/mailing address, unsubscribe and suppression mechanisms. No marketing
  system or consent capture was added; accepting terms is not marketing opt-in.
- Give existing users any legally required material-change notice and obtain agreement
  or consent where required. Merely changing the date on the site does not do that.
- If paid features are introduced, verify real pricing/tax/renewal/cancellation/refund
  flows and province-specific disclosure requirements, not just these conditional terms.

The documents are Canadian-focused drafts published at the user's request; tests prove
copy/routes/layout, not legal compliance or that the operational duties are fulfilled.

## Follow-up implementation and evidence

- Last updated **25 October 2026, Toronto** is separate from the announced effective
  date **26 October 2026, Toronto**. The actual publishing clock was checked in
  `America/Toronto`, not inferred from the agent's Lagos local date. Existing users'
  required notice/consent process is explicitly not replaced by that effective date.
  No email amendment campaign or re-acceptance flow was sent/implemented here.
- Terms §§3/13 replace broad unilateral-change powers with specified non-essential
  elements, 30-day advance written email notice containing only clause/date/rights
  details, and a manual email refusal/cancellation route (including the 30-day
  post-effective window for adverse amendments). Essential changes require express
  agreement. These are commitments the operator must fulfil, not proof of an
  automated notice/cancellation system. No billing system was added.
- Terms §11 explicitly preserves Québec protections against exoneration for the
  merchant's own acts. French rights are not presented as an implemented French-first
  contracting process. Whether Québec is included at launch is still unanswered;
  neither a translation/contracting rollout nor a geographic block was implemented.
- Privacy §7 separates active account/workspace data, notification/security/audit
  logs, support/legal records, backups and device/recipient copies. It gives
  category-specific necessity criteria without inventing expiry periods. A fixed
  provider backup window and enforced log-purge schedule remain **unverified**;
  this edit does not create a retention job or make indefinite retention lawful.
- Source review: `delete-account` removes attachment paths, calls the detach RPC,
  then deletes the auth user. Its attachment lookup currently caps at **5,000**;
  complete removal for a very large account needs a separate backend review/fix.
  No destructive production deletion test was performed or authorized.
- Read-only production foreign-key metadata confirms account-linked support tickets
  cascade on deletion, but notification-log account/reminder references use SET NULL.
  Source schema retains administrative audit entries without an account foreign key.
  The detach RPC preserves reminders belonging to a recipient and removes contact
  relationships. These findings explain the support/retention qualifications; they
  do not prove every historical row, file, email or backup is erased in practice.
- Support now distinguishes deletion targeting **active cloud data** from retained
  records, backups and recipient/device copies. It says **online does not mean
  synced**, asks users to verify recent edits before sign-out/clearing/reinstall,
  and provides trusted-contact help, safer bug-report details and realistic email
  support/emergency expectations. No support SLA was asserted.

### Operator follow-through (not completed by copy changes)

1. Supply the full contracting legal name and confirm the responsible privacy officer.
2. Decide Québec launch scope; obtain advice and implement French-first contracting,
   transfer assessments and required agreements before the relevant activity.
3. Verify actual backup configurations and adopt/enforce a category-specific retention
   schedule, log expiry, review/holds and deletion verification (including large accounts).
4. Staff the published privacy/cancellation inbox; handle notice delivery, consent,
   requests, cancellations and any refunds in practice. Check notice requirements for
   existing users before treating this revision as binding on them.

## Official references reviewed

- Federal/provincial scope: [7](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda_brief/).
- Meaningful consent: [4](https://www.priv.gc.ca/en/privacy-topics/business-privacy/collecting-personal-information/consent/gl_omc_201805/).
- Access requests: [15](https://www.priv.gc.ca/en/privacy-topics/accessing-personal-information/obligations-for-organizations/02_05_d_54_ati_02/).
- Breach duties: [6](https://www.priv.gc.ca/en/privacy-topics/business-privacy/breaches-and-safeguards/privacy-breaches-at-your-business/gd_pb_201810/).
- CASL consent, identification and unsubscribe: [1](https://crtc.gc.ca/eng/com500/faq500.htm).
- Québec private-sector Act, including sections 4.1, 8, 17 and 27: [Official statute](https://www.legisquebec.gouv.qc.ca/en/document/cs/P-39.1).
- Québec French-language contract guidance: [4](https://cdn-contenu.quebec.ca/cdn-contenu/adm/min/langue-francaise/fr/publications/emissaires/Guide_Contrats.pdf).

- Québec Consumer Protection Act §§10, 11.1–11.4: [Official statute](https://www.legisquebec.gouv.qc.ca/en/document/cs/P-40.1), current official text fetched 25 October 2026 (Toronto); §11.2 checked in full for notice, cancellation and essential-element limits.

## Checks

`npm test`, `npm run build`, `git diff --check`; browser checks for both canonical legal routes and support,
legacy redirects in production, contents anchors, mobile/desktop overflow, stylesheet
and branding loads, current dates, Canadian text and absence of Nigerian-law text.
