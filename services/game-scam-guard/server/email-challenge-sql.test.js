import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {createChallengeStore} from './challenge-store.js';
const require=createRequire(import.meta.url);
const {PGlite}=require(process.env.MALGUARD_TEST_PGLITE||'@electric-sql/pglite');

test('actual PostgreSQL ledger enforces budgets, consumption, expiry and role boundaries',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon; create role authenticated; create role service_role;');
  await db.exec(await readFile(new URL('../supabase/email_challenges.sql',import.meta.url),'utf8'));
  const query=async(sql,args)=>(await db.query(sql,args)).rows[0].value;
  const id=randomUUID(),subject='a'.repeat(64);
  assert.equal(await query('select public.guard_issue_email_challenge($1,$2) as value',[id,subject]),true);
  for(let i=0;i<5;i++)assert.equal(await query('select public.guard_attempt_email_challenge($1,false) as value',[id]),false);
  assert.equal(await query('select public.guard_attempt_email_challenge($1,true) as value',[id]),false);
  const second=randomUUID();await query('select public.guard_issue_email_challenge($1,$2) as value',[second,subject]);
  const attempts=await Promise.all(Array.from({length:8},()=>query('select public.guard_attempt_email_challenge($1,true) as value',[second])));
  assert.equal(attempts.filter(Boolean).length,1);
  const third=randomUUID();await query('select public.guard_issue_email_challenge($1,$2) as value',[third,subject]);
  assert.equal(await query('select public.guard_issue_email_challenge($1,$2) as value',[randomUUID(),subject]),false);
  await db.query('update public.guard_email_challenges set expires_at=clock_timestamp() where id=$1',[third]);
  assert.equal(await query('select public.guard_attempt_email_challenge($1,true) as value',[third]),false);
  await db.query("update public.guard_email_challenge_rates set window_start=clock_timestamp()-interval '16 minutes' where subject=$1",[subject]);
  assert.equal(await query('select public.guard_issue_email_challenge($1,$2) as value',[randomUUID(),subject]),true);
  const rows=(await db.query("select relrowsecurity from pg_class where relname in ('guard_email_challenges','guard_email_challenge_rates')")).rows;
  assert.equal(rows.length,2);assert.ok(rows.every(r=>r.relrowsecurity));
  for(const role of ['anon','authenticated']){
   assert.equal(await query("select has_table_privilege($1,'public.guard_email_challenges','SELECT') as value",[role]),false);
   assert.equal(await query("select has_function_privilege($1,'public.guard_attempt_email_challenge(uuid,boolean)','EXECUTE') as value",[role]),false);
   await db.exec(`set role ${role}`);
   await assert.rejects(()=>db.query('select public.guard_attempt_email_challenge($1,true)',[randomUUID()]),/permission denied/);
   await db.exec('reset role');
  }
  assert.equal(await query("select has_function_privilege('service_role','public.guard_attempt_email_challenge(uuid,boolean)','EXECUTE') as value",[]),true);
  // Exercise the real HTTP adapter contract against the actual SQL functions.
  const fetchImpl=async(url,options)=>{const p=JSON.parse(options.body),name=new URL(url).pathname.split('/').at(-1);const args=name==='guard_issue_email_challenge'?[p.p_id,p.p_subject]:[p.p_id,p.p_matched];const sql=name==='guard_issue_email_challenge'?'select public.guard_issue_email_challenge($1,$2) as value':'select public.guard_attempt_email_challenge($1,$2) as value';return Response.json(await query(sql,args));};
  const store=createChallengeStore({url:'https://synthetic.supabase.co/rest/v1',key:'synthetic-service-role-for-tests',fetchImpl});const fresh=randomUUID();assert.equal(await store.issue({id:fresh,subject:'b'.repeat(64)}),true);assert.equal(await store.attempt({id:fresh,matched:true}),true);assert.equal(await store.attempt({id:fresh,matched:true}),false);
 }finally{await db.close();}
});
