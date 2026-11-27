// Progressive, reversible composer enhancement. Existing controls and listeners move intact.
// No provider calls, consent changes, storage, or security-tool logic.
(() => {
  const menu = document.getElementById('attach-options');
  const thinking = document.getElementById('thinking-toggle');
  const web = document.getElementById('web-search-controls');
  const webAction = document.getElementById('attach-web');
  const attachment = document.getElementById('attach-toggle');
  if (!menu || !thinking || !web || !webAction || !attachment) return;
  if (!document.querySelector('.composer-actions')?.contains(thinking)) return;
  if (!document.querySelector('.composer-actions')?.contains(web)) return;
  const group = document.createElement('div');
  group.className = 'ai-menu-capabilities';
  group.setAttribute('role', 'group');
  const syncLang = () => {
    const fa = document.documentElement.lang === 'fa';
    group.setAttribute('aria-label', fa ? 'جست‌وجو و تفکر' : 'Search and reasoning');
    attachment.title = fa ? 'ابزارها، جست‌وجو و تفکر' : 'Tools, search and reasoning';
  };
  syncLang();
  new MutationObserver(syncLang).observe(document.documentElement, {
    attributes:true,attributeFilter:['lang']
  });
  group.append(web, thinking);
  menu.insertBefore(group, webAction);
  // The legacy one-way "Search the web" action is replaced by the true toggle above.
  // Keep the element for existing application code that references it by ID.
  webAction.hidden = true;
  document.body.classList.add('ai-composer-enhanced');
})();