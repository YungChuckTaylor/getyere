import { jsonResponse, preflight, readJson } from '../_shared/http.ts';
import { auditAdmin, requireAdmin } from '../_shared/admin.ts';

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  try {
    const result = await requireAdmin(req, 'super_admin');
    if ('response' in result) return result.response ?? jsonResponse({ error: 'Not found.' }, 404);
    const { context } = result;
    const body = await readJson(req, 3000);
    const viewReason = typeof body.viewReason === 'string' ? body.viewReason.trim().slice(0, 500) : '';
    if (viewReason.length < 8) return jsonResponse({ error: 'A view reason of at least 8 characters is required.' }, 400);

    const [adminsResult, sessionsResult] = await Promise.all([
      context.admin.from('admin_users').select('user_id,role,is_active,created_at,created_by').order('created_at', { ascending: true }).limit(200),
      context.admin.from('admin_sessions').select('id,user_id,ip,user_agent,created_at,last_seen_at,expires_at,revoked_at')
        .is('revoked_at', null).gt('expires_at', new Date().toISOString()).order('last_seen_at', { ascending: false }).limit(500)
    ]);
    if (adminsResult.error) throw adminsResult.error;
    if (sessionsResult.error) throw sessionsResult.error;
    const ids = [...new Set([...(adminsResult.data || []).map((row) => row.user_id), ...(sessionsResult.data || []).map((row) => row.user_id)])];
    const users = await Promise.all(ids.map(async (id) => {
      const { data, error } = await context.admin.auth.admin.getUserById(id);
      if (error) return [id, null] as const;
      return [id, { email: data.user?.email || null, lastSignInAt: data.user?.last_sign_in_at || null }] as const;
    }));
    const userById = new Map(users);
    const admins = (adminsResult.data || []).map((row) => ({
      ...row, email: userById.get(row.user_id)?.email || null,
      lastSignInAt: userById.get(row.user_id)?.lastSignInAt || null
    }));
    const sessions = (sessionsResult.data || []).map((row) => ({
      ...row, email: userById.get(row.user_id)?.email || null,
      isCurrent: row.id === context.sessionId
    }));
    await auditAdmin(context, 'view_admin_users_and_sessions', 'admin_users', null, { viewReason });
    return jsonResponse({ admins, sessions });
  } catch (error) {
    console.error('admin-admin-list:', error);
    return jsonResponse({ error: 'Could not load admin accounts and sessions.' }, 500);
  }
});
