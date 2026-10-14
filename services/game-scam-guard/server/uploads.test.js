import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApp} from './app.js';
import {scanUploadedFile,MAX_UPLOAD_BYTES} from './uploads.js';
const unknown=async()=>({status:'not_found',message:'Not found is not a safety guarantee'});

test('real multipart upload checks explicit consent, private-origin rejection and full byte hashing',async()=>{
  const app=createApp({uploadScan:upload=>scanUploadedFile(upload,{lookup:unknown})});const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  const form=consent=>{const body=new FormData();body.append('file',new Blob(['console.log("synthetic fixture")']),'private.js');body.append('mode','advanced');body.append('consent',consent);return body;};
  try{
    const rejected=await fetch(`${base}/api/upload`,{method:'POST',body:form('true'),headers:{Origin:'https://other.example'}});assert.equal(rejected.status,403);
    const noConsent=await fetch(`${base}/api/upload`,{method:'POST',body:form('false')});assert.equal(noConsent.status,400);
    const response=await fetch(`${base}/api/upload`,{method:'POST',body:form('true')});assert.equal(response.status,200);const report=await response.json();assert.equal(report.source,'upload');assert.equal(report.files[0].size,32);assert.match(report.files[0].sha256,/^[a-f0-9]{64}$/);assert.equal(report.files[0].artifact.executed,false);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('multipart oversize and malformed input return bounded errors without analysis',async()=>{
  let calls=0;const server=createApp({uploadScan:async()=>{calls++;}}).listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const body=new FormData();body.append('file',new Blob([Buffer.alloc(MAX_UPLOAD_BYTES+1)]),'big.bin');body.append('mode','advanced');body.append('consent','true');assert.equal((await fetch(`${base}/api/upload`,{method:'POST',body})).status,413);
    assert.equal((await fetch(`${base}/api/upload`,{method:'POST',headers:{'Content-Type':'multipart/form-data'},body:'bad'})).status,400);assert.equal(calls,0);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('production-safe JSON upload preserves arbitrary binary bytes and rejects invalid base64',async()=>{
  let received;const server=createApp({uploadScan:async upload=>{received=upload;return {bytes:upload.bytes.length};}}).listen(0,'127.0.0.1');await once(server,'listening');const url=`http://127.0.0.1:${server.address().port}/api/upload`;
  const bytes=Buffer.from([0,255,128,13,10,34,92,65]);
  const post=data=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'binary.zip',data,mode:'advanced',consent:true})});
  try{assert.equal((await post(bytes.toString('base64'))).status,200);assert.deepEqual(received.bytes,bytes);assert.equal(received.consent,'true');assert.equal((await post('invalid!?')).status,400);}
  finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
