import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const core = await read('supabase/migrations/202610120001_yere_core.sql');
const fireTable = core.match(/create table if not exists public.reminder_fires \([\s\S]*?\n\);/i)[0];
const migration = await read('supabase/migrations/20261019180536_notification_delivery_retries.sql');
const owner = '10000000-0000-4000-8000-000000000001', reminder = '10000000-0000-4000-8000-000000000002';
test('delivery claim/recovery migration executes in PostgreSQL', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create table public.push_subscriptions(id uuid primary key default gen_random_uuid(),owner_id uuid,device_token text unique,platform text,provider text,user_agent text,updated_at timestamptz);
      create table auth.users(id uuid primary key);
      create table public.reminders(id uuid primary key, owner_id uuid, due_at timestamptz, delivery_channel text default 'push', is_completed boolean default false, approval_status text default 'approved');
      ${fireTable} ${migration}
      insert into auth.users values('${owner}');`);
    const reset = async (age = '5 minutes') => db.exec(`truncate public.reminders cascade; insert into public.reminders(id,owner_id,due_at) values('${reminder}','${owner}',now()-interval '${age}');`);
    const claim = async () => (await db.query('select * from public.claim_due_reminder_fires(10)')).rows;
    await t.test('claims missed reminders older than two minutes exactly once while leased', async () => {
      await reset(); const first = await claim(); assert.equal(first.length, 1); assert.equal(first[0].attempt_count, 1); assert.ok(first[0].lease_id);
      assert.equal((await claim()).length, 0);
    });
    await t.test('recovers expired worker lease, preserves accepted-target checkpoints, fences stale workers', async () => {
      await reset(); const [first] = await claim();
      await db.exec(`update public.reminder_fires set lease_until=now()-interval '1 second', delivery_state='{"push:device-a":true,"email":true}'`);
      const [second] = await claim(); assert.equal(second.attempt_count, 2); assert.notEqual(second.lease_id, first.lease_id);
      assert.deepEqual(second.delivery_state, { 'push:device-a': true, email: true });
      const stale = await db.query('update public.reminder_fires set delivery_status=\'sent\' where id=$1 and lease_id=$2 returning id',[first.id, first.lease_id]); assert.equal(stale.rows.length, 0);
    });
    await t.test('backoff is respected, attempts are capped at three, interrupted final attempts leave queued state', async () => {
      await reset(); await claim();
      await db.exec("update public.reminder_fires set lease_until=null, next_attempt_at=now()+interval '1 minute',delivery_status='failed'"); assert.equal((await claim()).length, 0);
      await db.exec("update public.reminder_fires set next_attempt_at=now()-interval '1 second'"); assert.equal((await claim())[0].attempt_count, 2);
      await db.exec("update public.reminder_fires set lease_until=now()-interval '1 second'"); assert.equal((await claim())[0].attempt_count, 3);
      await db.exec("update public.reminder_fires set lease_until=now()-interval '1 second'"); assert.equal((await claim()).length, 0);
      const [fire] = (await db.query('select * from public.reminder_fires')).rows; assert.equal(fire.delivery_status, 'failed'); assert.equal(fire.next_attempt_at, null);
    });
    await t.test('sent fires and pre-migration failures are never automatically replayed', async () => {
      await reset(); await claim(); await db.exec("update public.reminder_fires set delivery_status='sent',lease_until=null,next_attempt_at=null"); assert.equal((await claim()).length,0);
      await db.exec("update public.reminder_fires set delivery_status='failed',attempt_count=0"); assert.equal((await claim()).length,0);
    });
    await t.test('catch-up is bounded to one hour; future/completed/unapproved/no-delivery reminders are excluded', async () => {
      await reset('61 minutes'); assert.equal((await claim()).length,0);
      await reset('-1 minute'); assert.equal((await claim()).length,0);
      for (const condition of ["is_completed=true", "approval_status='pending'", "delivery_channel='none'"]) {
        await reset(); await db.exec(`update public.reminders set ${condition}`); assert.equal((await claim()).length,0);
      }
    });
    await t.test('rescheduling creates a new occurrence; retry state stays on the old occurrence', async () => {
      await reset(); const [old] = await claim(); await db.exec("update public.reminders set due_at=due_at+interval '1 minute'"); const [next] = await claim(); assert.notEqual(next.id,old.id); assert.equal(next.attempt_count,1);
    });
    await t.test('claim RPC remains service-only', async () => {
      for (const role of ['anon','authenticated']) {
        const result = await db.query(`select has_function_privilege('${role}','public.claim_due_reminder_fires(integer)','execute') as allowed`); assert.equal(result.rows[0].allowed,false);
      }
      assert.equal((await db.query("select has_function_privilege('service_role','public.claim_due_reminder_fires(integer)','execute') as allowed")).rows[0].allowed,true);
    });
    await t.test('native token refresh preserves target ID and account reassignment is atomic', async () => {
      const register = async () => (await db.query("select public.register_native_push_token('test-native-device-token','android','fcm','test') as id")).rows[0].id;
      await assert.rejects(register, /Authentication required/);
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
      const first = await register(); assert.equal(await register(),first);
      const other = '10000000-0000-4000-8000-000000000003';
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]); assert.equal(await register(),first);
      const targets=(await db.query('select * from public.push_subscriptions')).rows;
      assert.equal(targets.length,1);assert.equal(targets[0].owner_id,other);
      assert.equal((await db.query("select has_function_privilege('anon','public.register_native_push_token(text,text,text,text)','execute') as allowed")).rows[0].allowed,false);
    });
    // Migration is safe to re-apply and does not alter existing grants/policies.
    await db.exec(migration);
  } finally { await db.close(); }
});
