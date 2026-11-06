(()=>{
  const KEY='malguard-theme';
  const root=document.documentElement;
  const MODES=['auto','light','dark'];
  const icons={
    auto:'<svg class="mg-theme-icon-auto" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 3v18" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" opacity=".35"/></svg>',
    light:'<svg class="mg-theme-icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M18.9 5.1l-1.6 1.6M6.7 17.3l-1.6 1.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    dark:'<svg class="mg-theme-icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13.2A7.8 7.8 0 0 1 10.8 4 8.2 8.2 0 1 0 20 13.2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>'
  };
  const labels={auto:'Theme: auto (sunrise/sunset when location is allowed). Click for light.',light:'Theme: light. Click for dark.',dark:'Theme: dark. Click for auto.'};
  let coordinates=null;
  // Timezone is an approximate location fallback, not GPS. Never send it to a server.
  const timezone=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'';}catch(_){return '';}})();
  const timezoneCoordinates={'Asia/Tehran':{latitude:35.6892,longitude:51.3890}};
  function fallbackCoordinates(){return timezoneCoordinates[timezone]||null;}

  const rad=Math.PI/180;
  // NOAA solar position approximation, evaluated at the current instant (UTC).
  // Returns true for daytime; handles polar day/night without fixed sunrise hours.
  function sunIsUp(now,lat,lon){
    const jd=now.getTime()/86400000+2440587.5;
    const t=(jd-2451545)/36525;
    const L=(280.46646+t*(36000.76983+t*0.0003032))%360;
    const M=(357.52911+t*(35999.05029-0.0001537*t))*rad;
    const e=0.016708634-t*(0.000042037+0.0000001267*t);
    const C=Math.sin(M)*(1.914602-t*(0.004817+0.000014*t))+Math.sin(2*M)*(0.019993-0.000101*t)+Math.sin(3*M)*0.000289;
    const trueLong=L+C;
    const omega=(125.04-1934.136*t)*rad;
    const lambda=(trueLong-0.00569-0.00478*Math.sin(omega))*rad;
    const epsilon=(23+(26+(21.448-t*(46.815+t*(0.00059-t*0.001813)))/60)/60+0.00256*Math.cos(omega))*rad;
    const decl=Math.asin(Math.sin(epsilon)*Math.sin(lambda));
    const y=Math.tan(epsilon/2)**2;
    const eq=4/rad*(y*Math.sin(2*L*rad)-2*e*Math.sin(M)+4*e*y*Math.sin(M)*Math.cos(2*L*rad)-0.5*y*y*Math.sin(4*L*rad)-1.25*e*e*Math.sin(2*M));
    const utcMinutes=now.getUTCHours()*60+now.getUTCMinutes()+now.getUTCSeconds()/60;
    const solarMinutes=((utcMinutes+eq+4*lon)%1440+1440)%1440;
    const hourAngle=(solarMinutes/4-180)*rad;
    const latitude=lat*rad;
    const sinAltitude=Math.sin(latitude)*Math.sin(decl)+Math.cos(latitude)*Math.cos(decl)*Math.cos(hourAngle);
    return sinAltitude>Math.sin(-0.833*rad);
  }
  function requestLocation(){
    if(!navigator.geolocation)return;
    navigator.geolocation.getCurrentPosition(pos=>{
      const {latitude,longitude}=pos.coords;
      if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return;
      coordinates={latitude,longitude};
      apply(readMode());
    },()=>{coordinates=null;apply(readMode());},{enableHighAccuracy:false,timeout:7000,maximumAge:3600000});
  }
  // Avoid unexpected permission prompts: request only after Auto is selected
  // or when the browser has already granted permission.
  function restoreGrantedLocation(){
    if(!navigator.permissions?.query)return;
    navigator.permissions.query({name:'geolocation'}).then(p=>{
      if(p.state==='granted')requestLocation();
      p.addEventListener?.('change',()=>{if(p.state==='granted')requestLocation();else{coordinates=null;apply(readMode());}});
    }).catch(()=>{});
  }

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
    if(mode==='auto'||mode===null){
      const location=coordinates||fallbackCoordinates();
      if(location)return sunIsUp(new Date(),location.latitude,location.longitude)?'light':'dark';
      return hourTheme();
    }
    return systemTheme();
  }
  function apply(mode){
    const effective=resolveEffective(mode);
    root.classList.remove('theme-light','theme-dark');
    root.classList.add(effective==='light'?'theme-light':'theme-dark');
    root.dataset.theme=effective;
    root.dataset.themeMode=mode||'auto';
    root.dataset.themeSource=coordinates?'geolocation':fallbackCoordinates()?'timezone-solar':'local-hour';
    root.style.colorScheme=effective;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta) meta.setAttribute('content', effective==='light' ? '#8EC8EC' : '#050507');
    const btn=document.getElementById('mgThemeToggle');
    if(btn){
      const show=mode||'auto';
      const iconMode=show;
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
    if(next==='auto')requestLocation();
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
  restoreGrantedLocation();
  // Auto attempts location once per tab; denied/unavailable stays functional via timezone.
  if((initial===null||initial==='auto')&&navigator.geolocation){
    try{if(!sessionStorage.getItem('mg-theme-geo-attempt')){
      sessionStorage.setItem('mg-theme-geo-attempt','1');requestLocation();
    }}catch(_){}
  }
  ensureCss();
  const boot=()=>{ensureToggle();apply(readMode());};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  setInterval(()=>{
    const mode=readMode();
    if(mode===null||mode==='auto') apply(mode);
  }, 60*1000);
})();
