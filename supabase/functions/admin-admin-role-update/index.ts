import { consumeRateLimit, jsonResponse, preflight, readJson } from '../_shared/http.ts';
import { requireAdmin } from '../_shared/admin.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ADMIN_ROLES = new Set(['super_admin', 'admin', 'support', 'read_only']);

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  try {
    const result = await requireAdmin(req, 'super_admin');
    if ('response' in result) return result.response ?? jsonResponse({ error: 'Not found.' }, 404);
    const { context } = result;
    if (!(await consumeRateLimit(context.admin, `admin-role-change:${context.user.id}`, 'admin-role-change', 20, 3600))) {
      return jsonResponse({ error: 'Admin role-change limit reached. Try again later.' }, 429);
    }
    const body = await readJson(req, 4000);
    const userId = typeof body.userId === 'string' ? body.userId : '';
    const role = typeof body.role === 'string' ? body.role : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
    if (!UUID_RE.test(userId) || !ADMIN_ROLES.has(role) || typeof body.isActive !== 'boolean' || reason.length < 8) {
      return jsonResponse({ error: 'A valid account, role, active state, and reason of at least 8 characters are required.' }, 400);
    }
    const { error } = await context.admin.rpc('set_admin_role', {
      p_actor: context.user.id,
      p_user_id: userId,
      p_role: role,
      p_is_active: body.isActive,
      p_reason: reason,
      p_ip: context.ip,
      p_user_agent: context.userAgent
    });
    if (error) throw error;
    return jsonResponse({ ok: true, userId, role, isActive: body.isActive });
  } catch (error) {
    console.error('admin-admin-role-update:', error);
    return jsonResponse({ error: 'Could not update this admin account. The last active super admin cannot be removed.' }, 400);
  }
});
