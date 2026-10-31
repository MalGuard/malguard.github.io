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
    const far = Math.round(-Math.min(85, scroll * .045));
    const near = Math.round(Math.min(240, scroll * .16));
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
