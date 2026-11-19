import {domainToASCII} from 'node:url';
import {fetchPublic} from './network.js';

// PhishDestroy's CC0 Primary Live snapshot. Scanned addresses stay on our server.
export const phishingFeedEnabled=()=>process.env.GUARD_PHISHDESTROY_ENABLED!=='false';
const FEED='https://raw.githubusercontent.com/phishdestroy/destroylist/main/rootlist/formats/primary_active/domains.txt';
const MAX_BYTES=6*1024*1024;
const PROVIDER='phishdestroy';
const normalizeDomain=value=>domainToASCII(value.replace(/\.$/,'')).toLowerCase();

export function createPhishingFeed({enabled=phishingFeedEnabled,transport=fetchPublic,now=Date.now,ttl=6*60*60*1000}={}){
 let cache,loading;
 const refresh=async()=>{
  const response=await transport(FEED,{limit:MAX_BYTES,totalTimeout:8000,timeout:5000,noRedirect:true});
  if(response.status!==200||!Buffer.isBuffer(response.bytes)||response.bytes.length>MAX_BYTES)throw new Error('feed_http');
  const lines=response.bytes.toString('utf8').split(/\r?\n/).map(value=>value.trim()).filter(value=>value&&!value.startsWith('#'));
  if(!lines.length||lines.length>250000)throw new Error('feed_size');
  const domains=new Set();
  for(const line of lines){
   if(!/^[\p{L}\p{N}.-]+$/u.test(line))throw new Error('feed_format');
   const domain=normalizeDomain(line);
   if(!domain.includes('.')||domain.length>253)throw new Error('feed_format');
   domains.add(domain);
  }
  cache={domains,fetchedAt:now(),expires:now()+ttl};return cache;
 };
 return async value=>{
  if(!enabled())return {provider:PROVIDER,status:'unconfigured',message:'PhishDestroy feed is not enabled.'};
  let url;try{url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('invalid');url.hash='';}catch{return {provider:PROVIDER,status:'unavailable',message:'The address could not be checked.'};}
  try{
   if(!cache||cache.expires<=now()){
    if(!loading)loading=refresh().finally(()=>{loading=undefined;});await loading;
   }
   const listed=cache.domains.has(normalizeDomain(url.hostname));
   return {provider:PROVIDER,status:listed?'listed':'not_found',message:listed?'The exact hostname appears in the PhishDestroy DNS-active feed.':'The exact hostname was absent from the fetched PhishDestroy snapshot; absence is not a safety verdict.',checkedAt:new Date(now()).toISOString(),feedFetchedAt:new Date(cache.fetchedAt).toISOString(),snapshotExpiresAt:new Date(cache.expires).toISOString()};
  }catch{return {provider:PROVIDER,status:'unavailable',message:'A fresh, valid PhishDestroy snapshot was unavailable.'};}
 };
}
export const lookupPhishingUrl=createPhishingFeed();
