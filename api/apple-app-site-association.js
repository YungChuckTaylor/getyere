// This identifier is PUBLIC, but must match application-identifier in the signed IPA.
// Never substitute an App Store Connect numeric ID or an unverified example Team ID.
export function associationDocument(appIdentifier) {
  if (typeof appIdentifier !== 'string' || !/^[A-Z0-9]{10}\.com\.getyere\.app$/.test(appIdentifier)) return null;
  return {
    applinks: {
      apps: [],
      details: [{
        appIDs: [appIdentifier],
        components: [
          { '/': '/admin*', exclude: true, comment: 'Admin remains a browser-only surface.' },
          { '/': '/api/*', exclude: true },
          { '/': '/privacy*', exclude: true },
          { '/': '/termsofuse*', exclude: true },
          { '/': '/support*', exclude: true },
          { '/': '/', '?': { reminder: '?*' }, comment: 'Reminder emails, including existing root/query links.' },
          { '/': '/', '?': { invite: '?*' }, comment: 'Trusted-contact invitations.' },
          { '/': '/auth/callback', comment: 'Only the app auth callback, not admin recovery.' }
        ]
      }]
    }
  };
}

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'HEAD'].includes(req.method || '')) {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  const document = associationDocument(process.env.APPLE_APP_ID?.trim());
  if (!document) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'Apple app association is awaiting the verified signed app identifier.' });
  }
  res.setHeader('Cache-Control', 'public, max-age=300');
  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).json(document);
}
