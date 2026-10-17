import { jsonResponse, preflight } from '../_shared/http.ts';
import { requireAdmin } from '../_shared/admin.ts';

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== 'GET') return jsonResponse({ error: 'Method not allowed.' }, 405);
  try {
    const result = await requireAdmin(req, 'read_only');
    if ('response' in result) return result.response ?? jsonResponse({ error: 'Not found.' }, 404);
    const { context } = result;
    const { data: session, error } = await context.admin.from('admin_sessions').select('expires_at').eq('id', context.sessionId).maybeSingle();
    if (error) throw error;
    return jsonResponse({
      userId: context.user.id,
      email: context.user.email || null,
      role: context.role,
      sessionId: context.sessionId,
      sessionExpiresAt: session?.expires_at || null
    });
  } catch (error) {
    console.error('admin-me:', error);
    return jsonResponse({ error: 'The administrative session could not be checked.' }, 500);
  }
});
