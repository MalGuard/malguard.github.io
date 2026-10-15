import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
import {performance} from 'node:perf_hooks';
let engine;
async function loadEngine(){
  const rules=JSON.parse(await readFile(new URL('./vendor/gta-pe-rules.json',import.meta.url),'utf8'));
  const context={TextDecoder,TextEncoder,crypto:webcrypto,performance,setTimeout,clearTimeout,AbortController,console:{warn(){},log(){},error(){}},fetch:async url=>({ok:url==='rules.json',status:url==='rules.json'?200:503,json:async()=>url==='rules.json'?rules:{}})};
  context.window=context;createContext(context);
  // Only pinned MIT engine SOURCE is loaded. Sample bytes are never code passed
  // to runInContext/eval. The resource-bounded static parser Worker is outside it.
  runInContext(await readFile(new URL('./vendor/gta-pe-engine.cjs',import.meta.url),'utf8'),context,{timeout:2000,filename:'trusted-gta-pe-engine'});
  return context.scanFile;
}
export async function inspectGtaPe(bytes,name){
  if(!/\.(dll|asi)$/i.test(name))return null;
  engine ||= loadEngine();const scan=await engine;
  const file=data=>({name,size:data.length,arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),slice:(start,end)=>file(data.subarray(start,end))});
  const result=await scan(file(bytes));
  return {engine:'GTA Guard PE',version:result.engineVersion,rulesVersion:result.rulesVersion,rulesStatus:result.rulesStatus,peValid:result.peValid,verdict:result.verdict,suspicionScore:result.ok?100-result.score:null,evidence:(result.evidence||[]).slice(0,24),reasons:(result.reasons||[]).slice(0,12),summary:result.peSummary||null,scope:'static-dll-asi',executed:false};
}
