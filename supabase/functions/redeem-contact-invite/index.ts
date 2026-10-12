import { adminClient, authenticatedUser, consumeRateLimit, jsonResponse, preflight, readJson, sha256 } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  try {
    const { user, error: authError } = await authenticatedUser(req);
    if (authError || !user) return jsonResponse({ error: 'Sign in before accepting an invitation.' }, 401);
    const body = await readJson(req);
    const isToken = typeof body?.token === 'string' && body.token.length >= 32 && body.token.length <= 128;
    const rawCode = typeof body?.code === 'string' ? body.code : '';
    const normalizedCode = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const type = isToken ? 'link' : 'code';
    const secret = isToken ? body.token.trim() : normalizedCode;
    if ((!isToken && !/^[A-HJ-NP-Z2-9]{8}$/.test(secret)) || (isToken && !/^[A-Za-z0-9_-]{32,128}$/.test(secret))) {
      return jsonResponse({ error: 'That invitation is invalid, expired, or already used.' }, 400);
    }

    const admin = adminClient();
    const { data: security } = await admin.from('workspace_security').select('suspended_until').eq('user_id', user.id).maybeSingle();
    if (security?.suspended_until && new Date(security.suspended_until).getTime() > Date.now()) {
      return jsonResponse({ error: 'Invite redemption is paused for this account after repeated failed attempts.' }, 423);
    }
    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const secretHash = await sha256(secret);
    const [userAllowed, ipAllowed, secretAllowed] = await Promise.all([
      consumeRateLimit(admin, `invite-redeem-user:${user.id}`, 'redeem-invite-user', 12, 3600),
      consumeRateLimit(admin, `invite-redeem-ip:${await sha256(ip)}`, 'redeem-invite-ip', 40, 3600),
      consumeRateLimit(admin, `invite-redeem-secret:${secretHash}`, 'redeem-invite-secret', 8, 3600)
    ]);
    if (!userAllowed || !ipAllowed || !secretAllowed) {
      return jsonResponse({ error: 'Too many invite attempts. Please wait before trying again.' }, 429);
    }
    if (isToken) {
      const { data: targetInvite, error: targetError } = await admin.from('contact_invites').select('invite_type,invited_email').eq('secret_hash',secretHash).maybeSingle();
      if (targetError) throw targetError;
      if (targetInvite?.invite_type==='email'&&targetInvite.invited_email?.toLowerCase()!==(user.email||'').toLowerCase()) {
        await admin.rpc('register_failed_invite_attempt',{p_user_id:user.id});
        return jsonResponse({ error: 'That invitation is invalid, expired, or already used.' },400);
      }
    }

    const { data, error } = await admin.rpc('consume_contact_invite', {
      p_secret_hash: secretHash,
      p_invite_type: type,
      p_contact_user_id: user.id
    });
    if (error) throw error;
    if (!data?.ok) {
      await admin.rpc('register_failed_invite_attempt', { p_user_id: user.id });
      return jsonResponse({ error: 'That invitation is invalid, expired, already used, or unavailable.' }, 400);
    }
    const { data: profile } = await admin.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
    if (profile?.display_name && data.contact_id) {
      await admin.from('contacts').update({ display_name: profile.display_name }).eq('id', data.contact_id).eq('owner_id', data.owner_id);
    }
    return jsonResponse({ ok: true, message: 'Invite accepted. The person who invited you will see your request.' });
  } catch (error) {
    console.error('redeem-contact-invite:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Could not redeem this invitation.' }, 400);
  }
});
