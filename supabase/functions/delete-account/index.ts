import { adminClient, authenticatedUser, jsonResponse, preflight } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  try {
    const { user, error: authError } = await authenticatedUser(req);
    if (authError || !user) return jsonResponse({ error: 'Sign in before deleting your account.' }, 401);
    const body = await req.json().catch(() => ({}));
    if (body?.confirmation !== 'DELETE') return jsonResponse({ error: 'Type DELETE to confirm permanent account deletion.' }, 400);

    // auth.users is the root of Yere's ON DELETE CASCADE graph. Remove private
    // Storage objects first because Storage is not part of the Postgres cascade.
    const admin = adminClient();
    const { data: attachments, error: attachmentError } = await admin
      .from('reminder_attachments')
      .select('storage_path')
      .eq('owner_id', user.id)
      .limit(5000);
    if (attachmentError) throw attachmentError;
    const paths = (attachments || []).map((attachment) => attachment.storage_path).filter(Boolean);
    for (let offset = 0; offset < paths.length; offset += 100) {
      const { error: removeError } = await admin.storage.from('yere-attachments').remove(paths.slice(offset, offset + 100));
      if (removeError) throw removeError;
    }

    // A deleted trusted contact must not remain attached to another account.
    // The service-only RPC performs the column-to-column attribution update that
    // PostgREST cannot express and removes their accepted relationships.
    const { error: detachError } = await admin.rpc('detach_deleted_yere_user', { p_user_id: user.id });
    if (detachError) throw detachError;

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error('delete-account:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Account deletion failed.' }, 400);
  }
});
