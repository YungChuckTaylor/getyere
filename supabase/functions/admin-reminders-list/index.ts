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
    const ownerId = typeof body.ownerId === 'string' && /^[0-9a-f-]{36}$/i.test(body.ownerId) ? body.ownerId : null;
    const reason = typeof body.viewReason === 'string' ? body.viewReason.trim().slice(0, 500) : '';
    if (reason.length < 8) return jsonResponse({ error: 'A view reason of at least 8 characters is required.' }, 400);
    const query = typeof body.query === 'string' ? body.query.trim().slice(0, 100).replace(/[,%()\\]/g, ' ') : '';
    let request = context.admin.from('reminders')
      .select('id,owner_id,title,due_at,is_completed,approval_status,delivery_channel,reminder_type,list_id,cost,created_at', { count: 'exact' })
      .order('created_at', { ascending: false }).range((page - 1) * perPage, page * perPage - 1);
    if (ownerId) request = request.eq('owner_id', ownerId);
    if (query) request = request.or(`title.ilike.%${query}%,notes.ilike.%${query}%`);
    const { data: reminders, count, error } = await request;
    if (error) throw error;
    const ownerIds = [...new Set((reminders || []).map((item) => item.owner_id))];
    const { data: profiles, error: profileError } = ownerIds.length
      ? await context.admin.from('profiles').select('id,display_name').in('id', ownerIds)
      : { data: [], error: null };
    if (profileError) throw profileError;
    const profileById = new Map((profiles || []).map((profile) => [profile.id, profile.display_name]));
    const rows = (reminders || []).map((item) => ({ ...item, ownerName: profileById.get(item.owner_id) || 'Yere member' }));
    await auditAdmin(context, 'list_admin_reminders', 'reminders', null, { page, perPage, ownerFilter: Boolean(ownerId), searchPresent: Boolean(query), viewReason: reason });
    return jsonResponse({ reminders: rows, page, perPage, total: count || 0 });
  } catch (error) {
    console.error('admin-reminders-list:', error);
    return jsonResponse({ error: 'Could not load reminders.' }, 500);
  }
});
