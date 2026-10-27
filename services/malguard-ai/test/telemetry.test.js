import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createTelemetry} from '../server/telemetry.js';

test('telemetry keeps only fixed metadata and never arbitrary private fields',()=>{
 const lines=[],telemetry=createTelemetry({sink:e=>lines.push(e)}),id=randomUUID();
 telemetry.record({requestId:id,endpoint:'/chat',statusCode:429,errorCode:'provider_rate_limited',durationMs:12,message:'PRIVATE_PROMPT',token:'PRIVATE_TOKEN',url:'https://private.example/?secret=x',provider:'PRIVATE_PROVIDER'});
 const entry=lines[0];assert.equal(entry.requestId,id);assert.equal(entry.correlationId,id);assert.equal(entry.severity,'WARN');assert.equal(entry.errorCode,'provider_rate_limited');assert.ok(!JSON.stringify(lines).includes('PRIVATE'));assert.ok(!JSON.stringify(lines).includes('private.example'));assert.equal(entry.provider,'unknown');assert.match(entry.eventId,/^[a-f0-9-]{36}$/);
});
test('retention, ring size and output rate are bounded independently',()=>{
 let clock=1000;const lines=[],telemetry=createTelemetry({now:()=>clock,sink:e=>lines.push(e),capacity:2,retentionMs:1000,maxPerMinute:2});
 for(let i=0;i<3;i++)telemetry.record({requestId:randomUUID(),endpoint:'/status',statusCode:200});
 assert.equal(lines.length,2);assert.equal(telemetry.snapshot().length,2);assert.equal(telemetry.health().dropped,1);clock+=1001;assert.equal(telemetry.snapshot().length,0);
});
test('logging failures do not throw or reveal sink errors',()=>{
 const telemetry=createTelemetry({sink:()=>{throw Error('PRIVATE_CREDENTIAL');}});
 assert.doesNotThrow(()=>telemetry.record({requestId:randomUUID(),endpoint:'/chat',statusCode:500,errorCode:'PRIVATE_ERROR'}));assert.equal(telemetry.health().sinkFailures,1);assert.ok(!JSON.stringify(telemetry.snapshot()).includes('PRIVATE'));
});
test('snapshot returns copies and only accepts valid tracking identifiers',()=>{
 const telemetry=createTelemetry({sink:()=>{}}),id=randomUUID();telemetry.record({requestId:id,endpoint:'/chat',statusCode:200});const first=telemetry.snapshot(id);first[0].severity='CRITICAL';assert.equal(telemetry.snapshot(id)[0].severity,'INFO');assert.deepEqual(telemetry.snapshot('not-an-id'),[]);
});
test('async sink failures are handled and outstanding writes are bounded',async()=>{
 const failed=createTelemetry({sink:async()=>{throw Error('PRIVATE_ASYNC_ERROR');}});failed.record({requestId:randomUUID(),statusCode:200});await new Promise(setImmediate);assert.equal(failed.health().sinkFailures,1);
 const releases=[],slow=createTelemetry({sink:()=>new Promise(resolve=>releases.push(resolve))});for(let i=0;i<8;i++)slow.record({requestId:randomUUID(),statusCode:200});assert.equal(releases.length,5);assert.equal(slow.health().pending,5);releases.forEach(resolve=>resolve());await new Promise(setImmediate);assert.equal(slow.health().pending,0);
});
