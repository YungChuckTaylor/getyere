import { adminClient, authenticatedUser, jsonResponse, preflight, readJson } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  try {
    const { user, error: authError } = await authenticatedUser(req);
    if (authError || !user) return jsonResponse({ error: 'Sign in to revoke an invitation.' }, 401);
    const body = await readJson(req);
    const admin = adminClient();
    const now = new Date().toISOString();

    if (typeof body?.inviteId === 'string') {
      const { data: invite, error } = await admin.from('contact_invites').select('id,owner_id,contact_id').eq('id', body.inviteId).eq('owner_id', user.id).maybeSingle();
      if (error) throw error;
      if (!invite) return jsonResponse({ error: 'Invitation not found.' }, 404);
      const { error: updateError } = await admin.from('contact_invites').update({ revoked_at: now }).eq('id', invite.id).eq('owner_id', user.id);
      if (updateError) throw updateError;
      await admin.from('audit_logs').insert({ owner_id: user.id, actor_id: user.id, actor_name: 'Yere member', action: 'revoked invite', details: 'A pending invitation was revoked.' });
      return jsonResponse({ ok: true });
    }

    if (typeof body?.contactId === 'string') {
      const { data: contact, error } = await admin.from('contacts').select('id,owner_id,display_name,status').eq('id', body.contactId).eq('owner_id', user.id).maybeSingle();
      if (error) throw error;
      if (!contact) return jsonResponse({ error: 'Contact invitation not found.' }, 404);
      const { error: inviteError } = await admin.from('contact_invites').update({ revoked_at: now }).eq('contact_id', contact.id).eq('owner_id', user.id).is('consumed_at', null).is('revoked_at', null);
      if (inviteError) throw inviteError;
      if (contact.status === 'invited') await admin.from('contacts').update({ status: 'revoked' }).eq('id', contact.id).eq('owner_id', user.id);
      await admin.from('audit_logs').insert({ owner_id: user.id, actor_id: user.id, actor_name: 'Yere member', action: 'cancelled invitation', details: contact.display_name || 'Pending invitation' });
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: 'Provide an inviteId or contactId.' }, 400);
  } catch (error) {
    console.error('revoke-contact-invite:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Could not revoke the invitation.' }, 400);
  }
});
