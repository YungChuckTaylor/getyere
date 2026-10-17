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
    const reason = typeof body.viewReason === 'string' ? body.viewReason.trim().slice(0, 500) : '';
    if (reason.length < 8) return jsonResponse({ error: 'A view reason of at least 8 characters is required.' }, 400);
    const page = Number.isInteger(body.page) ? Math.max(1, Math.min(body.page, 10000)) : 1;
    const perPage = Number.isInteger(body.perPage) ? Math.max(1, Math.min(body.perPage, 100)) : 50;
    let query = context.admin.from('support_tickets')
      .select('id,user_id,subject,body,status,admin_response,responded_by,responded_at,created_at,updated_at', { count: 'exact' })
      .order('created_at', { ascending: false }).range((page - 1) * perPage, page * perPage - 1);
    if (typeof body.status === 'string' && ['open', 'in_progress', 'resolved', 'closed'].includes(body.status)) query = query.eq('status', body.status);
    const { data, count, error } = await query;
    if (error) throw error;
    const userIds = [...new Set((data || []).map((ticket) => ticket.user_id))];
    const users = await Promise.all(userIds.map(async (id) => {
      const { data: result, error: userError } = await context.admin.auth.admin.getUserById(id);
      return [id, userError ? null : result.user?.email || null] as const;
    }));
    const emailById = new Map(users);
    const tickets = (data || []).map((ticket) => ({ ...ticket, userEmail: emailById.get(ticket.user_id) || null }));
    await auditAdmin(context, 'view_support_tickets', 'support_tickets', null, { page, perPage, status: body.status || null, viewReason: reason });
    return jsonResponse({ tickets, page, perPage, total: count || 0 });
  } catch (error) {
    console.error('admin-support-list:', error);
    return jsonResponse({ error: 'Could not load support tickets.' }, 500);
  }
});
