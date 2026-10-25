# Canadian legal-page update — 26 October 2026

Public URLs remain:
- https://getyere.com/privacy-policy
- https://getyere.com/termsofuse — one agreement also called Terms and Conditions.

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
a province, exclusive venue, Canadian incorporation or business address. Consumer
protections, Québec civil-law/language rights, billing disclosures, anti-spam duties
and non-waivable remedies are preserved. No mandatory arbitration or class-action
waiver was added. The service's minimum-age wording now consistently excludes under-14
users in Québec rather than claiming a blanket right to collect their information.
This is a service restriction, not a statement that Canadian law universally sets
14 as the age of consent or that all minors can contract.

## Not a compliance certification

The operator must have a Canadian lawyer review the text against the actual business,
province, user population and provider arrangements. In particular:

- Confirm the legal operator/trade name, business location and legally required contact
  details. They were not supplied; no identity/address was invented. Decide with counsel
  whether a particular governing province/forum should be selected.
- Designate the actual person responsible for privacy, verify the support mailbox is
  monitored, and publish any additional contact details required by the applicable law.
- Ensure access-request deadlines, identity checks, correction, deletion, portability,
  incident records/reporting, retention schedules and processor contracts work in practice.
  This change does not implement new privacy-request automation or audit those processes.
- Verify hosting locations and transfer assessments/agreements, including Québec rules
  where applicable. No Canadian-only data-residency guarantee or completed assessment
  was claimed. Actual provider countries/regions must be confirmed by the operator.
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

## Official references reviewed

- Federal/provincial scope: [7](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda_brief/).
- Meaningful consent: [4](https://www.priv.gc.ca/en/privacy-topics/business-privacy/collecting-personal-information/consent/gl_omc_201805/).
- Access requests: [15](https://www.priv.gc.ca/en/privacy-topics/accessing-personal-information/obligations-for-organizations/02_05_d_54_ati_02/).
- Breach duties: [6](https://www.priv.gc.ca/en/privacy-topics/business-privacy/breaches-and-safeguards/privacy-breaches-at-your-business/gd_pb_201810/).
- CASL consent, identification and unsubscribe: [1](https://crtc.gc.ca/eng/com500/faq500.htm).
- Québec private-sector Act, including sections 4.1, 8, 17 and 27: [Official statute](https://www.legisquebec.gouv.qc.ca/en/document/cs/P-39.1).
- Québec French-language contract guidance: [4](https://cdn-contenu.quebec.ca/cdn-contenu/adm/min/langue-francaise/fr/publications/emissaires/Guide_Contrats.pdf).

## Checks

`npm test`, `npm run build`, `git diff --check`; browser checks for both canonical routes,
legacy redirects in production, contents anchors, mobile/desktop overflow, stylesheet
and branding loads, current dates, Canadian text and absence of Nigerian-law text.
