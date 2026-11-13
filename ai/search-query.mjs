export function buildSearchQuery(message,history=[],{clientQuery,limit=500}={}){
  const strip=value=>String(value||'')
    .replace(/```[\s\S]*?```/g,' ')
    .replace(/Build source below:[\s\S]*/ig,' ')
    .replace(/[{}<>\\]/g,' ')
    .replace(/[\u0000-\u001f\u007f]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
  const raw=String(message||'');
  const client=strip(clientQuery);
  const embedded=raw.length>800||/```|Build source below:/i.test(raw);
  const question=embedded&&client?client:strip(raw);
  const prior=(Array.isArray(history)?history:[])
    .filter(item=>item&&item.role==='user')
    .slice(-2)
    .map(item=>strip(item.content).slice(0,180))
    .filter(Boolean);
  const parts=[];
  if(prior.length&&question.length<280)parts.push(...prior);
  if(question)parts.push(question);
  const combined=parts.join(' — ').replace(/\s+/g,' ').trim();
  if(!combined)throw Object.assign(new Error('invalid_search_query'),{code:'invalid_search_query'});
  return combined.slice(0,Number.isSafeInteger(limit)&&limit>0?limit:500);
}
