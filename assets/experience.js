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
