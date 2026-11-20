import test from 'node:test';
import assert from 'node:assert/strict';
import {createIndependentReviewers,validateReviewerResult} from '../services/support/server/support-review.mjs';
import {readyForRelease} from '../services/support/server/ticket-policy.mjs';
const sha='a'.repeat(40);
const request={commitSha:sha,patch:'diff --git a/file.js b/file.js\n+const value = true;',summary:'Unit tests pass',
 reporterApproved:true,ownerApproved:true,scope:'public'};
test('two independent reviewers see the same diff and return commit-bound verdicts',async()=>{
 const calls=[];
 const reviewer=createIndependentReviewers({enabled:true,fetchImpl:async(_url,options)=>{
  const message=JSON.parse(options.body).message;
  const kind=message.includes('independent security reviewer')?'security':'quality';
  calls.push({kind,message});
  const result={reviewer:kind,commitSha:sha,verdict:'approved',findings:[]};
  return {ok:true,text:async()=>JSON.stringify({generated:{
    selectedModel:'cf_qwen3',provider:'workers_ai_rest',text:JSON.stringify(result)
  }})};
 }});
 const result=await reviewer.run(request);
 assert.equal(result.approved,true);
 assert.deepEqual(result.reviews.map(r=>r.reviewer).sort(),['quality','security']);
 assert.equal(calls.length,2);
 assert.ok(calls[0].message.includes(request.patch)&&calls[1].message.includes(request.patch));
 assert.ok(!calls[0].message.includes('reviewer verdict'));
 const gate=readyForRelease({
   commitSha:sha,reporterApproved:true,ownerChangeApproved:true,
   ownerDeployApproval:{commitSha:sha,approved:true},
   reviews:result.reviews,requiredChecks:[{commitSha:sha,status:'success'}]
 });
 assert.equal(gate,true);
});
test('model failure or malformed review is inconclusive and blocks release',async()=>{
 const model=createIndependentReviewers({enabled:true,fetchImpl:async(_url,options)=>{
  const kind=JSON.parse(options.body).message.includes('independent security reviewer')?'security':'quality';
  if(kind==='security')throw Error('provider offline');
  return {ok:true,text:async()=>JSON.stringify({generated:{
    selectedModel:'cf_qwen3',provider:'workers_ai_rest',
    text:JSON.stringify({reviewer:'quality',commitSha:sha,verdict:'approved',findings:[]})
  }})};
 }});
 const outcome=await model.run(request);
 assert.equal(outcome.approved,false);
 assert.equal(outcome.reviews[0].verdict,'inconclusive');
 assert.equal(validateReviewerResult('security',sha,'some confident-sounding prose'),null);
 assert.equal(validateReviewerResult('security',sha,{reviewer:'security',commitSha:'b'.repeat(40),verdict:'approved',findings:[]}),null);
});
test('private repo excerpts need extra owner consent and redaction even when repo-read approved',async()=>{
 const model=createIndependentReviewers({enabled:true,fetchImpl:async()=>{throw Error('no provider calls expected');}});
 await assert.rejects(model.run({...request,scope:'private',privateCodeShareApproved:false}),/private_code_model_consent_required/);
 await assert.rejects(model.run({...request,patch:'token=PRIVATESECRET'}),/unredacted_review_data/);
 await assert.rejects(model.run({...request,ownerApproved:false}),/review_not_authorized/);
});
