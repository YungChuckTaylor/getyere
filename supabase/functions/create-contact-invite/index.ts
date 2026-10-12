import {
  adminClient, authenticatedUser, consumeRateLimit, env, escapeHtml, jsonResponse,
  normalizedEmail, normalizedPhone, preflight, randomInviteCode, randomToken, readJson, safeAppOrigin, sha256
} from '../_shared/http.ts';
import { sendYereEmail } from '../_shared/email.ts';

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  try {
    const { user, error: authError } = await authenticatedUser(req);
    if (authError || !user) return jsonResponse({ error: 'Sign in to create an invitation.' }, 401);
    const body = await readJson(req);
    const type = body?.type;
    if (!['code', 'email', 'sms'].includes(type)) return jsonResponse({ error: 'Choose a valid invitation method.' }, 400);
    const displayName = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
    const approvalMode = body.approvalMode === 'require_approval' ? 'require_approval' : 'direct';
    const email = type === 'email' ? normalizedEmail(body.email) : null;
    const phone = type === 'sms' ? normalizedPhone(body.phone) : null;
    if (type === 'email' && !email) return jsonResponse({ error: 'Enter a valid email address.' }, 400);
    if (type === 'sms' && !phone) return jsonResponse({ error: 'Enter a phone number in international format, for example +2348012345678.' }, 400);

    const admin = adminClient();
    const { data: security } = await admin.from('workspace_security').select('suspended_until').eq('user_id', user.id).maybeSingle();
    if (security?.suspended_until && new Date(security.suspended_until).getTime() > Date.now()) {
      return jsonResponse({ error: 'Invitations are paused for this account. Try again after the safety cooldown.' }, 423);
    }
    const allowed = await consumeRateLimit(admin, `invite-create:${user.id}`, 'create-invite', 5, 3600);
    if (!allowed) return jsonResponse({ error: 'Invite limit reached. You can create up to five invitations per hour.' }, 429);

    if (email) {
      const { data: duplicate } = await admin.from('contacts').select('id').eq('owner_id', user.id).eq('invited_email', email).neq('status', 'revoked').maybeSingle();
      if (duplicate) return jsonResponse({ error: 'There is already an active invitation or contact for that email.' }, 409);
    }
    if (phone) {
      const { data: duplicate } = await admin.from('contacts').select('id').eq('owner_id', user.id).eq('invited_phone', phone).neq('status', 'revoked').maybeSingle();
      if (duplicate) return jsonResponse({ error: 'There is already an active invitation or contact for that number.' }, 409);
    }

    const secret = type === 'code' ? randomInviteCode() : randomToken(32);
    const secretHash = await sha256(type === 'code' ? secret.replace(/-/g, '').toUpperCase() : secret);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: contact, error: contactError } = await admin.from('contacts').insert({
      owner_id: user.id,
      display_name: displayName || (email ? email : phone ? phone : 'Trusted contact'),
      invited_email: email,
      invited_phone: phone,
      status: 'invited',
      approval_mode: approvalMode
    }).select('id').single();
    if (contactError || !contact) throw contactError || new Error('Could not create the contact invitation.');

    const { data: invite, error: inviteError } = await admin.from('contact_invites').insert({
      owner_id: user.id,
      contact_id: contact.id,
      invite_type: type,
      secret_hash: secretHash,
      invited_email: email,
      invited_phone: phone,
      expires_at: expiresAt
    }).select('id').single();
    if (inviteError || !invite) {
      await admin.from('contacts').delete().eq('id', contact.id);
      throw inviteError || new Error('Could not save the invitation.');
    }

    try {
      if (type === 'email') {
        const origin = safeAppOrigin();
        const link = `${origin}/?invite=${encodeURIComponent(secret)}`;
        const { data: profile } = await admin.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
        const sender = escapeHtml(profile?.display_name || 'Someone you trust');
        const safeLink = escapeHtml(link);
        await sendYereEmail(email!, 'A trusted reminder invite from Yere',
          `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:28px;color:#1a2033"><h1 style="color:#4f46e5">You have been invited to Yere</h1><p>${sender} would like to remember the times, together.</p><p>This private link can be used once and expires in 24 hours.</p><p style="margin:28px 0"><a href="${safeLink}" style="background:#4f46e5;color:white;padding:14px 20px;border-radius:12px;text-decoration:none;font-weight:bold">Accept invitation</a></p><p style="font-size:12px;color:#64748b">If you were not expecting this, you can ignore this email.</p></div>`,
          `${profile?.display_name || 'Someone you trust'} invited you to Yere. Accept once within 24 hours: ${link}`);
      } else if (type === 'sms') {
        const sid = env('TWILIO_ACCOUNT_SID');
        const token = env('TWILIO_AUTH_TOKEN');
        const from = env('TWILIO_FROM_NUMBER');
        const origin = safeAppOrigin();
        const link = `${origin}/?invite=${encodeURIComponent(secret)}`;
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: 'POST',
          headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ To: phone!, From: from, Body: `Someone you trust invited you to Yere. Accept once within 24 hours: ${link}` })
        });
        if (!response.ok) throw new Error(`SMS provider rejected delivery (${response.status}).`);
      }
    } catch (deliveryError) {
      await admin.from('contact_invites').update({ revoked_at: new Date().toISOString() }).eq('id', invite.id);
      await admin.from('contacts').update({ status: 'revoked' }).eq('id', contact.id);
      throw deliveryError;
    }

    const { data: profile } = await admin.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
    await admin.from('audit_logs').insert({
      owner_id: user.id, actor_id: user.id, actor_name: profile?.display_name || 'Yere member',
      action: 'created invite', details: `${type} invitation · expires in 24 hours`
    });
    return jsonResponse({ inviteId: invite.id, code: type === 'code' ? secret : undefined, expiresAt });
  } catch (error) {
    console.error('create-contact-invite:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Invite creation failed.' }, 400);
  }
});
