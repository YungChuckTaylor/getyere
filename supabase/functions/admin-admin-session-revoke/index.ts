import { jsonResponse, preflight, readJson } from '../_shared/http.ts';
import { auditAdmin, requireAdmin } from '../_shared/admin.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  try {
    const result = await requireAdmin(req, 'super_admin');
    if ('response' in result) return result.response ?? jsonResponse({ error: 'Not found.' }, 404);
    const { context } = result;
    const body = await readJson(req, 3000);
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
    if (!UUID_RE.test(sessionId) || reason.length < 8) {
      return jsonResponse({ error: 'A valid session and reason of at least 8 characters are required.' }, 400);
    }
    const { data: session, error: readError } = await context.admin.from('admin_sessions')
      .select('id,user_id,revoked_at,expires_at').eq('id', sessionId).maybeSingle();
    if (readError) throw readError;
    if (!session) return jsonResponse({ error: 'Admin session not found.' }, 404);
    if (!session.revoked_at) {
      const now = new Date().toISOString();
      const { error: updateError } = await context.admin.from('admin_sessions')
        .update({ revoked_at: now }).eq('id', sessionId).is('revoked_at', null);
      if (updateError) throw updateError;
    }
    await auditAdmin(context, 'admin_session_revoked_by_admin', 'admin_sessions', sessionId, {
      targetAdminId: session.user_id, reason, targetWasCurrent: sessionId === context.sessionId
    });
    return jsonResponse({ ok: true, sessionId, revoked: true });
  } catch (error) {
    console.error('admin-admin-session-revoke:', error);
    return jsonResponse({ error: 'Could not revoke this admin session.' }, 500);
  }
});
