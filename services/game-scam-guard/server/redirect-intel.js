import {normalizeUrl,ScanError} from './network.js';

// Only call this after fetchPublic has validated every connection in a completed
// HTTP chain. Never crawl HTML links or unvisited redirect destinations here.
export async function inspectRedirectReputation(requested,response,initial,{lookup,onEvent=()=>{}}={}) {
  const key=value=>{const url=normalizeUrl(value);url.hash='';return url.href;};
  const first=key(requested),last=key(response.url);
  const redirects=response.redirects||[];
  if(redirects.length>4)throw new ScanError('Redirect reputation inspection limit exceeded.');
  const urls=new Set([first]);
  for(const redirect of redirects){urls.add(key(redirect.from));urls.add(key(redirect.to));}
  urls.add(last);
  if(urls.size>5)throw new ScanError('Redirect reputation inspection limit exceeded.');
  if(urls.size>1)onEvent({phase:'redirect_lookup',message:'Checking threat reports for every observed HTTP redirect address',total:urls.size});
  const urlReputations=await Promise.all([...urls].map(async url=>({url,reputation:url===first?initial:await Promise.resolve().then(()=>lookup(url)).catch(()=>({status:'unavailable',message:'Threat lookup for this redirect address did not complete.'}))})));
  return {urlReputations,finalReputation:urlReputations.find(item=>item.url===last).reputation};
}

export const reportReputations=report=>report.urlReputations?.length
  ?report.urlReputations.map(item=>item.reputation)
  :[report.reputation,report.finalReputation].filter(Boolean);
