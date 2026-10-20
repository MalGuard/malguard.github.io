import {fetchPublic} from './network.js';

// Explicit opt-in: operators must review the provider's applicable usage terms.
// URL checks are local set membership; the inspected URL is never sent to this
// feed provider. Only this fixed public feed is retrieved; feed URLs are data.
export const phishingFeedEnabled=()=>process.env.GUARD_OPENPHISH_ENABLED==='true';
const FEED='https://raw.githubusercontent.com/openphish/public_feed/main/feed.txt';
export function createPhishingFeed({enabled=phishingFeedEnabled,transport=fetchPublic,now=Date.now,ttl=60*60*1000}={}){
 let cache,loading;
 const refresh=async()=>{
  const response=await transport(FEED,{limit:2*1024*1024,totalTimeout:8000,timeout:5000,noRedirect:true});
  if(response.status!==200||!Buffer.isBuffer(response.bytes)||response.bytes.length>2*1024*1024)throw new Error('feed_http');
  const lines=response.bytes.toString('utf8').split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
  if(!lines.length||lines.length>50000)throw new Error('feed_size');
  const urls=new Set();let invalid=0;
  for(const line of lines){try{const url=new URL(line);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||line.length>2048)throw new Error('invalid');url.hash='';urls.add(url.href);}catch{invalid++;}}
  if(!urls.size||invalid)throw new Error('feed_format');
  cache={urls,fetchedAt:now(),expires:now()+ttl};return cache;
 };
 return async value=>{
  if(!enabled())return {provider:'openphish',status:'unconfigured',message:'OpenPhish feed is not enabled.'};
  let url;try{url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('invalid');url.hash='';}catch{return {provider:'openphish',status:'unavailable',message:'The address could not be checked.'};}
  try{
   if(!cache||cache.expires<=now()){
    if(!loading)loading=refresh().finally(()=>{loading=undefined;});await loading;
   }
   const listed=cache.urls.has(url.href);
   return {provider:'openphish',status:listed?'listed':'not_found',message:listed?'The exact URL appears in the OpenPhish feed.':'The exact URL was absent from the fetched OpenPhish snapshot; absence is not a safety verdict.',checkedAt:new Date(now()).toISOString(),feedFetchedAt:new Date(cache.fetchedAt).toISOString(),snapshotExpiresAt:new Date(cache.expires).toISOString()};
  }catch{return {provider:'openphish',status:'unavailable',message:'A fresh, valid OpenPhish snapshot was unavailable.'};}
 };
}
export const lookupPhishingUrl=createPhishingFeed();
