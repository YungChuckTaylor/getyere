import { jsonResponse, preflight } from '../_shared/http.ts';
import { auditAdmin, requireAdmin } from '../_shared/admin.ts';

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== 'GET') return jsonResponse({ error: 'Method not allowed.' }, 405);
  try {
    const result = await requireAdmin(req, 'read_only');
    if ('response' in result) return result.response ?? jsonResponse({ error: 'Not found.' }, 404);
    const { context } = result;
    const now = Date.now();
    const since7d = new Date(now - 7 * 86400000).toISOString();
    const since30d = new Date(now - 30 * 86400000).toISOString();
    const [users, newUsers, updatedProfiles, reminders, pendingInvites, sends, failed] = await Promise.all([
      context.admin.from('profiles').select('id', { count: 'exact', head: true }),
      context.admin.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', since7d),
      context.admin.from('profiles').select('id', { count: 'exact', head: true }).gte('updated_at', since30d),
      context.admin.from('reminders').select('id', { count: 'exact', head: true }),
      context.admin.from('contact_invites').select('id', { count: 'exact', head: true }).is('consumed_at', null).is('revoked_at', null).gt('expires_at', new Date(now).toISOString()),
      context.admin.from('notification_logs').select('id', { count: 'exact', head: true }).in('status', ['sent', 'partial']),
      context.admin.from('notification_logs').select('id', { count: 'exact', head: true }).eq('status', 'failed')
    ]);
    for (const response of [users, newUsers, updatedProfiles, reminders, pendingInvites, sends, failed]) if (response.error) throw response.error;
    await auditAdmin(context, 'view_admin_overview', null, null, {});
    return jsonResponse({
      totals: {
        users: users.count || 0,
        newUsers7d: newUsers.count || 0,
        profilesUpdated30d: updatedProfiles.count || 0,
        reminders: reminders.count || 0,
        pendingInvites: pendingInvites.count || 0,
        notificationAttemptsSentOrPartial: sends.count || 0,
        notificationAttemptsFailed: failed.count || 0
      },
      generatedAt: new Date(now).toISOString(),
      dataCoverage: { featureUsage: false, crashReports: false, vercelDeployment: false }
    });
  } catch (error) {
    console.error('admin-overview:', error);
    return jsonResponse({ error: 'Could not load the admin overview.' }, 500);
  }
});
