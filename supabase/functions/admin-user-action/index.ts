import { jsonResponse, preflight, readJson } from '../_shared/http.ts';
import { auditAdmin, requireAdmin } from '../_shared/admin.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS = new Set(['ban', 'unban', 'delete']);

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  try {
    const result = await requireAdmin(req, 'admin');
    if ('response' in result) return result.response ?? jsonResponse({ error: 'Not found.' }, 404);
    const { context } = result;
    const body = await readJson(req, 5000);
    const userId = typeof body.userId === 'string' ? body.userId : '';
    const action = typeof body.action === 'string' ? body.action : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
    if (!UUID_RE.test(userId) || !ACTIONS.has(action) || reason.length < 8) {
      return jsonResponse({ error: 'A valid user, action, and reason of at least 8 characters are required.' }, 400);
    }
    if (action === 'delete' && context.role !== 'super_admin') return jsonResponse({ error: 'Not found.' }, 404);
    if (action === 'delete' && body.confirmation !== `DELETE ${userId}`) {
      return jsonResponse({ error: `Type DELETE ${userId} to permanently delete this account.` }, 400);
    }
    const { data: targetAdmin, error: adminLookupError } = await context.admin.from('admin_users')
      .select('user_id').eq('user_id', userId).maybeSingle();
    if (adminLookupError) throw adminLookupError;
    if (targetAdmin) return jsonResponse({ error: 'Use Admin access to deactivate or change an administrator account.' }, 400);

    const actionLabel = action === 'delete' ? 'user_delete' : action === 'ban' ? 'user_ban' : 'user_unban';
    await auditAdmin(context, `${actionLabel}_requested`, 'auth.users', userId, { reason });
    if (action === 'delete') {
      const { error } = await context.admin.auth.admin.deleteUser(userId, false);
      if (error) throw error;
      await auditAdmin(context, 'user_deleted', 'auth.users', userId, { reason });
      return jsonResponse({ ok: true, action, userId });
    }

    const { data, error } = await context.admin.auth.admin.updateUserById(userId, {
      ban_duration: action === 'ban' ? '876600h' : 'none'
    });
    if (error) throw error;
    await auditAdmin(context, action === 'ban' ? 'user_banned' : 'user_unbanned', 'auth.users', userId, {
      reason, bannedUntil: data.user?.banned_until || null
    });
    return jsonResponse({ ok: true, action, userId, bannedUntil: data.user?.banned_until || null });
  } catch (error) {
    console.error('admin-user-action:', error);
    return jsonResponse({ error: 'Could not complete this user action.' }, 500);
  }
});
