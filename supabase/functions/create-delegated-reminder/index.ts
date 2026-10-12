import { adminClient, authenticatedUser, consumeRateLimit, jsonResponse, preflight, readJson } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  try {
    const { user, error: authError } = await authenticatedUser(req);
    if (authError || !user) return jsonResponse({ error: 'Sign in to share a reminder.' }, 401);
    const body = await readJson(req);
    const ownerId = typeof body?.ownerId === 'string' ? body.ownerId : '';
    const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 180) : '';
    const notes = typeof body?.notes === 'string' ? body.notes.trim().slice(0, 4000) : '';
    const url = typeof body?.url === 'string' ? body.url.trim().slice(0, 2048) : '';
    const due = typeof body?.dueAt === 'string' ? new Date(body.dueAt) : new Date(NaN);
    const channel = ['push', 'email', 'both', 'none'].includes(body?.deliveryChannel) ? body.deliveryChannel : 'push';
    const recurrence = body?.recurrence && typeof body.recurrence === 'object' ? body.recurrence : null;
    if (!/^[0-9a-f-]{36}$/i.test(ownerId) || !title || Number.isNaN(due.getTime())) return jsonResponse({ error: 'Add a valid reminder and due time.' }, 400);
    if (url && !['https:', 'http:'].includes(new URL(url).protocol)) return jsonResponse({ error: 'The reminder link must use HTTP or HTTPS.' }, 400);
    if (recurrence && JSON.stringify(recurrence).length > 3000) return jsonResponse({ error: 'Recurrence settings are too large.' }, 400);

    const admin = adminClient();
    const { data: securityRows, error: securityError } = await admin.from('workspace_security').select('user_id,suspended_until').in('user_id',[user.id,ownerId]);
    if (securityError) throw securityError;
    if ((securityRows||[]).some(row=>row.suspended_until&&new Date(row.suspended_until).getTime()>Date.now())) {
      return jsonResponse({ error: 'Shared reminders are paused while an account is in a safety cooldown.' }, 423);
    }
    if (!await consumeRateLimit(admin, `delegated-reminder:${user.id}`, 'create-delegated-reminder', 60, 3600)) {
      return jsonResponse({ error: 'You have reached the hourly limit for shared reminders.' }, 429);
    }
    const { data: relation, error: relationError } = await admin.from('contacts')
      .select('id,owner_id,approval_mode,status')
      .eq('owner_id', ownerId).eq('contact_user_id', user.id).eq('status', 'approved').maybeSingle();
    if (relationError) throw relationError;
    if (!relation) return jsonResponse({ error: 'This trusted relationship is no longer active.' }, 403);
    const [ownerBlockResult,senderBlockResult] = await Promise.all([
      admin.from('contact_blocks').select('owner_id').eq('owner_id',ownerId).eq('blocked_user_id',user.id).maybeSingle(),
      admin.from('contact_blocks').select('owner_id').eq('owner_id',user.id).eq('blocked_user_id',ownerId).maybeSingle()
    ]);
    if (ownerBlockResult.error) throw ownerBlockResult.error;
    if (senderBlockResult.error) throw senderBlockResult.error;
    if (ownerBlockResult.data||senderBlockResult.data) return jsonResponse({ error: 'This account is not accepting reminders from you.' }, 403);

    const approvalStatus = relation.approval_mode === 'require_approval' ? 'pending' : 'approved';
    const { data: reminder, error: insertError } = await admin.from('reminders').insert({
      owner_id: ownerId,
      created_by: user.id,
      title,
      notes: notes || null,
      url: url || null,
      due_at: due.toISOString(),
      recurrence,
      approval_status: approvalStatus,
      from_contact_id: relation.id,
      delivery_channel: channel,
      reminder_type: 'standard',
      is_completed: false
    }).select('id').single();
    if (insertError || !reminder) throw insertError || new Error('Could not create the shared reminder.');

    const { data: senderProfile } = await admin.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
    await admin.from('audit_logs').insert({
      owner_id: ownerId,
      actor_id: user.id,
      actor_name: senderProfile?.display_name || 'Trusted contact',
      action: approvalStatus === 'pending' ? 'proposed reminder' : 'created reminder',
      details: title
    });
    return jsonResponse({ ok: true, approvalStatus, reminderId: reminder.id });
  } catch (error) {
    console.error('create-delegated-reminder:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Could not share this reminder.' }, 400);
  }
});
