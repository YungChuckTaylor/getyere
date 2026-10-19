import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const foundation = await read('supabase/migrations/202610140001_admin_backend.sql');
const migration = await read('supabase/migrations/20261019141922_admin_invite_existing_accounts.sql');
const table = name => foundation.match(new RegExp(`create table if not exists public\\.${name} \\([\\s\\S]*?\\n\\);`, 'i'))[0];
const setRoleEnd = foundation.indexOf(';', foundation.indexOf('GRANT EXECUTE ON FUNCTION public.set_admin_role')) + 1;
const setRole = foundation.slice(foundation.indexOf('CREATE OR REPLACE FUNCTION public.set_admin_role('), setRoleEnd);
const actor = '10000000-0000-4000-8000-000000000001';
const target = '10000000-0000-4000-8000-000000000002';
const banned = '10000000-0000-4000-8000-000000000003';
const deleted = '10000000-0000-4000-8000-000000000004';

test('admin invitation SQL executes in PostgreSQL with service-only, audited, non-overwriting grants', async t => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (
        id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz,
        banned_until timestamptz, deleted_at timestamptz
      );
      ${table('admin_users')}
      ${table('admin_audit_logs')}
      ${setRole}
      ${migration}
      INSERT INTO auth.users (id,email,email_confirmed_at) VALUES
        ('${actor}','owner@example.test',now()), ('${target}','person@example.test',now());
      INSERT INTO auth.users (id,email,banned_until,deleted_at) VALUES
        ('${banned}','banned@example.test',now()+interval '1 day',NULL),
        ('${deleted}','deleted@example.test',NULL,now());
      INSERT INTO public.admin_users (user_id,role,is_active) VALUES ('${actor}','super_admin',true);
    `);
    await t.test('lookup matches normalized email and exposes only invitation metadata', async () => {
      const { rows } = await db.query("SELECT * FROM public.lookup_admin_invite_target(' PERSON@EXAMPLE.TEST ')");
      assert.deepEqual(rows, [{ user_id: target, email_confirmed: true, is_banned: false, admin_role: null, admin_active: null }]);
      assert.equal((await db.query("SELECT * FROM public.lookup_admin_invite_target('banned@example.test')")).rows[0].is_banned, true);
      assert.equal((await db.query("SELECT * FROM public.lookup_admin_invite_target('deleted@example.test')")).rows.length, 0);
    });
    await t.test('neither ordinary Auth role can call either function', async () => {
      for (const role of ['anon', 'authenticated', 'service_role']) {
        for (const signature of ['lookup_admin_invite_target(text)', 'grant_admin_invitation(uuid,uuid,text,text,text,text)']) {
          const { rows } = await db.query('SELECT has_function_privilege($1, $2, $3) AS allowed', [role, signature, 'EXECUTE']);
          assert.equal(rows[0].allowed, role === 'service_role');
        }
      }
    });
    const grant = (user, role = 'admin', by = actor) => db.query(
      'SELECT public.grant_admin_invitation($1,$2,$3,$4,NULL,NULL)', [by, user, role, 'Operations access approval']
    );
    await t.test('non-admin actors, super-admin invitations and disabled targets fail closed', async () => {
      await assert.rejects(grant(target, 'admin', target), /active super admin/);
      await assert.rejects(grant(target, 'super_admin'), /Invalid invitation role/);
      await assert.rejects(grant(banned), /admin_invite_target_unavailable/);
      await assert.rejects(grant(deleted), /admin_invite_target_unavailable/);
      assert.equal((await db.query('SELECT count(*)::integer AS count FROM public.admin_audit_logs')).rows[0].count, 0);
    });
    await t.test('a permitted invitation writes the role and its audit entry together', async () => {
      await grant(target);
      assert.deepEqual((await db.query('SELECT role,is_active,created_by FROM public.admin_users WHERE user_id=$1', [target])).rows,
        [{ role: 'admin', is_active: true, created_by: actor }]);
      const audit = (await db.query('SELECT admin_id,action,target_id,metadata FROM public.admin_audit_logs')).rows[0];
      assert.equal(audit.admin_id, actor); assert.equal(audit.action, 'admin_role_updated'); assert.equal(audit.target_id, target);
      assert.equal(audit.metadata.reason, 'Operations access approval');
    });
    await t.test('retries cannot change an existing administrator or super administrator', async () => {
      await assert.rejects(grant(target, 'read_only'), /admin_invite_target_already_admin/);
      await assert.rejects(grant(actor, 'support'), /admin_invite_target_already_admin/);
      assert.equal((await db.query('SELECT role FROM public.admin_users WHERE user_id=$1', [target])).rows[0].role, 'admin');
      assert.equal((await db.query('SELECT role FROM public.admin_users WHERE user_id=$1', [actor])).rows[0].role, 'super_admin');
      assert.equal((await db.query('SELECT count(*)::integer AS count FROM public.admin_audit_logs')).rows[0].count, 1);
    });
    await t.test('inactive admin accounts cannot be reactivated by an invitation', async () => {
      await db.query('UPDATE public.admin_users SET is_active=false WHERE user_id=$1', [target]);
      await assert.rejects(grant(target), /admin_invite_target_already_admin/);
      assert.equal((await db.query('SELECT is_active FROM public.admin_users WHERE user_id=$1', [target])).rows[0].is_active, false);
    });
  } finally { await db.close(); }
});
