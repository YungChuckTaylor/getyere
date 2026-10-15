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
    const body = await readJson(req, 3000);
    const userId = typeof body.userId === 'string' ? body.userId : '';
    const reason = typeof body.viewReason === 'string' ? body.viewReason.trim().slice(0, 500) : '';
    if (!UUID_RE.test(userId) || reason.length < 8) return jsonResponse({ error: 'A valid user and a view reason of at least 8 characters are required.' }, 400);
    const { data: adminAccount, error: adminAccountError } = await context.admin.from('admin_users')
      .select('user_id').eq('user_id', userId).maybeSingle();
    if (adminAccountError) throw adminAccountError;
    if (adminAccount) return jsonResponse({ error: 'Use Admin access to inspect administrator accounts.' }, 404);

    const [authResult, profileResult, userListsResult, remindersResult, contactsResult, invitesResult, fireResult, notificationResult, auditResult, attachmentResult, subscriptionsResult, ticketsResult] = await Promise.all([
      context.admin.auth.admin.getUserById(userId),
      context.admin.from('profiles').select('id,display_name,timezone,theme,settings,created_at,updated_at').eq('id', userId).maybeSingle(),
      context.admin.from('user_lists').select('id,name,color,sort_order,created_at,updated_at').eq('owner_id', userId).order('sort_order').limit(100),
      context.admin.from('reminders').select('id,title,notes,url,due_at,recurrence,is_completed,completed_at,approval_status,from_contact_id,list_id,reminder_type,delivery_channel,cost,created_at,updated_at').eq('owner_id', userId).order('created_at', { ascending: false }).limit(100),
      context.admin.from('contacts').select('id,contact_user_id,display_name,invited_email,invited_phone,status,approval_mode,created_at,updated_at').eq('owner_id', userId).order('created_at', { ascending: false }).limit(100),
      context.admin.from('contact_invites').select('id,contact_id,invite_type,invited_email,invited_phone,expires_at,consumed_at,revoked_at,created_at,failed_attempts').eq('owner_id', userId).order('created_at', { ascending: false }).limit(100),
      context.admin.from('reminder_fires').select('id,reminder_id,due_at,fired_at,channel,delivery_status,error_message').eq('owner_id', userId).order('fired_at', { ascending: false }).limit(100),
      context.admin.from('notification_logs').select('id,reminder_fire_id,reminder_id,channel,status,attempt,provider_reference,error_message,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
      context.admin.from('audit_logs').select('id,actor_id,actor_name,action,details,created_at').eq('owner_id', userId).order('created_at', { ascending: false }).limit(100),
      context.admin.from('reminder_attachments').select('id,reminder_id,storage_path,file_name,content_type,size_bytes,created_at').eq('owner_id', userId).order('created_at', { ascending: false }).limit(100),
      context.admin.from('push_subscriptions').select('id,user_agent,expiration_time,created_at,updated_at').eq('owner_id', userId).order('created_at', { ascending: false }).limit(100),
      context.admin.from('support_tickets').select('id,subject,body,status,admin_response,responded_at,created_at,updated_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
    ]);
    for (const response of [profileResult, userListsResult, remindersResult, contactsResult, invitesResult, fireResult, notificationResult, auditResult, attachmentResult, subscriptionsResult, ticketsResult]) {
      if (response.error) throw response.error;
    }
    if (authResult.error || !authResult.data.user) return jsonResponse({ error: 'User not found.' }, 404);

    const attachments = await Promise.all((attachmentResult.data || []).map(async (file) => {
      const { data: signed, error } = await context.admin.storage.from('yere-attachments').createSignedUrl(file.storage_path, 60);
      return {
        id: file.id, reminderId: file.reminder_id, fileName: file.file_name,
        contentType: file.content_type, sizeBytes: file.size_bytes, createdAt: file.created_at,
        signedUrl: error ? null : signed?.signedUrl || null
      };
    }));
    await auditAdmin(context, 'view_user_detail', 'auth.users', userId, { viewReason: reason });
    return jsonResponse({
      user: {
        id: authResult.data.user.id, email: authResult.data.user.email || null,
        signupAt: authResult.data.user.created_at, lastActiveAt: authResult.data.user.last_sign_in_at || null,
        emailConfirmedAt: authResult.data.user.email_confirmed_at || null,
        bannedUntil: authResult.data.user.banned_until && Date.parse(authResult.data.user.banned_until) > Date.now() ? authResult.data.user.banned_until : null,
        appMetadata: { provider: authResult.data.user.app_metadata?.provider || null }
      },
      profile: profileResult.data,
      lists: userListsResult.data || [],
      reminders: remindersResult.data || [],
      notificationLogs: notificationResult.data || [],
      contacts: contactsResult.data || [],
      invites: invitesResult.data || [],
      reminderFires: fireResult.data || [],
      userAuditHistory: auditResult.data || [],
      attachments,
      devices: subscriptionsResult.data || [],
      supportTickets: ticketsResult.data || []
    });
  } catch (error) {
    console.error('admin-user-detail:', error);
    return jsonResponse({ error: 'Could not load this user record.' }, 500);
  }
});
