/* Homepage-only, compositor-friendly star parallax. No timers or dependencies. */
(() => {
  'use strict';
  const scene = document.querySelector('body.precision-home > .particle-atmosphere');
  if (!scene || !window.requestAnimationFrame || !window.matchMedia) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let scheduled = false;
  let lastFar = null;
  let lastNear = null;

  function draw() {
    scheduled = false;
    const scroll = reducedMotion.matches ? 0 : Math.max(0, window.scrollY || 0);
    // Spread the perspective shift across the *entire* page, not just
    // the first screenful. This also adapts when page length changes.
    const scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = Math.min(1, scroll / scrollRange);
    const far = Math.round(-110 * progress);
    const near = Math.round(280 * progress);
    if (far !== lastFar) {
      scene.style.setProperty('--mg-space-far', far + 'px');
      lastFar = far;
    }
    if (near !== lastNear) {
      scene.style.setProperty('--mg-space-near', near + 'px');
      lastNear = near;
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(draw);
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('pageshow', schedule);
  if (typeof reducedMotion.addEventListener === 'function') {
    reducedMotion.addEventListener('change', schedule);
  } else if (typeof reducedMotion.addListener === 'function') {
    reducedMotion.addListener(schedule);
  }
  scene.dataset.spaceDepth = 'ready';
  schedule();
})();
