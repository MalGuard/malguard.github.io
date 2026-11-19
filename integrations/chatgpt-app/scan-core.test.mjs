import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePublicUrl,summarizeScan,performScan} from './scan-core.mjs';

test('accepts ordinary HTTPS URLs and drops fragments',()=>assert.equal(validatePublicUrl('example.org/a#frag'),'https://example.org/a'));
for(const candidate of ['http://localhost/x','http://127.0.0.1','http://[::1]/','file:///etc/passwd','https://foo.local','https://u:p@example.org','https://example.org/?token=123','https://example.org:8080','not a url','http://example.org/path?api_key=abc'])
  test('rejects non-public/sensitive input: '+candidate,()=>assert.throws(()=>validatePublicUrl(candidate)));
test('limited result never claims guaranteed safety',()=>{
  const r=summarizeScan({status:'limited',signals:[],limitations:[],pageFetch:{status:'done'}},'https://example.org/');
  assert.equal(r.status,'limited_no_threat_evidence');assert.match(r.message,/limited checks/);assert.equal(r.reputation_checked,false);
});
test('failed page fetch is inconclusive',()=>{
  const r=summarizeScan({status:'unavailable',signals:[],pageFetch:{status:'unavailable'}},'https://example.org/');
  assert.equal(r.status,'inconclusive');assert.equal(r.page_fetched,false);
});
test('danger evidence preserved and trimmed',()=>{
  const r=summarizeScan({status:'danger',signals:[{level:'danger',title:'Known threat',detail:'Threat evidence'},{level:'info',title:'Noise'}]},'https://example.org/');
  assert.equal(r.status,'suspicious_evidence');assert.equal(r.evidence.length,1);
});
test('scanner is called without report retention, cloud previews or third-party reputation',async()=>{
  let options;const r=await performScan('https://example.org',async(_u,o)=>{options=o;return {status:'limited',pageFetch:{status:'done'},signals:[]};});
  assert.equal(r.status,'limited_no_threat_evidence');assert.equal(options.retainReport,false);assert.equal(options.allowCloudPreview,false);assert.equal((await options.lookup()).status,'unconfigured');
});
