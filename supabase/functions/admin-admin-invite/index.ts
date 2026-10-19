import { consumeRateLimit, jsonResponse, normalizedEmail, preflight, readJson, safeAppOrigin } from '../_shared/http.ts';
import { requireAdmin } from '../_shared/admin.ts';

const ADMIN_ROLES = new Set(['admin', 'support', 'read_only']);

// Only approved, actionable messages leave the server. Never return raw Auth,
// SMTP or database errors (which can contain recipient details or credentials).
function invitationFailure(error: unknown, stage: string) {
  const failure = error as { code?: string; message?: string; status?: number };
  const code = typeof failure?.code === 'string' ? failure.code : '';
  if (stage === 'validation') return { status: 400, code: 'invalid_request', error: 'The invitation request is invalid. Refresh the page and try again.' };
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || failure?.status === 429) {
    return { status: 429, code: 'email_rate_limited', error: 'Supabase has temporarily limited invitation emails. Wait before trying again.' };
  }
  if (stage === 'lookup' && ['PGRST202', '42883'].includes(code)) {
    return { status: 503, code: 'invite_configuration_missing', error: 'The admin invitation database update is missing. Ask the site owner to apply the admin-invitation migration.' };
  }
  if (code === 'email_address_not_authorized') {
    return { status: 503, code: 'email_recipient_not_authorized', error: 'Supabase email delivery is restricted to authorized recipients. The site owner must configure a production SMTP provider in Supabase Auth.' };
  }
  if (code === 'email_address_invalid') return { status: 400, code: 'email_address_invalid', error: 'Supabase rejected this email address. Check the address and try again.' };
  if (stage === 'email' && ['email_exists', 'user_already_exists'].includes(code)) {
    return { status: 409, code: 'account_changed', error: 'This email is already registered. Refresh and retry so Yere can use the existing-account invitation flow.' };
  }
  if (stage === 'email') return { status: 502, code: 'invite_email_failed', error: 'Supabase could not send the administrator setup email. The site owner should check Auth email logs and SMTP configuration before retrying.' };
  if (stage === 'grant' && typeof failure?.message === 'string' && failure.message.includes('admin_invite_target_already_admin')) {
    return { status: 409, code: 'already_admin', error: 'This account already has administrator access. Its role was not changed. Manage it in Admin accounts and active sessions.' };
  }
  if (stage === 'grant') return { status: 500, code: 'invite_role_failed', error: 'The setup email was sent, but administrator access could not be saved. Ask the site owner to check the role-grant error before retrying.' };
  return { status: 500, code: 'invite_service_failed', error: 'The admin invitation service could not complete this request. Ask the site owner to check the error reference.' };
}

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  let stage = 'authorization';
  try {
    const result = await requireAdmin(req, 'super_admin');
    if ('response' in result) return result.response ?? jsonResponse({ error: 'Not found.' }, 404);
    const { context } = result;
    stage = 'validation';
    const body = await readJson(req, 4000);
    const email = normalizedEmail(body.email);
    const role = typeof body.role === 'string' ? body.role : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
    if (!email || !ADMIN_ROLES.has(role) || reason.length < 8) {
      return jsonResponse({ error: 'A valid email, non-super-admin role, and reason of at least 8 characters are required.' }, 400);
    }
    stage = 'rate_limit';
    if (!(await consumeRateLimit(context.admin, `admin-invite:${context.user.id}`, 'admin-invite', 5, 3600))) {
      return jsonResponse({ error: 'Admin invitation limit reached. Try again later.' }, 429);
    }

    stage = 'lookup';
    const { data: targets, error: lookupError } = await context.admin.rpc('lookup_admin_invite_target', { p_email: email });
    if (lookupError) throw lookupError;
    if (!Array.isArray(targets)) throw new Error('Invalid invitation lookup result.');
    if (targets.length > 1) return jsonResponse({ error: 'More than one account uses this email. Ask the site owner to review the accounts before granting access.', code: 'ambiguous_account' }, 409);
    const target = targets[0];
    if (target?.admin_role) {
      return jsonResponse({ error: 'This account already has administrator access. Its role was not changed. Manage its role or active status in Admin accounts and active sessions.', code: 'already_admin' }, 409);
    }
    if (target?.is_banned) return jsonResponse({ error: 'This account is disabled. Review its status in Users before granting administrator access.', code: 'account_disabled' }, 409);

    const redirectTo = `${safeAppOrigin()}/admin-access?flow=invite`;
    let invitedUserId = target?.user_id;
    const existingAccount = Boolean(target?.email_confirmed);
    stage = 'email';
    if (existingAccount) {
      // inviteUserByEmail rejects confirmed Auth users. Reuse their account and
      // deliver a secure Auth password-setup callback; never reset a password
      // here, return a login token, or create a duplicate account.
      const { error } = await context.admin.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
    } else {
      const { data, error } = await context.admin.auth.admin.inviteUserByEmail(email, { redirectTo });
      if (error) throw error;
      if (!data.user?.id || (invitedUserId && invitedUserId !== data.user.id)) throw new Error('Auth invitation did not return the expected user.');
      invitedUserId = data.user.id;
    }

    stage = 'grant';
    const { error: roleError } = await context.admin.rpc('grant_admin_invitation', {
      p_actor: context.user.id,
      p_user_id: invitedUserId,
      p_role: role,
      p_reason: reason,
      p_ip: context.ip,
      p_user_agent: context.userAgent
    });
    if (roleError) throw roleError;
    return jsonResponse({ ok: true, userId: invitedUserId, email, role, inviteSent: true, existingAccount });
  } catch (error) {
    const reference = crypto.randomUUID();
    const failure = invitationFailure(error, stage);
    const rawCode = (error as { code?: string })?.code;
    console.error('admin-admin-invite:', { reference, stage, code: typeof rawCode === 'string' && /^[a-zA-Z0-9_]{1,64}$/.test(rawCode) ? rawCode : failure.code });
    return jsonResponse({ error: `${failure.error} Reference: ${reference}`, code: failure.code, reference }, failure.status);
  }
});
