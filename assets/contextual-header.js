(() => {
  const navbar=document.getElementById('navbar');
  const menuBtn=document.getElementById('menuBtn');
  const navLinks=document.getElementById('navLinks');
  const searchButton=document.getElementById('searchButton');
  if(!navbar||!menuBtn||!navLinks||!searchButton)return;

  window.addEventListener('scroll',()=>navbar.classList.toggle('scrolled',scrollY>8),{passive:true});
  const navActions=navbar.querySelector('.nav-actions');
  if(navActions&&!navActions.querySelector('.mg-history-actions')){
    navActions.insertAdjacentHTML('afterbegin',`
      <div class="mg-history-actions" aria-label="Page navigation">
        <button class="mg-history-btn mg-back-btn" type="button" aria-label="Back to previous MalGuard page">
          <span class="mg-history-icon" aria-hidden="true">←</span>
          <span class="mg-history-label">Back</span>
        </button>
        <a class="mg-history-btn mg-home-btn" href="/" aria-label="Go to MalGuard home">
          <svg class="mg-home-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 10.5 12 4l7.5 6.5v8a1.5 1.5 0 0 1-1.5 1.5h-4.25v-5.25h-3.5V20H6a1.5 1.5 0 0 1-1.5-1.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
          <span class="mg-history-label">Home</span>
        </a>
      </div>`);
    const backButton=navActions.querySelector('.mg-back-btn');
    backButton?.addEventListener('click',()=>{
      try{
        const ref=document.referrer?new URL(document.referrer):null;
        if(ref&&ref.origin===location.origin){history.back();return}
      }catch(_){}
      location.href='/';
    });
  }


  const menuItems=[...navLinks.querySelectorAll('a')];
  let activeMenuIndex=0;
  let menuScrollEndTimer=0;
  let menuSelectionFrame=0;
  let menuCloseTimer=0;

  const clamp=i=>Math.max(0,Math.min(menuItems.length-1,i));

  function setMenuButtonState(opened){
    menuBtn.setAttribute('aria-expanded',String(opened));
    menuBtn.setAttribute('aria-label',opened?'Close navigation menu':'Open navigation menu');
    navLinks.setAttribute('aria-hidden',String(!opened));
  }

  function setActiveMenuItem(index){
    if(!menuItems.length)return;
    const next=clamp(index);
    menuItems.forEach((item,i)=>item.classList.toggle('menu-current',i===next));
    activeMenuIndex=next;
  }

  function menuTargetLeft(index){
    const item=menuItems[index];
    if(!item)return 0;
    const raw=item.offsetLeft-(navLinks.clientWidth-item.offsetWidth)/2;
    return Math.max(0,Math.min(raw,Math.max(0,navLinks.scrollWidth-navLinks.clientWidth)));
  }

  function nearestMenuIndex(){
    if(!menuItems.length)return 0;
    const center=navLinks.scrollLeft+(navLinks.clientWidth/2);
    let nearest=0,best=Infinity;
    menuItems.forEach((item,index)=>{
      const itemCenter=item.offsetLeft+(item.offsetWidth/2);
      const distance=Math.abs(itemCenter-center);
      if(distance<best){best=distance;nearest=index}
    });
    return nearest;
  }

  function updateLiveMenuSelection(){
    menuSelectionFrame=0;
    if(navLinks.classList.contains('active'))setActiveMenuItem(nearestMenuIndex());
  }

  function finalizeMenuScroll(){
    if(!navLinks.classList.contains('active'))return;
    const next=nearestMenuIndex();
    setActiveMenuItem(next);
    const target=menuTargetLeft(next);
    if(Math.abs(navLinks.scrollLeft-target)>.5)navLinks.scrollLeft=target;
  }

  function indexForCurrentLocation(){
    const hash=location.hash||'';
    const direct=menuItems.findIndex(item=>{
      try{
        const u=new URL(item.href,location.href);
        return u.pathname===location.pathname && u.hash===hash && !!u.hash;
      }catch(_){return false}
    });
    return direct>=0?direct:activeMenuIndex;
  }

  function openMenu(){
    clearTimeout(menuCloseTimer);
    navLinks.classList.remove('closing');
    navLinks.classList.add('active');
    setMenuButtonState(true);
    const next=clamp(indexForCurrentLocation());
    setActiveMenuItem(next);
    requestAnimationFrame(()=>{navLinks.scrollLeft=menuTargetLeft(next)});
  }

  function closeMenu({restoreFocus=false}={}){
    if(!navLinks.classList.contains('active'))return;
    setMenuButtonState(false);
    if(menuSelectionFrame){cancelAnimationFrame(menuSelectionFrame);menuSelectionFrame=0}
    clearTimeout(menuScrollEndTimer);
    clearTimeout(menuCloseTimer);
    navLinks.classList.add('closing');
    menuCloseTimer=setTimeout(()=>navLinks.classList.remove('active','closing'),260);
    if(restoreFocus)menuBtn.focus();
  }

  setMenuButtonState(false);
  menuBtn.addEventListener('click',()=>navLinks.classList.contains('active')?closeMenu():openMenu());

  navLinks.addEventListener('scroll',()=>{
    if(!menuSelectionFrame)menuSelectionFrame=requestAnimationFrame(updateLiveMenuSelection);
    clearTimeout(menuScrollEndTimer);
    menuScrollEndTimer=setTimeout(finalizeMenuScroll,0);
  },{passive:true});
  if('onscrollend' in window)navLinks.addEventListener('scrollend',finalizeMenuScroll,{passive:true});

  menuItems.forEach((item,index)=>{
    item.addEventListener('click',()=>{
      setActiveMenuItem(index);
      closeMenu();
    });
  });

  document.addEventListener('click',e=>{
    if(navLinks.classList.contains('active')&&!navLinks.contains(e.target)&&!menuBtn.contains(e.target))closeMenu();
  });

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      closeMenu({restoreFocus:true});
      closeSearch();
      return;
    }
    if(!navLinks.classList.contains('active'))return;
    if(e.key==='ArrowRight'||e.key==='ArrowLeft'){
      e.preventDefault();
      const next=clamp(activeMenuIndex+(e.key==='ArrowRight'?1:-1));
      setActiveMenuItem(next);
      navLinks.scrollLeft=menuTargetLeft(next);
      menuItems[next].focus();
    }
  });

  const globalItems=[
    {name:'Home',detail:'MalGuard overview',target:'/',terms:'home malguard'},
    {name:'Products',detail:'Current MalGuard products and availability',target:'/products.html',terms:'products gta guard malware ai scam guard'},
    {name:'GTA Guard',detail:'Windows x64 GTA Guard preview',target:'/gta-guard.html',terms:'gta guard windows mod security'},
    {name:'Scan Mods',detail:'Game-mod scanning hub',target:'/scan-mods.html',terms:'scan mods gta minecraft roblox'},
    {name:'AI Intelligence',detail:'MalGuard security AI',target:'/ai-intelligence.html',terms:'ai malware intelligence'},
    {name:'Scan URL',detail:'URL analysis and SHA-256 fingerprinting',target:'/scan-url.html',terms:'scan url link fingerprint hash'},
    {name:'Tools',detail:'Local-first security utilities',target:'/tools.html',terms:'tools fingerprint link inspector'},
    {name:'Trust',detail:'Security, privacy and release integrity',target:'/trust.html',terms:'security trust privacy integrity limits'},
    {name:'Privacy',detail:'Local-first data and network policy',target:'/privacy.html',terms:'privacy local network transfer'},
    {name:'Labs',detail:'Gaming-security research',target:'/labs.html',terms:'labs research guides'},
    {name:'Docs',detail:'Product and security documentation',target:'/docs.html',terms:'docs documentation'},
    {name:'About',detail:'Project mission and structure',target:'/about.html',terms:'about project mission'},
    {name:'Founder',detail:'Official profile for Mohammadreza Azardarkhash',target:'/founder.html',terms:'founder creator mohammadreza azardarkhash'},
    {name:'Support',detail:'Security reports, bugs and feedback',target:'/support.html',terms:'support bug feedback report'},
    {name:'Download',detail:'Windows preview and verification',target:'/download.html',terms:'download windows installer verify'},
    {name:'MalGuard App',detail:'Native MalGuard app for supported platforms',target:'/app.html',terms:'malguard app android iphone ios windows mac'},
    {name:'Case Study',detail:'MalGuard Labs repackaged-mod case study',target:'/research/repackaged-mod.html',terms:'case study repackaged mod research'}
  ];

  const searchMarkup=`
    <section class="site-search mg-context-search" id="siteSearch" role="dialog" aria-modal="true" aria-label="Search MalGuard" hidden>
      <button class="search-backdrop" id="searchBackdrop" type="button" aria-label="Close search"></button>
      <div class="search-dialog">
        <div class="search-dialog-heading">
          <div><span>Site search</span><h2>Find MalGuard information.</h2></div>
          <button class="search-close" id="searchClose" type="button" aria-label="Close search">×</button>
        </div>
        <form id="siteSearchForm" class="site-search-form">
          <label class="sr-only" for="siteSearchInput">Search MalGuard</label>
          <span aria-hidden="true">⌕</span>
          <input id="siteSearchInput" type="search" autocomplete="off" placeholder="Search MalGuard…">
          <button type="submit">Search</button>
        </form>
        <div class="site-search-results" id="siteSearchResults" aria-live="polite"></div>
        <p class="search-hint">Press Escape to close.</p>
      </div>
    </section>`;
  document.body.insertAdjacentHTML('beforeend',searchMarkup);

  const searchPanel=document.getElementById('siteSearch');
  const searchClose=document.getElementById('searchClose');
  const searchBackdrop=document.getElementById('searchBackdrop');
  const searchInput=document.getElementById('siteSearchInput');
  const searchForm=document.getElementById('siteSearchForm');
  const searchResults=document.getElementById('siteSearchResults');

  function closeSearch(){
    if(!searchPanel)return;
    searchPanel.hidden=true;
    searchButton.setAttribute('aria-expanded','false');
  }
  function openSearch(){
    closeMenu();
    searchPanel.hidden=false;
    searchButton.setAttribute('aria-expanded','true');
    renderResults(searchInput.value);
    requestAnimationFrame(()=>searchInput.focus());
  }
  function renderResults(query){
    const q=(query||'').trim().toLowerCase();
    const shown=globalItems.filter(item=>!q||(item.name+' '+item.detail+' '+item.terms).toLowerCase().includes(q));
    searchResults.innerHTML=shown.length?shown.map(item=>`<button type="button" data-target="${item.target}"><span><strong>${item.name}</strong><small>${item.detail}</small></span><b aria-hidden="true">›</b></button>`).join(''):'<p>No matching MalGuard section was found.</p>';
    searchResults.querySelectorAll('button[data-target]').forEach(button=>button.addEventListener('click',()=>{location.href=button.dataset.target}));
  }

  searchButton.addEventListener('click',openSearch);
  searchClose.addEventListener('click',closeSearch);
  searchBackdrop.addEventListener('click',closeSearch);
  searchInput.addEventListener('input',()=>renderResults(searchInput.value));
  searchForm.addEventListener('submit',e=>{
    e.preventDefault();
    const first=searchResults.querySelector('button[data-target]');
    if(first)location.href=first.dataset.target;
  });
  renderResults('');

  function syncHashSelection(){
    if(!location.hash)return;
    const i=menuItems.findIndex(item=>{
      try{return new URL(item.href,location.href).hash===location.hash}catch(_){return false}
    });
    if(i>=0)setActiveMenuItem(i);
  }
  window.addEventListener('hashchange',syncHashSelection);
  syncHashSelection();
})();