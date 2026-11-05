(()=>{
  const KEY='malguard-theme';
  const root=document.documentElement;
  const MODES=['auto','light','dark'];
  const icons={
    auto:'<svg class="mg-theme-icon-auto" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 3v18" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" opacity=".35"/></svg>',
    light:'<svg class="mg-theme-icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M18.9 5.1l-1.6 1.6M6.7 17.3l-1.6 1.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    dark:'<svg class="mg-theme-icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13.2A7.8 7.8 0 0 1 10.8 4 8.2 8.2 0 1 0 20 13.2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>'
  };
  const labels={auto:'Theme: auto (by local hour). Click for light.',light:'Theme: light. Click for dark.',dark:'Theme: dark. Click for auto.'};

  function hourTheme(){
    const h=new Date().getHours();
    return (h>=6 && h<18) ? 'light' : 'dark';
  }
  function systemTheme(){
    try{
      if(window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
      if(window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    }catch(_){}
    return 'dark';
  }
  function readMode(){
    const saved=localStorage.getItem(KEY);
    if(saved==='light'||saved==='dark'||saved==='auto') return saved;
    return null;
  }
  function resolveEffective(mode){
    if(mode==='light'||mode==='dark') return mode;
    if(mode==='auto') return hourTheme();
    return systemTheme();
  }
  function apply(mode){
    const effective=resolveEffective(mode);
    root.classList.remove('theme-light','theme-dark');
    root.classList.add(effective==='light'?'theme-light':'theme-dark');
    root.dataset.theme=effective;
    root.dataset.themeMode=mode||'system';
    root.style.colorScheme=effective;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta) meta.setAttribute('content', effective==='light' ? '#8EC8EC' : '#050507');
    const btn=document.getElementById('mgThemeToggle');
    if(btn){
      const show=mode||'system';
      const iconMode=(show==='system')?'auto':show;
      btn.innerHTML=icons[iconMode]||icons.auto;
      btn.setAttribute('aria-label', labels[iconMode]||labels.auto);
      btn.dataset.mode=iconMode;
      btn.dataset.theme=effective;
    }
  }
  function ensureCss(){
    if(document.getElementById('mg-theme-css')) return;
    const link=document.createElement('link');
    link.id='mg-theme-css';
    link.rel='stylesheet';
    link.href='/assets/precision/mg-theme.css?v=20261105-light-contrast';
    document.head.appendChild(link);
  }
  function cycle(){
    const cur=readMode();
    let idx;
    if(cur===null) idx=0;
    else idx=(MODES.indexOf(cur)+1)%MODES.length;
    const next=MODES[idx];
    localStorage.setItem(KEY,next);
    apply(next);
  }
  function ensureToggle(){
    if(document.getElementById('mgThemeToggle')) return;
    const btn=document.createElement('button');
    btn.id='mgThemeToggle';
    btn.type='button';
    btn.className='mg-theme-toggle';
    btn.addEventListener('click',cycle);
    document.body.appendChild(btn);
  }

  const initial=readMode();
  apply(initial);
  ensureCss();
  const boot=()=>{ensureToggle();apply(readMode());};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  setInterval(()=>{
    const mode=readMode();
    if(mode===null||mode==='auto') apply(mode);
  }, 60*1000);
})();
