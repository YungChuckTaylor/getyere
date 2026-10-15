import { adminClient, authenticatedUser, consumeRateLimit, jsonResponse, preflight, sha256 } from '../_shared/http.ts';
import { aalFromVerifiedToken, accessTokenFromRequest, mfaRequired, requestIp, validateAdminIdentity } from '../_shared/admin.ts';

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  try {
    const ip = requestIp(req) || 'unknown';
    const admin = adminClient();
    if (!(await consumeRateLimit(admin, `admin-login-ip:${ip}`, 'admin-login', 10, 900))) {
      return jsonResponse({ error: 'Too many login attempts. Try again later.' }, 429);
    }
    const identity = await validateAdminIdentity(req, false);
    if ('response' in identity) return identity.response ?? jsonResponse({ error: 'Not found.' }, 404);
    if (!(await consumeRateLimit(admin, `admin-login-user:${identity.user.id}`, 'admin-login-user', 10, 900))) {
      return jsonResponse({ error: 'Too many login attempts. Try again later.' }, 429);
    }
    const token = accessTokenFromRequest(req);
    const aal = aalFromVerifiedToken(token);
    if (mfaRequired(identity.role) && aal !== 'aal2') {
      return jsonResponse({ error: 'Complete your authenticator check to continue.', code: 'mfa_required' }, 403);
    }
    if (aal !== 'aal1' && aal !== 'aal2') return jsonResponse({ error: 'The authentication level is not supported.' }, 401);

    const previousToken = req.headers.get('x-yere-previous-admin-token') || '';
    if (previousToken && previousToken !== token) {
      const previousHash = await sha256(previousToken);
      await admin.from('admin_sessions').update({ revoked_at: new Date().toISOString() })
        .eq('user_id', identity.user.id).eq('token_hash', previousHash).is('revoked_at', null);
    }

    const tokenHash = await sha256(token);
    const { data: existing, error: existingError } = await admin.from('admin_sessions')
      .select('id,revoked_at,expires_at').eq('user_id', identity.user.id).eq('token_hash', tokenHash).maybeSingle();
    if (existingError) throw existingError;
    if (existing?.revoked_at || (existing && new Date(existing.expires_at).getTime() <= Date.now())) {
      return jsonResponse({ error: 'This session cannot be reactivated. Sign in again.' }, 401);
    }

    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    const userAgent = (req.headers.get('user-agent') || '').slice(0, 512) || null;
    let sessionId = existing?.id;
    if (existing) {
      const { error } = await admin.from('admin_sessions').update({ last_seen_at: new Date().toISOString(), expires_at: expiresAt, ip, user_agent: userAgent }).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { data, error } = await admin.from('admin_sessions').insert({
        user_id: identity.user.id, token_hash: tokenHash, ip, user_agent: userAgent, expires_at: expiresAt
      }).select('id').single();
      if (error || !data) throw error || new Error('Could not create admin session.');
      sessionId = data.id;
    }
    const { error: auditError } = await admin.from('admin_audit_logs').insert({
      admin_id: identity.user.id, action: 'admin_session_started', target_table: 'admin_sessions', target_id: sessionId,
      metadata: { role: identity.role, aal }, ip, user_agent: userAgent
    });
    if (auditError) {
      await admin.from('admin_sessions').update({ revoked_at: new Date().toISOString() }).eq('id', sessionId);
      throw auditError;
    }
    return jsonResponse({ ok: true, role: identity.role, expiresAt });
  } catch (error) {
    console.error('admin-session-create:', error);
    return jsonResponse({ error: 'Admin sign-in could not be completed.' }, 500);
  }
});
