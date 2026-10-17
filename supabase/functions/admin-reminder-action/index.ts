import { jsonResponse, preflight, readJson } from '../_shared/http.ts';
import { auditAdmin, requireAdmin } from '../_shared/admin.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS = new Set(['update', 'delete']);
const CHANNELS = new Set(['push', 'email', 'both', 'none']);
const TYPES = new Set(['standard', 'expiry', 'renewal']);

function validHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  try {
    const result = await requireAdmin(req, 'admin');
    if ('response' in result) return result.response ?? jsonResponse({ error: 'Not found.' }, 404);
    const { context } = result;
    const body = await readJson(req, 12000);
    const reminderId = typeof body.reminderId === 'string' ? body.reminderId : '';
    const action = typeof body.action === 'string' ? body.action : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
    if (!UUID_RE.test(reminderId) || !ACTIONS.has(action) || reason.length < 8) {
      return jsonResponse({ error: 'A valid reminder, action, and reason of at least 8 characters are required.' }, 400);
    }
    if (action === 'delete' && context.role !== 'super_admin') return jsonResponse({ error: 'Not found.' }, 404);
    if (action === 'delete' && body.confirmation !== `DELETE ${reminderId}`) {
      return jsonResponse({ error: `Type DELETE ${reminderId} to permanently delete this reminder.` }, 400);
    }
    const { data: reminder, error: reminderError } = await context.admin.from('reminders')
      .select('id,owner_id,title').eq('id', reminderId).maybeSingle();
    if (reminderError) throw reminderError;
    if (!reminder) return jsonResponse({ error: 'Reminder not found.' }, 404);
    const { data: files, error: filesError } = await context.admin.from('reminder_attachments')
      .select('storage_path').eq('owner_id', reminder.owner_id).eq('reminder_id', reminderId).limit(50);
    if (filesError) throw filesError;

    if (action === 'delete') {
      await auditAdmin(context, 'reminder_delete_requested', 'reminders', reminderId, { ownerId: reminder.owner_id, reason });
      const { error } = await context.admin.from('reminders').delete().eq('id', reminderId);
      if (error) throw error;
      let cleanupError: string | null = null;
      const paths = (files || []).map((file) => file.storage_path);
      if (paths.length) {
        const { error: storageError } = await context.admin.storage.from('yere-attachments').remove(paths);
        if (storageError) cleanupError = storageError.message.slice(0, 500);
      }
      await auditAdmin(context, 'reminder_deleted', 'reminders', reminderId, {
        ownerId: reminder.owner_id, reason, attachmentCount: files?.length || 0,
        storageCleanupError: cleanupError
      });
      return jsonResponse({ ok: true, action, reminderId, storageCleanupError: cleanupError });
    }

    const changes: Record<string, unknown> = {};
    const changedFields: string[] = [];
    if ('title' in body) {
      if (typeof body.title !== 'string' || body.title.trim().length < 1 || body.title.trim().length > 180) return jsonResponse({ error: 'Title must be between 1 and 180 characters.' }, 400);
      changes.title = body.title.trim(); changedFields.push('title');
    }
    if ('notes' in body) {
      if (body.notes !== null && (typeof body.notes !== 'string' || body.notes.length > 4000)) return jsonResponse({ error: 'Notes must not exceed 4,000 characters.' }, 400);
      changes.notes = body.notes === null ? null : String(body.notes); changedFields.push('notes');
    }
    if ('url' in body) {
      if (body.url === null || body.url === '') changes.url = null;
      else if (typeof body.url === 'string' && body.url.length <= 2048 && validHttpUrl(body.url)) changes.url = validHttpUrl(body.url);
      else return jsonResponse({ error: 'Reminder URL must use HTTP or HTTPS.' }, 400);
      changedFields.push('url');
    }
    if ('dueAt' in body) {
      if (typeof body.dueAt !== 'string' || !Number.isFinite(Date.parse(body.dueAt))) return jsonResponse({ error: 'A valid due date is required.' }, 400);
      changes.due_at = new Date(body.dueAt).toISOString(); changedFields.push('due_at');
    }
    if ('recurrence' in body) {
      if (body.recurrence !== null && (typeof body.recurrence !== 'object' || Array.isArray(body.recurrence) || JSON.stringify(body.recurrence).length > 2000)) return jsonResponse({ error: 'Recurrence must be a small object or null.' }, 400);
      changes.recurrence = body.recurrence; changedFields.push('recurrence');
    }
    if ('listId' in body) {
      if (body.listId !== null && (typeof body.listId !== 'string' || !UUID_RE.test(body.listId))) return jsonResponse({ error: 'Invalid list id.' }, 400);
      if (body.listId) {
        const { data: list, error } = await context.admin.from('user_lists').select('id').eq('id', body.listId).eq('owner_id', reminder.owner_id).maybeSingle();
        if (error) throw error;
        if (!list) return jsonResponse({ error: 'List does not belong to this user.' }, 400);
      }
      changes.list_id = body.listId; changedFields.push('list_id');
    }
    if ('cost' in body) {
      if (body.cost === null || body.cost === '') changes.cost = null;
      else if (typeof body.cost === 'number' && Number.isFinite(body.cost) && body.cost >= 0 && body.cost <= 9999999999.99) changes.cost = body.cost;
      else return jsonResponse({ error: 'Cost must be a non-negative number.' }, 400);
      changedFields.push('cost');
    }
    if ('deliveryChannel' in body) {
      if (typeof body.deliveryChannel !== 'string' || !CHANNELS.has(body.deliveryChannel)) return jsonResponse({ error: 'Invalid delivery channel.' }, 400);
      changes.delivery_channel = body.deliveryChannel; changedFields.push('delivery_channel');
    }
    if ('reminderType' in body) {
      if (typeof body.reminderType !== 'string' || !TYPES.has(body.reminderType)) return jsonResponse({ error: 'Invalid reminder type.' }, 400);
      changes.reminder_type = body.reminderType; changedFields.push('reminder_type');
    }
    if ('isCompleted' in body) {
      if (typeof body.isCompleted !== 'boolean') return jsonResponse({ error: 'Completion state must be true or false.' }, 400);
      changes.is_completed = body.isCompleted;
      changes.completed_at = body.isCompleted ? new Date().toISOString() : null;
      changedFields.push('is_completed');
    }
    if (!changedFields.length) return jsonResponse({ error: 'No reminder fields were supplied for update.' }, 400);

    await auditAdmin(context, 'reminder_update_requested', 'reminders', reminderId, {
      ownerId: reminder.owner_id, changedFields, reason
    });
    const { data: updated, error: updateError } = await context.admin.from('reminders')
      .update(changes).eq('id', reminderId).select('id,updated_at').maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return jsonResponse({ error: 'Reminder not found.' }, 404);
    await auditAdmin(context, 'reminder_updated', 'reminders', reminderId, {
      ownerId: reminder.owner_id, changedFields, reason
    });
    return jsonResponse({ ok: true, action, reminderId, changedFields, updatedAt: updated.updated_at });
  } catch (error) {
    console.error('admin-reminder-action:', error);
    return jsonResponse({ error: 'Could not complete this reminder action.' }, 500);
  }
});
