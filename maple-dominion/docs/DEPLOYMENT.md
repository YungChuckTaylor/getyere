# Vercel deployment record

Updated 28 October 2026.

## Confirmed live review site

**https://maple-dominion-clinic.vercel.app/**

Dashboard: https://vercel.com/lucrobusiness/maple-dominion-clinic

- Vercel team: Lucro (`team_HVTVlMkiUWNL9T06j4m1Xdvd`).
- Separate project: `maple-dominion-clinic` (`prj_uk5Zu4vTl9I5PVbhSRwXo9F52aDG`).
- Deployment: `dpl_CsBZGm2nnzHfK1YagMLtgWgcpM4k`, status **READY / PROMOTED**, target production in this separate project.
- Deployed source: `b27345772bae5074ef3b8a8049140d0a2be2c689` from the session branch `arena/8b4b1ec0-getyere`.
- Repository: `YungChuckTaylor/getyere`; project root: `maple-dominion` only.
- Build: `node scripts/build-static.mjs`. Output: `site`. No npm installation required on Vercel; no runtime/backend dependency, secret or Supabase project required.
- Public homepage, Fix Library and Tech Check routes were independently fetched and rendered successfully without Vercel sign-in.
- The exact static build output also passed the browser suite locally: 84 responsive checks, 29 axe audits, zero runtime exceptions and no unexpected remote HTTP calls. This is distinct from claiming a complete interactive audit on the hosted URL.

## Boundaries preserved

- Existing `mapledominionconsult.com` domain/DNS/site was not changed or transferred.
- Existing Yere project, production domains and Supabase resources were not changed.
- Yere's production deployment remained `dpl_GLWW8PWhhanLiYumvdmsa9DCxvsg` after this deployment.
- Before publishing the Maple-only commit, all previously published non-Maple files were checked byte-for-byte against the existing remote branch. No Yere changes were included, no files were overwritten and the remote branch was advanced without a force push.
- Prices remain visibly proposed; Fix Log remains empty; requests remain email drafts rather than confirmed bookings.
- `noindex, nofollow` remains in HTML and HTTP headers. A live review URL is not approval to advertise unapproved rates or remove the review notices.

## Future releases

The new project's Git provider reports automatic deployments **disabled**. Its default Git production branch is `main`, but this release was explicitly deployed from the exact session-branch commit above. Do not assume a push to this session branch—or a change to Yere—will update Maple production.

For an approved update: build/test the Maple subfolder, commit and push only the session branch, then explicitly create a production deployment in **this Maple project** using the approved exact SHA. Do not switch branches or change the existing Yere production-branch setting. Changing automatic deployment policy or mapping the existing Maple custom domain is separate follow-up work.

Private immutable deployment URLs may be subject to the account's normal Vercel protection. Share the confirmed stable public project URL above, not a protected build URL or preview access token.

The original planning documents describe the pre-hosting design/review state; this record supersedes any statement that the separate Vercel review deployment has not yet happened. Their commercial, evidence, privacy and existing-domain approval gates otherwise remain in place.
