import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const source = await readFile(new URL('../supabase/migrations/20261025234615_operational_retention.sql', import.meta.url),'utf8');
const id = n => `20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('operational retention respects age, resolution, holds, audit immutability and caller permissions', async t => {
 const db = new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema cron;
   create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;
   create table public.notification_logs(id uuid primary key,created_at timestamptz);
   create table public.support_tickets(id uuid primary key,status text,updated_at timestamptz);
   create table public.admin_audit_logs(id uuid primary key,created_at timestamptz);
   create table public.admin_sessions(id uuid primary key,expires_at timestamptz,revoked_at timestamptz);
   create table public.reminders(id uuid primary key,title text);
   create function public.reject_admin_audit_mutation() returns trigger language plpgsql as $$begin raise exception 'Admin audit logs are immutable'; end;$$;
   create trigger admin_audit_logs_immutable before update or delete on public.admin_audit_logs for each row execute function public.reject_admin_audit_mutation();`);
  await db.exec(source.replaceAll('2026-11-25 05:00:00+00','2999-01-01 00:00:00+00'));
  await t.test('activation grace never deletes anything',async()=>{
   assert.equal((await db.query('select public.purge_expired_operational_records() as result')).rows[0].result.status,'grace_period');
  });
  // Advance only this isolated test fixture past the gate; no production clock override exists.
  await db.exec(source.replaceAll('2026-11-25 05:00:00+00','2000-01-01 00:00:00+00'));
  await db.exec(`insert into notification_logs values('${id(1)}',now()-interval '91 days'),('${id(2)}',now()-interval '89 days'),('${id(3)}',now()-interval '100 days');
   insert into support_tickets values('${id(4)}','closed',now()-interval '13 months'),('${id(5)}','resolved',now()-interval '11 months'),('${id(6)}','open',now()-interval '15 months'),('${id(7)}','in_progress',now()-interval '15 months');
   insert into admin_audit_logs values('${id(8)}',now()-interval '25 months'),('${id(9)}',now()-interval '23 months'),('${id(10)}',now()-interval '30 months');
   insert into admin_sessions values('${id(11)}',now()-interval '31 days',null),('${id(12)}',now()+interval '1 day',null),('${id(13)}',now()-interval '50 days',now()-interval '2 days');
   insert into reminders values('${id(14)}','Keep original user content');
   insert into retention_holds(category,record_id,reason)values('notification_logs','${id(3)}','Specific delivery incident'),('admin_audit_logs','${id(10)}','Litigation preservation');`);
  await t.test('ordinary audit writes/deletes still fail, including spoofed retention flag',async()=>{
   await assert.rejects(db.exec(`update admin_audit_logs set created_at=now() where id='${id(8)}'`),/immutable/);
   await assert.rejects(db.exec(`delete from admin_audit_logs where id='${id(8)}'`),/immutable/);
   await db.exec('grant select,delete,update on admin_audit_logs to service_role; set role service_role;');
   await db.query("select set_config('yere.retention_job','on',false)");
   await assert.rejects(db.exec(`delete from admin_audit_logs where id='${id(8)}'`),/immutable|permission denied/);
   await db.exec('reset role'); await db.query("select set_config('yere.retention_job','off',false)");
  });
  await t.test('only expired, unheld records are removed; open cases and workspace survive',async()=>{
   const result=(await db.query('select public.purge_expired_operational_records() as result')).rows[0].result;
   assert.deepEqual(result,{status:'completed',notification_logs:1,support_tickets:1,admin_audit_logs:1,admin_sessions:1});
   for(const [table,count]of[['notification_logs',2],['support_tickets',3],['admin_audit_logs',2],['admin_sessions',2],['reminders',1]]) assert.equal((await db.query(`select count(*)::int as count from ${table}`)).rows[0].count,count,table);
  });
  await t.test('category holds and explicit release work; holds do not expire silently',async()=>{
   await db.exec(`insert into retention_holds(category,reason,review_at) values('notification_logs','Category preservation',now()-interval '1 day'); update retention_holds set released_at=now() where record_id='${id(3)}';`);
   assert.equal((await db.query('select public.purge_expired_operational_records() as result')).rows[0].result.notification_logs,0);
   await db.exec("update retention_holds set released_at=now() where category='notification_logs'");
   assert.equal((await db.query('select public.purge_expired_operational_records() as result')).rows[0].result.notification_logs,1);
  });
  await t.test('cleanup and hold tables are not available to any application role',async()=>{
   for(const role of ['anon','authenticated','service_role']){
    assert.equal((await db.query(`select has_function_privilege('${role}','public.purge_expired_operational_records()','execute') as allowed`)).rows[0].allowed,false);
    assert.equal((await db.query(`select has_table_privilege('${role}','public.retention_holds','select') as allowed`)).rows[0].allowed,false);
   }
  });
 } finally {await db.close();}
});
