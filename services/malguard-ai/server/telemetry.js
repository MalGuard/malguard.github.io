import {randomUUID} from 'node:crypto';
import {publicFailure} from '../../../ai/service-errors.mjs';
import {MODELS} from './contracts.js';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const providers=new Set(['workers_ai_rest','workers_ai','cloudflare','cloudflare_workers_ai','gemini','groq','malguard','gateway']);
const bound=(value,fallback,max)=>Number.isInteger(value)?Math.max(1,Math.min(value,max)):fallback;
export function createTelemetry({now=Date.now,sink=entry=>console.info(JSON.stringify(entry)),capacity=250,retentionMs=3600000,maxPerMinute=300,env=process.env}={}){
 capacity=bound(capacity,250,1000);retentionMs=bound(retentionMs,3600000,86400000);maxPerMinute=bound(maxPerMinute,300,10000);
 const rows=[];let windowStart=now(),emitted=0,dropped=0,sinkFailures=0,pending=0;
 const prune=()=>{const oldest=now()-retentionMs;while(rows.length&&rows[0].at<=oldest)rows.shift();};
 return {
  record(input={}){
   const time=now(),requestId=uuid.test(input.requestId||'')?input.requestId:randomUUID();
   const statusCode=Number.isInteger(input.statusCode)&&input.statusCode>=100&&input.statusCode<=599?input.statusCode:500;
   const errorCode=input.errorCode?publicFailure({error:input.errorCode},'request_failed').error:'none';
   const entry={eventId:randomUUID(),requestId,correlationId:requestId,timestamp:new Date(time).toISOString(),severity:['DEBUG','INFO','WARN','ERROR','CRITICAL'].includes(input.severity)?input.severity:statusCode>=500||statusCode<400&&errorCode!=='none'?'ERROR':statusCode>=400?'WARN':'INFO',service:'malguard-ai',environment:['production','preview','development'].includes(env.VERCEL_ENV)?env.VERCEL_ENV:env.NODE_ENV==='production'?'production':'development',applicationVersion:/^[a-f0-9]{40}$/i.test(env.VERCEL_GIT_COMMIT_SHA||'')?env.VERCEL_GIT_COMMIT_SHA:'development',endpoint:['/chat','/status'].includes(input.endpoint)?input.endpoint:'unmatched',statusCode,errorCode,provider:providers.has(input.provider)?input.provider:'unknown',model:MODELS.includes(input.model)?input.model:'unknown',durationMs:Number.isFinite(input.durationMs)?Math.max(0,Math.min(Math.round(input.durationMs),3600000)):0,retryCount:0,repairStatus:'manual_review'};
   if(/^dpl_[a-z0-9]{1,80}$/i.test(env.VERCEL_DEPLOYMENT_ID||''))entry.deploymentId=env.VERCEL_DEPLOYMENT_ID;
   prune();rows.push({at:time,entry});while(rows.length>capacity)rows.shift();
   if(time-windowStart>=60000){windowStart=time;emitted=0;}
   if(emitted>=maxPerMinute||pending>=5){dropped++;return false;}emitted++;
   try{const result=sink({...entry});if(result&&typeof result.then==='function'){pending++;Promise.resolve(result).catch(()=>{sinkFailures++;}).finally(()=>{pending--;});}return true;}catch{sinkFailures++;return false;}
  },
  snapshot(requestId){prune();if(requestId!==undefined&&!uuid.test(requestId))return [];return rows.filter(row=>requestId===undefined||row.entry.requestId===requestId).map(row=>({...row.entry}));},
  health(){prune();return {retained:rows.length,dropped,sinkFailures,pending,capacity,retentionMs,maxPerMinute};}
 };
}
