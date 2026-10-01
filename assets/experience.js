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
        card.style.setProperty('--glow-x', `${(e.clientX-r.left)/r.width*100}%`);
        card.style.setProperty('--glow-y', `${(e.clientY-r.top)/r.height*100}%`);
      });
    });
    card.addEventListener('pointerleave', () => { cancelAnimationFrame(frame); card.style.removeProperty('--tilt-x'); card.style.removeProperty('--tilt-y'); });
  });
  const dialog = document.getElementById('coreDialog');
  const open = document.getElementById('openCore');
  if (dialog && open) {
    let previousOverflow = '';
    open.addEventListener('click', () => {
      if (dialog.open) return;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      open.classList.add('is-open');
      dialog.showModal();
    });
    dialog.querySelector('[data-close-core]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
    dialog.addEventListener('close', () => {
      document.body.style.overflow = previousOverflow;
      open.classList.remove('is-open');
      open.focus({ preventScroll: true });
    });
    const tabs = [...dialog.querySelectorAll('[role="tab"]')];
    function selectTab(tab) {
      tabs.forEach(item => {
        const selected = item === tab;
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
        document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
      });
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => selectTab(tab));
      tab.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        else return;
        event.preventDefault(); selectTab(tabs[next]); tabs[next].focus();
      });
    });
  }
  // Real computation on a fixed, benign fixture. No file reads, requests or verdicts.
  document.querySelectorAll('[data-run-fingerprint]').forEach(button => {
    button.addEventListener('click', async () => {
      const scope = button.closest('.workspace-panel, .code-window');
      const output = scope.querySelector('[data-fingerprint-output]');
      if (button.disabled) return;
      button.disabled = true;
      output.dataset.state = 'working';
      output.setAttribute('aria-busy', 'true');
      output.textContent = 'Calculating SHA-256 locally…';
      try {
        if (!window.isSecureContext || !window.crypto?.subtle) {
          throw new Error('Local hashing requires a secure browser context');
        }
        const bytes = new TextEncoder().encode('MalGuard demo — local only.');
        const digest = await window.crypto.subtle.digest('SHA-256', bytes);
        const fingerprint = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
        output.dataset.state = 'success';
        output.textContent = `SHA-256 · ${bytes.byteLength} UTF-8 bytes\n${fingerprint}\nCalculated locally. Identity only — not a safety verdict.`;
      } catch (_) {
        output.dataset.state = 'error';
        output.textContent = 'Fingerprint unavailable. Open this page over HTTPS in a browser with Web Crypto enabled and try again. No result or safety verdict was generated.';
      } finally {
        output.removeAttribute('aria-busy');
        button.disabled = false;
      }
    });
  });
  // Keep old shared homepage product links pointing to the supported pages.
  if (document.body.classList.contains('mg-home')) {
    const legacy = {'#gta-guard':'/gta-guard.html','#malware-ai':'/malware-ai.html','#game-scam-guard':'/products.html#game-scam-guard','#download':'/download.html','#feedback':'/support.html'};
    function routeLegacy() { if (legacy[location.hash]) location.replace(legacy[location.hash]); }
    window.addEventListener('hashchange', routeLegacy); routeLegacy();
  }
  document.documentElement.dataset.experienceReady = "true";
})();
