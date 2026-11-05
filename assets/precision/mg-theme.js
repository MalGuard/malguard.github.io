(()=>{
  const KEY='mg-theme';
  const root=document.documentElement;
  const sun='<svg class="mg-theme-icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M18.9 5.1l-1.6 1.6M6.7 17.3l-1.6 1.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  const moon='<svg class="mg-theme-icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13.2A7.8 7.8 0 0 1 10.8 4 8.2 8.2 0 1 0 20 13.2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';

  function hourTheme(){
    const h=new Date().getHours();
    return (h>=7 && h<19) ? 'light' : 'dark';
  }
  function systemTheme(){
    try{
      if(window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
      if(window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    }catch(_){}
    return null;
  }
  function resolve(){
    const saved=localStorage.getItem(KEY);
    if(saved==='light'||saved==='dark') return saved;
    // no manual override: local hour, else OS preference
    return hourTheme() || systemTheme() || 'dark';
  }
  function apply(theme){
    root.dataset.theme=theme;
    root.style.colorScheme=theme;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta) meta.setAttribute('content', theme==='light' ? '#f3f4f6' : '#050507');
    const btn=document.getElementById('mgThemeToggle');
    if(btn){
      btn.setAttribute('aria-label', theme==='light' ? 'Switch to dark theme' : 'Switch to light theme');
      btn.dataset.theme=theme;
    }
  }
  function ensureCss(){
    if(document.getElementById('mg-theme-css')) return;
    const link=document.createElement('link');
    link.id='mg-theme-css';
    link.rel='stylesheet';
    link.href='/assets/precision/mg-theme.css?v=20261105';
    document.head.appendChild(link);
  }
  function ensureToggle(){
    if(document.getElementById('mgThemeToggle')) return;
    const btn=document.createElement('button');
    btn.id='mgThemeToggle';
    btn.type='button';
    btn.className='mg-theme-toggle';
    btn.innerHTML=sun+moon;
    btn.addEventListener('click',()=>{
      const next=root.dataset.theme==='light'?'dark':'light';
      localStorage.setItem(KEY,next);
      apply(next);
    });
    document.body.appendChild(btn);
  }

  apply(resolve());
  ensureCss();
  const boot=()=>{ensureToggle();apply(resolve());};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  // If still on auto (no saved), refresh when the hour crosses day/night.
  if(!localStorage.getItem(KEY)){
    setInterval(()=>{ if(!localStorage.getItem(KEY)) apply(resolve()); }, 60*1000);
  }
})();
