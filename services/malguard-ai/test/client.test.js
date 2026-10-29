import test from 'node:test';
import assert from 'node:assert/strict';
import {apiUrl,readStream} from '../../../ai/client.mjs';
test('client uses established API host only on canonical Pages hosts',()=>{
 assert.equal(apiUrl('chat','malguard.github.io'),'https://game-scam-guard-connected.vercel.app/api/malguard-ai/chat');assert.equal(apiUrl('status','www.malguard.site'),'https://game-scam-guard-connected.vercel.app/api/malguard-ai/status');assert.equal(apiUrl('status','localhost'),'/api/malguard-ai/status');assert.throws(()=>apiUrl('shell'));
});
test('stream decoder preserves Persian across split UTF-8 chunks',async()=>{
 const bytes=new TextEncoder().encode(JSON.stringify({result:{message:'سلام'}})+'\n');const received=[];
 await readStream(new Response(new ReadableStream({start(c){for(const b of bytes)c.enqueue(Uint8Array.of(b));c.close();}}),{headers:{'Content-Type':'application/x-ndjson'}}),r=>received.push(r));assert.equal(received[0].result.message,'سلام');
});
test('truncated and duplicate terminal streams fail visibly',async()=>{
 for(const data of ['{"event":{"phase":"tool_started"}}\n','{"result":{}}\n{"result":{}}\n'])await assert.rejects(readStream(new Response(data,{headers:{'Content-Type':'application/x-ndjson'}}),()=>{}));
});
