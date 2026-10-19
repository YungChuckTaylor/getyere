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
    const reminderId = typeof body.reminderId === 'string' ? body.reminderId : '';
    const reason = typeof body.viewReason === 'string' ? body.viewReason.trim().slice(0, 500) : '';
    if (!UUID_RE.test(reminderId) || reason.length < 8) return jsonResponse({ error: 'A valid reminder and a view reason of at least 8 characters are required.' }, 400);
    const { data: reminder, error } = await context.admin.from('reminders')
      .select('id,owner_id,created_by,title,notes,url,due_at,recurrence,is_completed,completed_at,approval_status,from_contact_id,list_id,reminder_type,delivery_channel,cost,created_at,updated_at')
      .eq('id', reminderId).maybeSingle();
    if (error) throw error;
    if (!reminder) return jsonResponse({ error: 'Reminder not found.' }, 404);
    const [owner, list, listsResult, attachmentsResult, firesResult] = await Promise.all([
      context.admin.from('profiles').select('display_name,timezone').eq('id', reminder.owner_id).maybeSingle(),
      reminder.list_id ? context.admin.from('user_lists').select('name,color').eq('id', reminder.list_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      context.admin.from('user_lists').select('id,name,color').eq('owner_id', reminder.owner_id).order('sort_order').limit(100),
      context.admin.from('reminder_attachments').select('id,storage_path,file_name,content_type,size_bytes,created_at').eq('owner_id', reminder.owner_id).eq('reminder_id', reminderId).limit(20),
      context.admin.from('reminder_fires').select('id,due_at,fired_at,channel,delivery_status,error_message').eq('reminder_id', reminderId).order('fired_at', { ascending: false }).limit(50)
    ]);
    for (const result of [owner, list, listsResult, attachmentsResult, firesResult]) if (result.error) throw result.error;
    const attachments = await Promise.all((attachmentsResult.data || []).map(async (file) => {
      const { data: signed, error: signError } = await context.admin.storage.from('yere-attachments').createSignedUrl(file.storage_path, 60);
      return { id: file.id, name: file.file_name, contentType: file.content_type, sizeBytes: file.size_bytes, createdAt: file.created_at, signedUrl: signError ? null : signed?.signedUrl || null };
    }));
    await auditAdmin(context, 'view_reminder_detail', 'reminders', reminderId, { ownerId: reminder.owner_id, viewReason: reason });
    return jsonResponse({ reminder, owner: owner.data, list: list.data, ownerLists: listsResult.data || [], attachments, deliveryHistory: firesResult.data || [] });
  } catch (error) {
    console.error('admin-reminder-detail:', error);
    return jsonResponse({ error: 'Could not load this reminder.' }, 500);
  }
});
