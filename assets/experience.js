(() => {
  'use strict';
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = document.getElementById('motionToggle');
  let userPaused = false;
  try { userPaused = localStorage.getItem('malguard-motion-paused') === 'true'; } catch (_) {}
  function applyMotion() {
    const paused = motion.matches || userPaused;
    document.documentElement.classList.toggle('motion-paused', paused);
    if (toggle) { toggle.textContent = motion.matches ? 'Reduced motion' : paused ? 'Resume motion' : 'Pause motion'; toggle.setAttribute('aria-pressed', String(paused)); toggle.disabled = motion.matches; }
  }
  applyMotion();
  motion.addEventListener('change', applyMotion);
  toggle?.addEventListener('click', () => { userPaused = !userPaused; try { localStorage.setItem('malguard-motion-paused', String(userPaused)); } catch (_) {} applyMotion(); });
  document.addEventListener('visibilitychange', () => document.documentElement.classList.toggle('page-hidden', document.hidden));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('revealed'); observer.unobserve(entry.target); }
    }), { threshold: .12 });
    document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
  }
  const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  document.querySelectorAll('[data-tilt]').forEach(card => {
    let frame = 0;
    card.addEventListener('pointermove', e => {
      if (!pointer.matches || motion.matches || userPaused) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--tilt-y', `${((e.clientX-r.left)/r.width-.5)*5}deg`);
        card.style.setProperty('--tilt-x', `${((e.clientY-r.top)/r.height-.5)*-4}deg`);
      });
    });
    card.addEventListener('pointerleave', () => { cancelAnimationFrame(frame); card.style.removeProperty('--tilt-x'); card.style.removeProperty('--tilt-y'); });
  });
  const dialog = document.getElementById('coreDialog');
  const open = document.getElementById('openCore');
  if (dialog && open) {
    open.addEventListener('click', () => dialog.showModal());
    dialog.querySelector('[data-close-core]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
    dialog.addEventListener('close', () => open.focus());
  }
  // Keep old shared homepage product links pointing to the supported pages.
  if (document.body.classList.contains('mg-home')) {
    const legacy = {'#gta-guard':'/gta-guard.html','#malware-ai':'/malware-ai.html','#game-scam-guard':'/products.html#game-scam-guard','#download':'/download.html','#feedback':'/support.html'};
    function routeLegacy() { if (legacy[location.hash]) location.replace(legacy[location.hash]); }
    window.addEventListener('hashchange', routeLegacy); routeLegacy();
  }
  document.documentElement.dataset.experienceReady = "true";
})();

/* Interactive studio: progressive enhancement with no backend or sample execution. */
(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const paused = () => reduced.matches || document.documentElement.classList.contains('motion-paused');
  const device = document.getElementById('studioDevice');
  const open = document.getElementById('studioOpen');
  const workspace = document.getElementById('studioWorkspace');
  const close = document.getElementById('studioClose');
  const hint = document.getElementById('studioHint');
  if (device && open && workspace && close) {
    const tabs = [...workspace.querySelectorAll('[role="tab"]')];
    function selectTab(tab, focus = false) {
      tabs.forEach(item => {
        const active = item === tab;
        item.setAttribute('aria-selected', String(active));
        item.tabIndex = active ? 0 : -1;
        const panel = document.getElementById(item.getAttribute('aria-controls'));
        if (panel) panel.hidden = !active;
      });
      if (focus) tab.focus();
    }
    open.addEventListener('click', () => {
      device.classList.add('is-open');
      workspace.hidden = false;
      open.setAttribute('aria-expanded', 'true');
      open.tabIndex = -1;
      open.setAttribute('aria-hidden', 'true');
      if (hint) hint.textContent = 'Choose a product below to explore';
      const selected = tabs.find(tab => tab.getAttribute('aria-selected') === 'true') || tabs[0];
      selected?.focus({ preventScroll: true });
      workspace.scrollIntoView({ behavior: paused() ? 'instant' : 'smooth', block: 'nearest' });
    });
    function closeWorkspace() {
      workspace.hidden = true;
      device.classList.remove('is-open');
      open.setAttribute('aria-expanded', 'false');
      open.tabIndex = 0;
      open.removeAttribute('aria-hidden');
      if (hint) hint.textContent = 'Click or press Enter to open';
      open.focus({ preventScroll: true });
      device.scrollIntoView({ behavior: paused() ? 'instant' : 'smooth', block: 'center' });
    }
    close.addEventListener('click', closeWorkspace);
    workspace.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeWorkspace(); }
    });
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => selectTab(tab));
      tab.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next !== undefined) { event.preventDefault(); selectTab(tabs[next], true); }
      });
    });
  }
  const copy = document.getElementById('studioCopyCode');
  const code = document.getElementById('studioCode');
  const status = document.getElementById('studioCopyStatus');
  if (copy && code && status) {
    copy.addEventListener('click', async () => {
      status.textContent = '';
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(code.textContent);
        status.textContent = 'Example copied';
      } catch (_) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(code);
        selection?.removeAllRanges();
        selection?.addRange(range);
        status.textContent = 'Select and copy the highlighted example';
      }
    });
  }
  document.querySelectorAll('.orbit-product[data-tilt]').forEach(card => {
    let frame = 0;
    card.addEventListener('pointermove', event => {
      if (paused() || !finePointer.matches) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--sheen-x', ((event.clientX - rect.left) / rect.width * 100) + '%');
        card.style.setProperty('--sheen-y', ((event.clientY - rect.top) / rect.height * 100) + '%');
      });
    });
    card.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      card.style.removeProperty('--sheen-x');
      card.style.removeProperty('--sheen-y');
    });
  });
  const progress = document.createElement('div');
  progress.className = 'studio-scroll-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.append(progress);
  let scrollFrame = 0;
  function updateProgress() {
    scrollFrame = 0;
    const root = document.documentElement;
    const extent = root.scrollHeight - root.clientHeight;
    progress.style.transform = 'scaleX(' + (extent > 0 ? Math.min(1, Math.max(0, window.scrollY / extent)) : 0) + ')';
  }
  function scheduleProgress() { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateProgress); }
  window.addEventListener('scroll', scheduleProgress, { passive: true });
  window.addEventListener('resize', scheduleProgress);
  if ('ResizeObserver' in window) new ResizeObserver(scheduleProgress).observe(document.body);
  updateProgress();
  document.documentElement.dataset.studioReady = 'true';
})();
