import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupportModel,previewSupportText} from '../services/support/server/support-model.mjs';

test('agent requires an exact user-reviewed redacted text digest',async()=>{
 const raw='Scanner failed for person@example.test token=secret-value';
 const preview=previewSupportText(raw);
 assert.ok(!preview.text.includes('secret-value'));
 assert.ok(!preview.text.includes('person@example.test'));
 let called=0;
 const model=createSupportModel({enabled:true,fetchImpl:async(_url,options)=>{
  called++;
  const data=JSON.parse(options.body);
  assert.ok(!data.message.includes('secret-value'));
  assert.equal(data.consent.modelShare,true);
  return {ok:true,text:async()=>JSON.stringify({generated:{
    selectedModel:'cf_qwen3',provider:'workers_ai_rest',text:'Try restarting the app and note the exact error.'
  }})};
 }});
 await assert.rejects(model.respond(raw,{approvedSha256:'0'.repeat(64)}),/support_preview_changed/);
 assert.equal(called,0);
 const answer=await model.respond(raw,{approvedSha256:preview.sha256,locale:'en'});
 assert.match(answer.text,/restarting/);
 assert.equal(called,1);
});

test('model outage, incorrect provider and unsupported fixed claims fail closed',async()=>{
 const raw='Scanner did not start',preview=previewSupportText(raw);
 assert.equal(createSupportModel({enabled:false}).ready,false);
 await assert.rejects(createSupportModel({enabled:false}).respond(raw,{approvedSha256:preview.sha256}),/unavailable/);
 for(const response of [
  {ok:false,text:async()=>'{}'},
  {ok:true,text:async()=>JSON.stringify({generated:{selectedModel:'other',provider:'somewhere',text:'hello'}})},
  {ok:true,text:async()=>JSON.stringify({generated:{selectedModel:'cf_qwen3',provider:'workers_ai_rest',text:'The bug is fixed'}})}
 ]){
  const m=createSupportModel({enabled:true,fetchImpl:async()=>response});
  await assert.rejects(m.respond(raw,{approvedSha256:preview.sha256}),/support_ai_unavailable/);
 }
});
