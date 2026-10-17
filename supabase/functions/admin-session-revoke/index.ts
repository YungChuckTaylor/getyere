import { adminClient, authenticatedUser, jsonResponse, preflight, sha256 } from '../_shared/http.ts';
import { accessTokenFromRequest, requestIp } from '../_shared/admin.ts';

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  try {
    const token = accessTokenFromRequest(req);
    const { user, error } = await authenticatedUser(req);
    if (!token || error || !user) return jsonResponse({ error: 'Not found.' }, 404);
    const admin = adminClient();
    const tokenHash = await sha256(token);
    const { data: session, error: sessionError } = await admin.from('admin_sessions')
      .select('id').eq('user_id', user.id).eq('token_hash', tokenHash).is('revoked_at', null).maybeSingle();
    if (sessionError) throw sessionError;
    if (session) {
      const now = new Date().toISOString();
      const { error: revokeError } = await admin.from('admin_sessions').update({ revoked_at: now }).eq('id', session.id);
      if (revokeError) throw revokeError;
      const { error: auditError } = await admin.from('admin_audit_logs').insert({
        admin_id: user.id, action: 'admin_session_revoked', target_table: 'admin_sessions', target_id: session.id,
        metadata: {}, ip: requestIp(req), user_agent: (req.headers.get('user-agent') || '').slice(0, 512) || null
      });
      if (auditError) throw auditError;
    }
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error('admin-session-revoke:', error);
    return jsonResponse({ error: 'Could not revoke the admin session.' }, 500);
  }
});
