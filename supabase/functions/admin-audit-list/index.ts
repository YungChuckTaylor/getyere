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
    const body = await readJson(req, 3000);
    const page = Number.isInteger(body.page) ? Math.max(1, Math.min(body.page, 10000)) : 1;
    const perPage = Number.isInteger(body.perPage) ? Math.max(1, Math.min(body.perPage, 100)) : 50;
    let query = context.admin.from('admin_audit_logs').select('id,admin_id,action,target_table,target_id,metadata,ip,user_agent,created_at', { count: 'exact' })
      .order('created_at', { ascending: false }).range((page - 1) * perPage, page * perPage - 1);
    if (typeof body.targetTable === 'string' && body.targetTable.length <= 80) query = query.eq('target_table', body.targetTable);
    if (typeof body.adminId === 'string' && /^[0-9a-f-]{36}$/i.test(body.adminId)) query = query.eq('admin_id', body.adminId);
    const { data, count, error } = await query;
    if (error) throw error;
    await auditAdmin(context, 'view_admin_audit_log', 'admin_audit_logs', null, { page, perPage });
    return jsonResponse({ logs: data || [], page, perPage, total: count || 0 });
  } catch (error) {
    console.error('admin-audit-list:', error);
    return jsonResponse({ error: 'Could not load the audit log.' }, 500);
  }
});
