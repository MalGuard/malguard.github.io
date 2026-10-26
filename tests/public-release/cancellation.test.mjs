import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
import * as model from '../../assets/public-release-model.mjs';

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function harness(){
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',dataset:{},disabled:true,hidden:false,listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},replaceChildren(){}});return nodes.get(id);};
 const bytes=new Uint8Array([1,2,3]),arrived=deferred(),deliver=deferred();let saves=0;
 const release={schemaVersion:'1.0.0',platform:'windows-x64',status:'public-download-ready',serviceUrl:model.INSTALLER_URL,filename:'MalGuard-Setup-x64.exe',version:'1.2.0',engineVersion:'1.1.0',build:'MG-1.2.0-WIN64-aaaaaaaaaaaa',sourceCommit:'a'.repeat(40),sha256:createHash('sha256').update(bytes).digest('hex'),size:3,partBytes:model.PART_BYTES,partCount:1,passwordRequired:false,deviceLicenseRequired:false,installerPasswordRequired:false,changes:{en:['Synthetic'],fa:['مصنوعی']}};
 const context={...model,language:()=> 'en',AbortController,Intl,Uint8Array,Blob,setTimeout:(...args)=>setTimeout(...args).unref(),clearTimeout,crypto:webcrypto,URL:{createObjectURL(){saves++;return 'blob:synthetic';},revokeObjectURL(){}},window:{addEventListener(){}},document:{getElementById:node,createElement:()=>({click(){},remove(){}}),body:{append(){}}},fetch:async url=>{
  if(url.endsWith('malguard-current-release.json'))return Response.json(release);
  if(url.endsWith('malguard-release-history.json'))return Response.json([]);
  // A late producer can finish after cancellation; UI must not overwrite Cancelled.
  return {ok:true,body:{getReader(){let done=false;return {async read(){if(done)return {done:true};arrived.resolve();await deliver.promise;done=true;return {done:false,value:bytes};},async cancel(){},releaseLock(){}};}}};
 }};
 const source=readFileSync(new URL('../../assets/public-release.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');vm.runInNewContext(source,context,{filename:'public-release.mjs'});
 for(let i=0;i<50&&node('downloadButton').disabled;i++)await new Promise(setImmediate);
 assert.equal(node('downloadButton').disabled,false,'synthetic valid metadata enables test transfer');
 return {node,context,arrived,deliver,saves:()=>saves};
}

test('cancellation remains visible when a late read completes and never saves a file',async()=>{
 const h=await harness(),pending=h.node('downloadForm').listeners.submit({preventDefault(){}});
 await h.arrived.promise;h.node('cancelDownload').listeners.click();
 assert.match(h.node('downloadStatus').textContent,/cancelled/i,'cancellation is announced immediately');
 h.deliver.resolve();await pending;
 assert.match(h.node('downloadStatus').textContent,/cancelled/i);
 assert.equal(h.saves(),0);assert.equal(h.node('downloadButton').disabled,false);assert.equal(h.node('cancelDownload').hidden,true);
 await h.node('downloadForm').listeners.submit({preventDefault(){}});
 assert.match(h.node('downloadStatus').textContent,/ready to save/);assert.equal(h.saves(),1,'a fresh explicit retry can save a verified synthetic file');
});

test('cancel during digest never offers a file and a digest failure remains an error',async()=>{
 const h=await harness(),hashStarted=deferred(),finishHash=deferred();
 h.context.crypto={subtle:{digest:async()=>{hashStarted.resolve();return finishHash.promise;}}};
 const pending=h.node('downloadForm').listeners.submit({preventDefault(){}});h.deliver.resolve();await hashStarted.promise;
 h.node('cancelDownload').listeners.click();finishHash.resolve(new Uint8Array(32).buffer);await pending;
 assert.match(h.node('downloadStatus').textContent,/cancelled/i);assert.equal(h.saves(),0);
 h.context.crypto={subtle:{digest:async()=>{throw new Error('synthetic_digest_failure');}}};
 await h.node('downloadForm').listeners.submit({preventDefault(){}});
 assert.match(h.node('downloadStatus').textContent,/Download stopped/);assert.equal(h.saves(),0);
});
