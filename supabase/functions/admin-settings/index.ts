import { jsonResponse, preflight, readJson } from '../_shared/http.ts';
import { auditAdmin, requireAdmin } from '../_shared/admin.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY_RE = /^[a-z][a-z0-9_-]{0,79}$/;

function dateValue(value: unknown, fallback: string | null = null) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  try {
    const body = await readJson(req, 16000);
    const action = typeof body.action === 'string' ? body.action : '';
    const minRole = ['maintenance_set', 'setting_set'].includes(action) ? 'super_admin' : 'admin';
    const result = await requireAdmin(req, minRole);
    if ('response' in result) return result.response ?? jsonResponse({ error: 'Not found.' }, 404);
    const { context } = result;
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
    if (reason.length < 8) return jsonResponse({ error: 'A reason of at least 8 characters is required.' }, 400);

    if (action === 'read') {
      const [settings, flags, maintenance, announcements] = await Promise.all([
        context.admin.from('app_settings').select('key,value,updated_at,updated_by').order('key').limit(200),
        context.admin.from('feature_flags').select('key,enabled,description,updated_at,updated_by').order('key').limit(200),
        context.admin.from('maintenance_mode').select('id,enabled,message,updated_at,updated_by').eq('id', 1).maybeSingle(),
        context.admin.from('announcements').select('id,title,body,audience,audience_ids,starts_at,ends_at,active,created_by,created_at,updated_at').order('created_at', { ascending: false }).limit(100)
      ]);
      for (const response of [settings, flags, maintenance, announcements]) if (response.error) throw response.error;
      await auditAdmin(context, 'view_admin_settings', 'app_settings', null, { viewReason: reason });
      return jsonResponse({ settings: context.role === 'super_admin' ? settings.data || [] : [], featureFlags: flags.data || [], maintenance: maintenance.data, announcements: announcements.data || [] });
    }

    if (action === 'feature_flag_set') {
      const key = typeof body.key === 'string' ? body.key : '';
      const description = typeof body.description === 'string' ? body.description.trim() : '';
      if (!KEY_RE.test(key) || typeof body.enabled !== 'boolean' || description.length > 500) {
        return jsonResponse({ error: 'A valid flag key, enabled state, and description are required.' }, 400);
      }
      await auditAdmin(context, 'feature_flag_update_requested', 'feature_flags', key, { enabled: body.enabled, reason });
      const now = new Date().toISOString();
      const { error } = await context.admin.from('feature_flags').upsert({
        key, enabled: body.enabled, description, updated_at: now, updated_by: context.user.id
      }, { onConflict: 'key' });
      if (error) throw error;
      await auditAdmin(context, 'feature_flag_updated', 'feature_flags', key, { enabled: body.enabled, reason });
      return jsonResponse({ ok: true, key, enabled: body.enabled });
    }

    if (action === 'maintenance_set') {
      if (typeof body.enabled !== 'boolean') return jsonResponse({ error: 'Maintenance state must be true or false.' }, 400);
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (message.length > 500) return jsonResponse({ error: 'Maintenance message must not exceed 500 characters.' }, 400);
      await auditAdmin(context, 'maintenance_update_requested', 'maintenance_mode', '1', { enabled: body.enabled, reason });
      const now = new Date().toISOString();
      const { error } = await context.admin.from('maintenance_mode').update({
        enabled: body.enabled, message: message || 'Yere is temporarily unavailable. Please try again soon.',
        updated_at: now, updated_by: context.user.id
      }).eq('id', 1);
      if (error) throw error;
      await auditAdmin(context, 'maintenance_updated', 'maintenance_mode', '1', { enabled: body.enabled, reason });
      return jsonResponse({ ok: true, enabled: body.enabled });
    }

    if (action === 'setting_set') {
      const key = typeof body.key === 'string' ? body.key.trim() : '';
      if (!key || key.length > 100 || body.value === undefined) return jsonResponse({ error: 'A valid setting key and JSON value are required.' }, 400);
      const serialized = JSON.stringify(body.value);
      if (serialized.length > 10000) return jsonResponse({ error: 'Setting value is too large.' }, 400);
      await auditAdmin(context, 'app_setting_update_requested', 'app_settings', key, { reason });
      const now = new Date().toISOString();
      const { error } = await context.admin.from('app_settings').upsert({
        key, value: body.value, updated_at: now, updated_by: context.user.id
      }, { onConflict: 'key' });
      if (error) throw error;
      await auditAdmin(context, 'app_setting_updated', 'app_settings', key, { reason });
      return jsonResponse({ ok: true, key });
    }

    if (action === 'announcement_set') {
      const announcementId = typeof body.id === 'string' ? body.id : '';
      if (announcementId && !UUID_RE.test(announcementId)) return jsonResponse({ error: 'Invalid announcement id.' }, 400);
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      const messageBody = typeof body.body === 'string' ? body.body.trim() : '';
      const audience = typeof body.audience === 'string' ? body.audience : 'all';
      const audienceIds: unknown[] = Array.isArray(body.audienceIds) ? body.audienceIds : [];
      const startsAt = dateValue(body.startsAt, new Date().toISOString());
      const endsAt = dateValue(body.endsAt, null);
      if (!title || title.length > 160 || !messageBody || messageBody.length > 5000
        || !['all', 'selected'].includes(audience)
        || audienceIds.length > 1000 || audienceIds.some((id) => typeof id !== 'string' || !UUID_RE.test(id))
        || (audience === 'selected' && !audienceIds.length) || !startsAt || (body.endsAt && !endsAt)
        || (endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) || typeof body.active !== 'boolean') {
        return jsonResponse({ error: 'Announcement details are invalid.' }, 400);
      }
      const values = {
        title, body: messageBody, audience, audience_ids: audienceIds,
        starts_at: startsAt, ends_at: endsAt, active: body.active,
        updated_at: new Date().toISOString()
      };
      await auditAdmin(context, 'announcement_update_requested', 'announcements', announcementId || null, {
        title, audience, active: body.active, reason
      });
      let saved;
      if (announcementId) {
        const { data, error } = await context.admin.from('announcements').update(values)
          .eq('id', announcementId).select('id').maybeSingle();
        if (error) throw error;
        if (!data) return jsonResponse({ error: 'Announcement not found.' }, 404);
        saved = data;
      } else {
        const { data, error } = await context.admin.from('announcements').insert({
          ...values, created_by: context.user.id
        }).select('id').single();
        if (error) throw error;
        saved = data;
      }
      await auditAdmin(context, 'announcement_updated', 'announcements', saved.id, { title, audience, active: body.active, reason });
      return jsonResponse({ ok: true, id: saved.id });
    }

    return jsonResponse({ error: 'Unsupported admin settings action.' }, 400);
  } catch (error) {
    console.error('admin-settings:', error);
    return jsonResponse({ error: 'Could not complete the admin settings action.' }, 500);
  }
});
