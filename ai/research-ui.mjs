// Attribution UI for MalGuard AI. No network access; only safe server-returned metadata.
export function validResearchSources(webSearch){
 if(!webSearch||webSearch.state!=='completed'||!Array.isArray(webSearch.sources))return [];
 const used=new Set(),sources=[];
 for(const source of webSearch.sources.slice(0,8)){
  try{
   const url=new URL(source.url);
   if(url.protocol!=='https:'||url.username||url.password||!url.hostname.includes('.'))continue;
   const n=Number(source.citation);
   if(!Number.isSafeInteger(n)||n<1||n>8||used.has(n))continue;
   const title=typeof source.title==='string'?source.title.trim().slice(0,190):url.hostname;
   const excerpt=typeof source.excerpt==='string'?source.excerpt.trim().slice(0,210):'';
   used.add(n);sources.push({citation:n,title:title||url.hostname,excerpt,url:url.href,host:url.hostname,publishedAt:source.publishedAt});
  }catch{}
 }
 return sources.sort((a,b)=>a.citation-b.citation);
}
export function renderResearchEvidence(webSearch,locale='en'){
 const sources=validResearchSources(webSearch);
 if(!sources.length)return null;
 const fa=locale==='fa',section=document.createElement('section');
 section.className='research-evidence';
 section.setAttribute('aria-label',fa?'منابع جست‌وجو':'Web research sources');
 const header=document.createElement('div');header.className='research-heading';
 const meta=document.createElement('div');meta.className='research-meta';
 const glyph=document.createElement('span');glyph.textContent='⌕';glyph.className='research-glyph';glyph.setAttribute('aria-hidden','true');
 const name=document.createElement('strong');name.textContent=webSearch.mode==='research'?(fa?'تحقیق در وب':'Web research'):(fa?'جست‌وجوی وب':'Web search');
 const count=document.createElement('span');count.textContent=fa?String(sources.length)+' منبع':String(sources.length)+' sources';
 meta.append(glyph,name,count);header.append(meta);
 if(typeof webSearch.checkedAt==='string'){
  const date=new Date(webSearch.checkedAt);
  if(Number.isFinite(date.getTime())){
   const when=document.createElement('time');when.dateTime=date.toISOString();
   when.textContent=date.toLocaleString(fa?'fa-IR':'en-US',{dateStyle:'medium',timeStyle:'short'});
   header.append(when);
  }
 }
 const grid=document.createElement('div');grid.className='research-sources';
 for(const source of sources){
  const a=document.createElement('a');a.className='research-source';a.href=source.url;
  a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label','['+source.citation+'] '+source.title);
  const top=document.createElement('div');top.className='research-source-top';
  const index=document.createElement('span');index.className='research-source-index';index.textContent=String(source.citation);
  const hostname=document.createElement('span');hostname.className='research-source-host';hostname.textContent=source.host;
  top.append(index,hostname);
  const title=document.createElement('strong');title.textContent=source.title;
  a.append(top,title);
  if(source.excerpt){const excerpt=document.createElement('p');excerpt.textContent=source.excerpt;a.append(excerpt);}
  grid.append(a);
 }
 const foot=document.createElement('p');foot.className='research-disclaimer';
 foot.textContent=fa?'منابع به‌صورت خودکار بازیابی شده‌اند؛ هر ادعا را با متن اصلی منبع بررسی کنید.':'Sources are retrieved automatically; check important claims against the original pages.';
 section.append(header,grid,foot);
 return section;
}
export function attachResearchCitations(answer,webSearch){
 const sources=validResearchSources(webSearch);if(!sources.length)return 0;
 const byNumber=new Map(sources.map(s=>[s.citation,s]));
 const walker=document.createTreeWalker(answer,NodeFilter.SHOW_TEXT);
 const nodes=[];let node;
 while((node=walker.nextNode())){
  if(node.parentElement?.closest('a,pre,code,script,style,button,.research-source'))continue;
  if(/\[\d{1,2}\]/.test(node.textContent))nodes.push(node);
 }
 let count=0;
 for(const text of nodes){
  const value=text.textContent,pattern=/\[(\d{1,2})\]/g;
  let match,last=0,changed=false;const fragment=document.createDocumentFragment();
  while((match=pattern.exec(value))){
   const source=byNumber.get(Number(match[1]));if(!source)continue;
   if(match.index>last)fragment.append(document.createTextNode(value.slice(last,match.index)));
   const a=document.createElement('a');a.className='research-citation';a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';
   a.textContent=match[0];a.title=source.title;
   a.setAttribute('aria-label','Source '+source.citation+': '+source.title);
   fragment.append(a);last=pattern.lastIndex;changed=true;count++;
  }
  if(changed){if(last<value.length)fragment.append(document.createTextNode(value.slice(last)));text.replaceWith(fragment);}
 }
 return count;
}
