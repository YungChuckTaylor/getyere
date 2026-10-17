import type { User } from 'npm:@supabase/supabase-js@2';
import { adminClient, authenticatedUser, consumeRateLimit, jsonResponse, sha256 } from './http.ts';

export type AdminRole = 'super_admin' | 'admin' | 'support' | 'read_only';
const ROLE_RANK: Record<AdminRole, number> = { read_only: 1, support: 2, admin: 3, super_admin: 4 };

export type AdminContext = {
  user: User;
  role: AdminRole;
  token: string;
  sessionId: string;
  ip: string | null;
  userAgent: string | null;
  admin: ReturnType<typeof adminClient>;
};

export function requestIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const value = forwarded || req.headers.get('x-real-ip')?.trim() || null;
  return value && value.length <= 128 ? value : null;
}

export function accessTokenFromRequest(req: Request) {
  const value = req.headers.get('Authorization') || '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

// The token is first signature-validated with Supabase Auth before these claims are trusted.
export function aalFromVerifiedToken(token: string) {
  try {
    const part = token.split('.')[1];
    if (!part) return 'aal1';
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    return typeof payload.aal === 'string' ? payload.aal : 'aal1';
  } catch {
    return 'aal1';
  }
}

export function mfaRequired(role: AdminRole) {
  return role === 'admin' || role === 'super_admin';
}

export function isRoleAtLeast(actual: AdminRole, required: AdminRole) {
  return Object.hasOwn(ROLE_RANK, actual) && Object.hasOwn(ROLE_RANK, required)
    && ROLE_RANK[actual] >= ROLE_RANK[required];
}

export function genericNotFound() {
  return jsonResponse({ error: 'Not found.' }, 404);
}

export async function validateAdminIdentity(req: Request, requireMfa = true) {
  const token = accessTokenFromRequest(req);
  if (!token) return { response: genericNotFound() } as const;
  const { user, error } = await authenticatedUser(req);
  if (error || !user) return { response: genericNotFound() } as const;

  const admin = adminClient();
  const { data: adminUser, error: adminError } = await admin.from('admin_users')
    .select('role,is_active').eq('user_id', user.id).maybeSingle();
  if (adminError || !adminUser?.is_active || !Object.hasOwn(ROLE_RANK, adminUser.role)) return { response: genericNotFound() } as const;
  const role = adminUser.role as AdminRole;
  const aal = aalFromVerifiedToken(token);
  if (requireMfa && mfaRequired(role) && aal !== 'aal2') {
    return { response: jsonResponse({ error: 'Additional authentication is required.', code: 'mfa_required' }, 403) } as const;
  }
  return { admin, role, token, user, aal } as const;
}

export async function requireAdmin(req: Request, minimum: AdminRole = 'read_only') {
  const identity = await validateAdminIdentity(req, true);
  if ('response' in identity) return { response: identity.response } as const;
  if (!isRoleAtLeast(identity.role, minimum)) return { response: genericNotFound() } as const;

  const tokenHash = await sha256(identity.token);
  const now = new Date().toISOString();
  const { data: session, error: sessionError } = await identity.admin.from('admin_sessions')
    .select('id').eq('user_id', identity.user.id).eq('token_hash', tokenHash)
    .is('revoked_at', null).gt('expires_at', now).maybeSingle();
  if (sessionError || !session) return { response: genericNotFound() } as const;

  const allowed = await consumeRateLimit(identity.admin, `admin-api:${identity.user.id}`, 'admin-api', 180, 60);
  if (!allowed) return { response: jsonResponse({ error: 'Too many administrative requests. Try again shortly.' }, 429) } as const;

  const ip = requestIp(req);
  const userAgent = (req.headers.get('user-agent') || '').slice(0, 512) || null;
  await identity.admin.from('admin_sessions').update({ last_seen_at: now }).eq('id', session.id);
  return { context: { ...identity, sessionId: session.id, ip, userAgent } as AdminContext } as const;
}

export async function auditAdmin(context: AdminContext, action: string, targetTable?: string | null, targetId?: string | null, metadata: Record<string, unknown> = {}) {
  const { error } = await context.admin.from('admin_audit_logs').insert({
    admin_id: context.user.id,
    action: action.slice(0, 120),
    target_table: targetTable?.slice(0, 80) || null,
    target_id: targetId?.slice(0, 160) || null,
    metadata,
    ip: context.ip,
    user_agent: context.userAgent
  });
  if (error) throw error;
}

export function safeError(error: unknown) {
  console.error('Admin function failed:', error);
  return jsonResponse({ error: 'The administrative request could not be completed.' }, 500);
}
