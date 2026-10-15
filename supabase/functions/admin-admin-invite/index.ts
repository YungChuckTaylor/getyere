import { consumeRateLimit, jsonResponse, normalizedEmail, preflight, readJson, safeAppOrigin } from '../_shared/http.ts';
import { requireAdmin } from '../_shared/admin.ts';

const ADMIN_ROLES = new Set(['admin', 'support', 'read_only']);

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  try {
    const result = await requireAdmin(req, 'super_admin');
    if ('response' in result) return result.response ?? jsonResponse({ error: 'Not found.' }, 404);
    const { context } = result;
    if (!(await consumeRateLimit(context.admin, `admin-invite:${context.user.id}`, 'admin-invite', 5, 3600))) {
      return jsonResponse({ error: 'Admin invitation limit reached. Try again later.' }, 429);
    }
    const body = await readJson(req, 4000);
    const email = normalizedEmail(body.email);
    const role = typeof body.role === 'string' ? body.role : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
    if (!email || !ADMIN_ROLES.has(role) || reason.length < 8) {
      return jsonResponse({ error: 'A valid email, non-super-admin role, and reason of at least 8 characters are required.' }, 400);
    }

    const redirectTo = `${safeAppOrigin()}/admin-access?flow=invite`;
    const { data, error } = await context.admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (error) throw error;
    const invitedUser = data.user;
    if (!invitedUser?.id) throw new Error('Auth invitation did not return a user.');

    const { error: roleError } = await context.admin.rpc('set_admin_role', {
      p_actor: context.user.id,
      p_user_id: invitedUser.id,
      p_role: role,
      p_is_active: true,
      p_reason: reason,
      p_ip: context.ip,
      p_user_agent: context.userAgent
    });
    if (roleError) throw roleError;
    return jsonResponse({ ok: true, userId: invitedUser.id, email, role, inviteSent: true });
  } catch (error) {
    console.error('admin-admin-invite:', error);
    return jsonResponse({ error: 'Could not send this admin invitation.' }, 400);
  }
});
