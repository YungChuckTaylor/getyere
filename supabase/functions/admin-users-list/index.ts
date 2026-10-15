import { jsonResponse, preflight, readJson } from '../_shared/http.ts';
import { auditAdmin, requireAdmin } from '../_shared/admin.ts';

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  try {
    const result = await requireAdmin(req, 'support');
    if ('response' in result) return result.response ?? jsonResponse({ error: 'Not found.' }, 404);
    const { context } = result;
    const body = await readJson(req, 4000);
    const page = Number.isInteger(body.page) ? Math.max(1, Math.min(body.page, 10000)) : 1;
    const perPage = Number.isInteger(body.perPage) ? Math.max(1, Math.min(body.perPage, 100)) : 50;
    const query = typeof body.query === 'string' ? body.query.trim().slice(0, 100).toLowerCase() : '';
    const { data, error } = await context.admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const authUsers = data.users || [];
    const pageIds = authUsers.map((user) => user.id);
    const { data: adminAccounts, error: adminAccountsError } = pageIds.length
      ? await context.admin.from('admin_users').select('user_id').in('user_id', pageIds)
      : { data: [], error: null };
    if (adminAccountsError) throw adminAccountsError;
    const adminIds = new Set((adminAccounts || []).map((account) => account.user_id));
    const visibleUsers = authUsers.filter((user) => !adminIds.has(user.id));
    const ids = visibleUsers.map((user) => user.id);
    const { data: profiles, error: profileError } = ids.length
      ? await context.admin.from('profiles').select('id,display_name,timezone,theme,created_at,updated_at').in('id', ids)
      : { data: [], error: null };
    if (profileError) throw profileError;
    const byId = new Map((profiles || []).map((profile) => [profile.id, profile]));
    const users = visibleUsers.map((user) => {
      const profile = byId.get(user.id);
      return {
        id: user.id,
        email: user.email || null,
        signupAt: user.created_at,
        lastActiveAt: user.last_sign_in_at || null,
        emailConfirmedAt: user.email_confirmed_at || null,
        bannedUntil: user.banned_until && Date.parse(user.banned_until) > Date.now() ? user.banned_until : null,
        displayName: profile?.display_name || user.user_metadata?.display_name || null,
        timezone: profile?.timezone || null,
        theme: profile?.theme || null
      };
    }).filter((user) => !query || [user.email, user.displayName, user.id].some((value) => String(value || '').toLowerCase().includes(query)));
    await auditAdmin(context, 'list_admin_users', 'auth.users', null, { page, perPage, queryPresent: Boolean(query) });
    return jsonResponse({ users, page, perPage, returned: users.length, hasMore: authUsers.length === perPage, note: 'Search is applied within the current Auth page.' });
  } catch (error) {
    console.error('admin-users-list:', error);
    return jsonResponse({ error: 'Could not load users.' }, 500);
  }
});
