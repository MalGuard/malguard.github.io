import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {validateAttachmentSpec,validateCompletedFile,createAttachmentStorage,CHUNK_BYTES}
 from '../services/support/server/support-attachments.mjs';
import {createUploadService} from '../services/support/server/support-upload.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const ticketId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const fileId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function crc32(bytes){
 let crc=0xffffffff;
 for(const b of bytes){crc^=b;for(let j=0;j<8;j++)crc=(crc>>>1)^(crc&1?0xedb88320:0);}
 return (crc^0xffffffff)>>>0;
}
function chunk(type,data){
 const size=Buffer.alloc(4),checksum=Buffer.alloc(4),typ=Buffer.from(type);
 size.writeUInt32BE(data.length);checksum.writeUInt32BE(crc32(Buffer.concat([typ,data])));
 return Buffer.concat([size,typ,data,checksum]);
}
function png(){
 const head=Buffer.alloc(13);head.writeUInt32BE(1,0);head.writeUInt32BE(1,4);head[8]=8;head[9]=6;
 return Buffer.concat([
  Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),
  chunk('IDAT',deflateSync(Buffer.from([0,255,0,0,255]))),chunk('IEND',Buffer.alloc(0))
 ]);
}
test('5MiB cap, 512KiB chunking and strict metadata validation',()=>{
 const data=png();
 const spec={kind:'image',bytes:data.length,partCount:1,
  contentType:'image/png',sha256:sha(data),name:'safe.png'};
 assert.equal(validateAttachmentSpec(spec).bytes,data.length);
 assert.equal(validateCompletedFile(data,spec),sha(data));
 assert.equal(CHUNK_BYTES,512*1024);
 assert.throws(()=>validateAttachmentSpec({...spec,bytes:5*1024*1024+1}),/invalid_attachment/);
 assert.throws(()=>validateAttachmentSpec({...spec,contentType:'image/svg+xml'}),/unsupported_type/);
 assert.throws(()=>validateAttachmentSpec({...spec,name:'../../file.png'}),/invalid_filename/);
 assert.throws(()=>validateAttachmentSpec({...spec,partCount:3}),/invalid_attachment/);
});
test('PNG CRC, metadata injection and data corruption are rejected',()=>{
 const clean=png();
 const mutated=Buffer.from(clean);mutated[mutated.length-6]^=0x02;
 assert.throws(()=>validateCompletedFile(mutated,{kind:'image',bytes:mutated.length,sha256:sha(mutated)}),/invalid_png/);
 const withText=Buffer.concat([clean.subarray(0,clean.length-12),chunk('tEXt',Buffer.from('secret=test')),clean.subarray(clean.length-12)]);
 assert.throws(()=>validateCompletedFile(withText,{kind:'image',bytes:withText.length,sha256:sha(withText)}),/invalid_png/);
});
test('unredacted sensitive log cannot be finalized',()=>{
 const source=Buffer.from('ERROR failed auth token=unmasked-secret');
 assert.throws(()=>validateCompletedFile(source,{kind:'log',bytes:source.length,sha256:sha(source)}),
  /privacy_redaction_required/);
 const safe=Buffer.from('ERROR failed auth token=[REDACTED]');
 assert.equal(validateCompletedFile(safe,{kind:'log',bytes:safe.length,sha256:sha(safe)}),sha(safe));
});
test('private storage refuses missing bucket config before network',async()=>{
 let calls=0;
 const storage=createAttachmentStorage({url:'https://example.invalid',key:'x'.repeat(50),
  bucket:'support-private',fetchImpl:async()=>{calls++;throw Error('network');}});
 assert.equal(storage.enabled,false);
 await assert.rejects(storage.privateBucket(),/attachment_storage_unavailable/);
 assert.equal(calls,0);
});
test('chunked upload creates a private, model-denied file with exact-hash AI consent',async()=>{
 const file=png(),parts=[],blob=new Map(),key='tickets/'+ticketId+'/'+fileId+'/safe';
 let state='pending',approved=false,revoked=false,readySha=null;
 const meta={
  enabled:true,
  begin:async(_ticket,spec)=>({id:fileId,...spec}),
  get:async()=>({id:fileId,ticket_id:ticketId,kind:'image',content_type:'image/png',
    original_name:'safe.png',file_bytes:file.length,part_count:1,
    original_object_key:key,original_sha256:sha(file),sanitized_sha256:readySha,state}),
  part:async(_ticket,_id,index,length,checksum,path)=>{parts.push({part_index:index,byte_size:length,part_sha256:checksum,object_key:path});return true;},
  parts:async()=>parts,
  ready:async(_ticket,_id,digest)=>{state='ready';readySha=digest;return {state};},
  approve:async(_ticket,_id,digest)=>{approved=digest===readySha;return true;},
  revoke:async()=>{revoked=true;return true;},
  list:async()=>[],consents:async()=>[],
  eligibleForCleanup:async()=>[]
 };
 const storage={enabled:true,privateBucket:async()=>{},
  put:async(path,data)=>{blob.set(path,data);},
  read:async(path)=>blob.get(path),
  remove:async(path)=>{blob.delete(path);}
 };
 const upload=createUploadService({meta,storage,enabled:true});
 const spec={kind:'image',bytes:file.length,partCount:1,contentType:'image/png',
  sha256:sha(file),name:'safe.png',reviewed:true};
 const started=await upload.begin(ticketId,spec);
 assert.equal(started.attachmentId,fileId);
 await upload.chunk(ticketId,{attachmentId:fileId,index:0,data:file.toString('base64')});
 const done=await upload.finish(ticketId,{attachmentId:fileId});
 assert.equal(done.modelAccess,false);
 assert.equal(blob.has(key),true);
 assert.equal(blob.has(key+'/parts/0'),false);
 assert.equal(approved,false);
 await assert.rejects(upload.approve(ticketId,{attachmentId:fileId,sha256:sha(file),agree:false}),/explicit_consent_required/);
 await upload.approve(ticketId,{attachmentId:fileId,sha256:sha(file),agree:true});
 assert.equal(approved,true);
 await upload.revoke(ticketId,{attachmentId:fileId});
 assert.equal(revoked,true);
});
