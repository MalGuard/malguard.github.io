import test from 'node:test';
import assert from 'node:assert/strict';
import {replyToBugReport} from '../assets/report-ai.mjs';
test('only consented accepted bug reports can trigger a model call, without contact fields',async()=>{
 const sent=[];const fetchImpl=async(url,options)=>{sent.push({url,body:JSON.parse(options.body)});return Response.json({generated:{selectedModel:'cf_qwen3',provider:'workers_ai_rest',text:'Try refreshing the page. This is a suggestion.'}});};
 for(const input of [{accepted:false,consent:true,kind:'bug'},{accepted:true,consent:false,kind:'bug'},{accepted:true,consent:true,kind:'security'}])assert.equal((await replyToBugReport({...input,message:'test bug message',fetchImpl})).status,'skipped');
 assert.equal(sent.length,0);const result=await replyToBugReport({accepted:true,consent:true,kind:'bug',message:'Issue for user@example.com password=secret123 https://private.example',name:'PRIVATE_NAME',email:'PRIVATE_EMAIL',fetchImpl});assert.equal(result.status,'replied');assert.equal(sent.length,1);assert.ok(!JSON.stringify(sent).includes('PRIVATE'));assert.ok(!JSON.stringify(sent).includes('secret123'));assert.ok(!JSON.stringify(sent).includes('user@example.com'));assert.ok(!JSON.stringify(sent).includes('https://private.example'));
});
test('failure or unsafe model claims cannot undo email acceptance or promise a fix',async()=>{
 const input={accepted:true,consent:true,kind:'bug',message:'test bug message'};
 assert.equal((await replyToBugReport({...input,fetchImpl:async()=>Response.json({error:'quota'},{status:429})})).status,'unavailable');
 assert.equal((await replyToBugReport({...input,fetchImpl:async()=>Response.json({generated:{selectedModel:'cf_qwen3',provider:'workers_ai_rest',text:'The bug is fixed'}})})).status,'unavailable');
});
