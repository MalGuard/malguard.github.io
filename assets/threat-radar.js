(() => {
  'use strict';
  const endpoint='https://api.github.com/advisories?type=reviewed&per_page=20&sort=published&direction=desc';
  const list=document.getElementById('radarList'),status=document.getElementById('radarStatus');
  const count=document.getElementById('radarCount'),critical=document.getElementById('radarCritical');
  const fetched=document.getElementById('radarFetched'),refresh=document.getElementById('radarRefresh');
  const severity=document.getElementById('radarSeverity'),search=document.getElementById('radarSearch');
  if(!list||!status||!refresh)return;
  let advisories=[],lastSuccess=0,busy=false,lastAttempt=0;
  function render(){
    const term=search.value.toLocaleLowerCase().trim(),level=severity.value;
    const shown=advisories.filter(a=>(level==='all'||a.severity===level)&&(!term||(a.title+' '+a.id).toLowerCase().includes(term)));
    list.replaceChildren();
    for(const a of shown){
      const card=document.createElement('article');card.className='radar-item';
      const badge=document.createElement('span');badge.className='radar-badge '+a.severity;badge.textContent=a.severity;
      const h=document.createElement('h3');h.textContent=a.title;
      const desc=document.createElement('p');desc.textContent=a.id+(a.cve?' · '+a.cve:'');
      const meta=document.createElement('div');meta.className='radar-meta';
      const date=document.createElement('span');date.textContent='Published '+a.date;
      const link=document.createElement('a');link.href='https://github.com/advisories/'+encodeURIComponent(a.id);link.target='_blank';link.rel='noopener noreferrer';link.textContent='Read source ↗';link.setAttribute('aria-label','Read advisory '+a.id+' on GitHub');
      meta.append(date,link);card.append(badge,h,desc,meta);list.append(card);
    }
    if(!shown.length&&advisories.length){const p=document.createElement('p');p.textContent='No loaded advisories match these filters.';list.append(p);}
  }
  async function load(){
    if(busy)return;
    const now=Date.now();
    if(lastAttempt&&now-lastAttempt<30000){status.textContent='Recently checked. Refresh again in 30 seconds.';return;}
    lastAttempt=now;busy=true;refresh.disabled=true;status.textContent='Requesting GitHub-reviewed advisories…';
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch(endpoint,{method:'GET',mode:'cors',headers:{'Accept':'application/vnd.github+json'},cache:'no-store',signal:controller.signal,referrerPolicy:'no-referrer'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const payload=await response.json();
      if(!Array.isArray(payload))throw new Error('Unexpected response');
      const safe=payload.slice(0,20).filter(a=>a&&typeof a==='object'&&a.type==='reviewed'&&!a.withdrawn_at&&/^GHSA-[A-Za-z0-9-]{8,48}$/.test(a.ghsa_id||''))
       .map(a=>({id:a.ghsa_id,title:String(a.summary||'Untitled security advisory').slice(0,190),
          severity:['critical','high','medium','low'].includes(String(a.severity).toLowerCase())?String(a.severity).toLowerCase():'unknown',
          cve:/^CVE-\d{4}-\d{4,}$/.test(a.cve_id||'')?a.cve_id:'',
          date:Number.isFinite(Date.parse(a.published_at))?new Date(a.published_at).toISOString().slice(0,10):'date unavailable'}));
      if(!safe.length)throw new Error('No verified records in response');
      advisories=safe;lastSuccess=Date.now();
      count.textContent=String(safe.length);critical.textContent=String(safe.filter(a=>a.severity==='critical').length);
      status.textContent=safe.length+' GitHub-reviewed advisories loaded.';
      fetched.textContent='Retrieved '+new Date(lastSuccess).toLocaleString()+'. Records reflect the source at retrieval time.';
      render();
    }catch(error){
      status.textContent=advisories.length?'Unable to refresh. Displaying the previously retrieved set, which may be outdated.':'Public advisory data is unavailable. No threat claims or sample records are being displayed.';
      fetched.textContent=advisories.length?'Last successful retrieval: '+new Date(lastSuccess).toLocaleString(): 'Check the original GitHub advisory database or try again later.';
      if(!advisories.length){count.textContent='—';critical.textContent='—';list.replaceChildren();}
    }finally{clearTimeout(timer);busy=false;refresh.disabled=false;}
  }
  severity.addEventListener('change',render);
  search.addEventListener('input',render);
  refresh.addEventListener('click',load);
  load();
})();