import { jsonResponse, preflight, readJson } from '../_shared/http.ts';
import { auditAdmin, requireAdmin } from '../_shared/admin.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    let query = context.admin.from('notification_logs')
      .select('id,reminder_fire_id,reminder_id,user_id,channel,status,attempt,provider_reference,error_message,created_at', { count: 'exact' })
      .order('created_at', { ascending: false }).range((page - 1) * perPage, page * perPage - 1);
    if (typeof body.status === 'string' && ['queued', 'sent', 'partial', 'failed', 'retried', 'skipped'].includes(body.status)) {
      query = query.eq('status', body.status);
    }
    if (typeof body.userId === 'string' && UUID_RE.test(body.userId)) query = query.eq('user_id', body.userId);
    if (typeof body.reminderId === 'string' && UUID_RE.test(body.reminderId)) query = query.eq('reminder_id', body.reminderId);
    const { data, count, error } = await query;
    if (error) throw error;
    await auditAdmin(context, 'view_notification_logs', 'notification_logs', null, {
      page, perPage, status: typeof body.status === 'string' ? body.status.slice(0, 20) : null,
      userFilter: Boolean(body.userId), reminderFilter: Boolean(body.reminderId), viewReason: reason
    });
    return jsonResponse({ logs: data || [], page, perPage, total: count || 0 });
  } catch (error) {
    console.error('admin-notification-list:', error);
    return jsonResponse({ error: 'Could not load notification logs.' }, 500);
  }
});
