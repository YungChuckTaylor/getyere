import { jsonResponse, preflight, readJson } from '../_shared/http.ts';
import { auditAdmin, requireAdmin } from '../_shared/admin.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set(['open', 'in_progress', 'resolved', 'closed']);

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  try {
    const result = await requireAdmin(req, 'support');
    if ('response' in result) return result.response ?? jsonResponse({ error: 'Not found.' }, 404);
    const { context } = result;
    const body = await readJson(req, 14000);
    const ticketId = typeof body.ticketId === 'string' ? body.ticketId : '';
    const status = typeof body.status === 'string' ? body.status : '';
    const responseText = typeof body.adminResponse === 'string' ? body.adminResponse.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
    if (!UUID_RE.test(ticketId) || !STATUSES.has(status) || responseText.length > 10000 || reason.length < 8) {
      return jsonResponse({ error: 'A valid ticket, status, response, and reason of at least 8 characters are required.' }, 400);
    }
    const { data: ticket, error: ticketError } = await context.admin.from('support_tickets')
      .select('id,user_id,status').eq('id', ticketId).maybeSingle();
    if (ticketError) throw ticketError;
    if (!ticket) return jsonResponse({ error: 'Support ticket not found.' }, 404);
    const changedFields = ['status', 'admin_response'];
    await auditAdmin(context, 'support_ticket_update_requested', 'support_tickets', ticketId, {
      userId: ticket.user_id, status, responseChanged: responseText.length > 0, changedFields, reason
    });
    const now = new Date().toISOString();
    const { data, error } = await context.admin.from('support_tickets').update({
      status, admin_response: responseText || null,
      responded_by: responseText ? context.user.id : null,
      responded_at: responseText ? now : null,
      updated_at: now
    }).eq('id', ticketId).select('id,status,admin_response,responded_at,updated_at').maybeSingle();
    if (error) throw error;
    if (!data) return jsonResponse({ error: 'Support ticket not found.' }, 404);
    await auditAdmin(context, 'support_ticket_updated', 'support_tickets', ticketId, {
      userId: ticket.user_id, status, responseChanged: responseText.length > 0, changedFields, reason
    });
    return jsonResponse({ ok: true, ticket: data });
  } catch (error) {
    console.error('admin-support-update:', error);
    return jsonResponse({ error: 'Could not update this support ticket.' }, 500);
  }
});
