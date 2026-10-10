/* Shared navigation. Search is local and never submits a query to a server. */
(() => {
  'use strict';
  const navbar = document.getElementById('navbar');
  const menuButton = document.getElementById('menuBtn');
  const menu = document.getElementById('navLinks');
  const searchButton = document.getElementById('searchButton');
  if (!navbar || !menuButton || !menu || !searchButton) return;
  const pages = [
    ['Home', 'MalGuard overview', '/', 'home malguard'],
    ['Products', 'Products and current availability', '/products.html', 'gta guard malware ai scam guard'],
    ['Game Scam Guard', 'In development — no public release', '/game-scam-guard.html', 'game gaming scam'],
    ['Malware AI', 'Platform-specific web preview', '/malware-ai.html', 'ai preview platforms'],
    ['Windows AI Preview', 'Malware AI web workspace', '/malware-ai-windows.html', 'ai windows chat'],
    ['iPhone Preview', 'Bounded local mobile inspection', '/ios-preview/', 'iphone ios'],
    ['GTA Guard', 'Clean-room Windows x64 static scanner', '/gta-guard.html', 'mods windows files'],
    ['Scan Mods', 'Supported and planned game-mod tools', '/scan-mods.html', 'gta minecraft roblox'],
    ['AI Intelligence', 'Malware AI preview and access options', '/ai-intelligence.html', 'chat intelligence malware'],
    ['Scan URL', 'Local URL-text inspection', '/scan-url.html', 'url link address'],
    ['Local Tools', 'SHA-256 fingerprinting and link inspection', '/tools.html', 'hash sha256 file fingerprint'],
    ['Trust Center', 'Security, limits and release integrity', '/trust.html', 'security vulnerability policy'],
    ['Privacy', 'Data handling and network use', '/privacy.html', 'privacy local upload'],
    ['Documentation', 'Product guides and security concepts', '/docs.html', 'docs help guide'],
    ['Labs', 'Defensive gaming-security research', '/labs.html', 'research'],
    ['About', 'The mission behind MalGuard', '/about.html', 'about project'],
    ['Founder', 'Mohammadreza Azardarkhash', '/founder.html', 'founder creator'],
    ['Support', 'Bug reports, false positives and feedback', '/support.html', 'support bug help'],
    ['Downloads', 'Platform availability and verification', '/download.html', 'download install'],
    ['MalGuard App', 'Windows scanner, installation and build checks', '/app.html', 'app mac android ios linux'],
    ['Sandbox Help', 'Isolation requirements and troubleshooting', '/sandbox-help.html', 'sandbox windows errors'],
    ['Case Study', 'How a legitimate mod can be repackaged', '/research/repackaged-mod.html', 'research repackaged']
  ];
  const sections = [...menu.querySelectorAll('a[href^="#"]')].map(a => [a.textContent.trim(), a.getAttribute('href')]);
  const link = (name, href) => {
    const a = document.createElement('a'); a.textContent = name; a.href = href;
    if (href === location.pathname) a.setAttribute('aria-current', 'page');
    return a;
  };
  const primary = document.createElement('nav');
  primary.className = 'mg-primary-links'; primary.setAttribute('aria-label', 'Primary');
  [['Products','/products.html'],['Tools','/tools.html'],['Trust','/trust.html']].forEach(p => primary.append(link(...p)));
  navbar.querySelector('.nav-actions').before(primary);
  menu.replaceChildren(); menu.setAttribute('aria-label', 'All MalGuard pages');
  const label = text => { const e = document.createElement('span'); e.className = 'mg-menu-label'; e.textContent = text; menu.append(e); };
  label('EXPLORE MALGUARD'); pages.forEach(p => menu.append(link(p[0], p[2])));
  if(document.body.classList.contains('mg-fusion')){const admin=document.createElement('button');admin.id='openAdminAccess';admin.type='button';admin.textContent='Administrator access';menu.append(admin);}else{menu.append(link('Administrator access','/#admin-access'));}
  if (sections.length) { label('ON THIS PAGE'); sections.forEach(p => menu.append(link(...p))); }
  function setMenu(open, focus = false) {
    menu.classList.toggle('active', open); menu.hidden = !open;
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    if (open) menu.querySelector('a')?.focus(); else if (focus) menuButton.focus();
  }
  setMenu(false);
  navbar.dataset.navigationReady = "true";
  menuButton.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target) && !menuButton.contains(e.target)) setMenu(false); });
  document.addEventListener('focusin', e => { if (!menu.hidden && !navbar.contains(e.target)) setMenu(false); });
  const search = document.createElement('section');
  search.className = 'site-search'; search.id = 'siteSearch'; search.hidden = true;
  search.setAttribute('role', 'dialog'); search.setAttribute('aria-modal', 'true'); search.setAttribute('aria-label', 'Search MalGuard');
  search.innerHTML = `<button class="search-backdrop" type="button" aria-label="Close search"></button><div class="search-dialog"><div class="search-dialog-heading"><div><span>LOCAL SITE SEARCH</span><h2>Find your way.</h2></div><button class="search-close" type="button" aria-label="Close search">×</button></div><form class="site-search-form"><label class="sr-only" for="siteSearchInput">Search MalGuard</label><input id="siteSearchInput" type="search" autocomplete="off" maxlength="200" placeholder="Products, tools, help…"><button type="submit">Search</button></form><div class="site-search-results" id="siteSearchResults" aria-live="polite"></div><p class="search-hint">Search stays on your device. Press Escape to close.</p></div>`;
  document.body.append(search);
  const input = search.querySelector('input'); const results = search.querySelector('.site-search-results');
  let previousOverflow = '';
  const backgroundState = new Map();
  function render() {
    const q = input.value.trim().toLocaleLowerCase();
    const found = pages.filter(p => p.join(' ').toLocaleLowerCase().includes(q));
    results.replaceChildren();
    if (!found.length) { const p = document.createElement('p'); p.textContent = 'No matching page. Try “GTA”, “tools” or “support”.'; results.append(p); return; }
    found.forEach(([name, description, target]) => {
      const button = document.createElement('button'); button.type = 'button';
      const copy = document.createElement('span'); const strong = document.createElement('strong'); const small = document.createElement('small'); const arrow = document.createElement('b');
      strong.textContent = name; small.textContent = description; arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true');
      copy.append(strong, small); button.append(copy, arrow);
      button.addEventListener('click', () => { location.href = target; }); results.append(button);
    });
  }
  function closeSearch() {
    if (search.hidden) return;
    search.hidden = true; searchButton.setAttribute('aria-expanded', 'false'); document.body.style.overflow = previousOverflow;
    backgroundState.forEach((value, el) => { el.inert = value; }); backgroundState.clear(); searchButton.focus();
  }
  function openSearch() {
    setMenu(false); search.hidden = false; searchButton.setAttribute('aria-expanded', 'true');
    previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    [...document.body.children].filter(el => el !== search && !['SCRIPT','STYLE'].includes(el.tagName)).forEach(el => { backgroundState.set(el, el.inert); el.inert = true; });
    render(); input.focus();
  }
  searchButton.addEventListener('click', openSearch);
  search.querySelectorAll('.search-close,.search-backdrop').forEach(b => b.addEventListener('click', closeSearch));
  input.addEventListener('input', render);
  search.querySelector('form').addEventListener('submit', e => { e.preventDefault(); results.querySelector('button')?.click(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (!search.hidden) { e.preventDefault(); closeSearch(); } else if (!menu.hidden) setMenu(false, true); }
    if (search.hidden || e.key !== 'Tab') return;
    const stops = [...search.querySelectorAll('button:not(.search-backdrop),input')].filter(el => !el.disabled && el.getClientRects().length);
    if (e.shiftKey && document.activeElement === stops[0]) { e.preventDefault(); stops.at(-1)?.focus(); }
    else if (!e.shiftKey && document.activeElement === stops.at(-1)) { e.preventDefault(); stops[0]?.focus(); }
  });
})();
