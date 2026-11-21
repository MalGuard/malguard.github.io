import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupportStore} from '../services/support/server/support-store.mjs';

const T='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const origin='https://test-project.supabase.co';
const key='synthetic-no-credentials-'.repeat(3);
test('store returns latest 50 messages in ascending order without exposing credentials',async()=>{
  const urls=[];
  const store=createSupportStore({url:origin,key,fetchImpl:async(url,options)=>{
    urls.push({url,headers:options.headers});
    return {ok:true,status:200,text:async()=>JSON.stringify([
      {content:'newer',created_at:'2026-11-20T02:00:00Z'},
      {content:'older',created_at:'2026-11-20T01:00:00Z'}])};
  }});
  const rows=await store.messages(T);
  assert.deepEqual(rows.map(x=>x.content),['older','newer']);
  assert.match(urls[0].url,/order=created_at\.desc&limit=50/);
  assert.equal(urls[0].headers.apikey,key);
  assert.ok(!JSON.stringify(rows).includes(key));
});
test('invalid ticket id cannot become a REST filter',async()=>{
  let calls=0;
  const store=createSupportStore({url:origin,key,fetchImpl:async()=>{calls++;throw Error('should not fetch');}});
  assert.equal(await store.ticket('id)or(status.eq.open'),null);
  assert.equal(calls,0);
  await assert.rejects(store.messages('not-a-uuid'),e=>e.status===400);
});
test('RPC rate responses are fail closed and error messages do not reveal provider detail',async()=>{
  const store=createSupportStore({url:origin,key,fetchImpl:async()=>({
    ok:true,status:200,text:async()=>'false'
  })});
  assert.equal(await store.takeRate('f'.repeat(64),2,3600),false);
  const failed=createSupportStore({url:origin,key,fetchImpl:async()=>({
    ok:false,status:503,text:async()=>JSON.stringify({message:'internal private database context'})
  })});
  await assert.rejects(failed.takeRate('f'.repeat(64),2,3600),
    error=>error.code==='support_store_unavailable'&&!error.message.includes('database context'));
});
test('untrusted Supabase URL is rejected before network access',async()=>{
  let calls=0;
  const store=createSupportStore({url:'https://test-project.supabase.co.evil.invalid',key,
    fetchImpl:async()=>{calls++;throw Error('must not call');}});
  assert.equal(store.enabled,false);
  await assert.rejects(store.takeRate('f'.repeat(64),2,3600),e=>e.status===503);
  assert.equal(calls,0);
});
