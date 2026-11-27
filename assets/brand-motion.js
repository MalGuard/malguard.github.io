/* MalGuard motion: reversible DOM interactions, bounded canvas work, native scrolling. */
(() => {
  'use strict';
  if (!document.body.classList.contains('mg-home')) return;
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const paused = () => reduced.matches || root.classList.contains('motion-paused');
  const scene = document.getElementById('securityScene');
  const shield = document.getElementById('openCore');
  const details = document.getElementById('coreDetails');
  let shieldOpen = false;
  function setShield(open) {
    shieldOpen = open;
    scene.classList.toggle('core-open', open);
    shield.setAttribute('aria-expanded', String(open));
    shield.setAttribute('aria-label', open ? 'Close the MalGuard shield' : 'Open the MalGuard shield');
    details.setAttribute('aria-hidden', String(!open));
    details.inert = !open;
    document.getElementById('coreHint').textContent = open ? 'Tap again to close ↙︎' : 'Tap the shield to open ↗︎';
  }
  shield.addEventListener('click', () => setShield(!shieldOpen));
  shield.addEventListener('pointermove', e => {
    if (paused() || !fine.matches || shieldOpen) return;
    const box = shield.getBoundingClientRect();
    shield.style.setProperty('--shield-tilt', ((e.clientX - box.left) / box.width - .5) * 18 + 'deg');
  });
  shield.addEventListener('pointerleave', () => shield.style.removeProperty('--shield-tilt'));
  const cards = [...document.querySelectorAll('.orbit-product')];
  function turnCard(card, open, focus = true) {
    const front = card.querySelector('.product-front');
    const back = card.querySelector('.product-back');
    const trigger = front.querySelector('[data-product-inspect]');
    card.classList.toggle('is-flipped', open);
    trigger.setAttribute('aria-expanded', String(open));
    // Move focus before hiding its previous face from the accessibility tree.
    front.inert = open;
    back.inert = !open;
    if (focus) (open ? back.querySelector('.product-return') : trigger).focus({ preventScroll: true });
    front.setAttribute('aria-hidden', String(open));
    back.setAttribute('aria-hidden', String(!open));
  }
  cards.forEach((card, i) => {
    card.style.setProperty('--reveal-order', String(i));
    const title = card.querySelector('h3').textContent;
    const trigger = card.querySelector('[data-product-inspect]');
    trigger.setAttribute('aria-label', 'Turn to explore ' + title);
    trigger.addEventListener('click', () => turnCard(card, true));
    card.querySelector('.product-return').addEventListener('click', () => turnCard(card, false));
    card.addEventListener('click', e => {
      if (e.target.closest('a,button') || getSelection()?.toString()) return;
      turnCard(card, !card.classList.contains('is-flipped'));
    });
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const card = document.activeElement?.closest('.orbit-product.is-flipped');
    if (card) turnCard(card, false);
    if (shieldOpen && scene.contains(document.activeElement)) { setShield(false); shield.focus({ preventScroll: true }); }
  });

  const stack = document.querySelector('.analysis-stack');
  const stackToggle = document.getElementById('stackToggle');
  const steps = [...document.querySelectorAll('.orbit-step')];
  let stackTouched = false;
  function spread(open) {
    stack.classList.toggle('is-spread', open);
    stackToggle.setAttribute('aria-pressed', String(open));
    stackToggle.innerHTML = open ? 'Gather layers <span aria-hidden="true">↙︎</span>' : 'Separate layers <span aria-hidden="true">↗︎</span>';
  }
  stackToggle.addEventListener('click', () => { stackTouched = true; spread(!stack.classList.contains('is-spread')); });
  steps.forEach((step, i) => step.addEventListener('toggle', () => {
    if (!step.open) return;
    steps.forEach(other => { if (other !== step) other.open = false; });
    stack.querySelectorAll('.stack-plane').forEach(plane => plane.classList.toggle('is-active', Number(plane.dataset.plane) === i));
    // Native details dispatch an initial toggle for their HTML open attribute.
    if (i !== 0 || stackTouched) { stackTouched = true; spread(true); }
  }));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      entry.target.classList.toggle('motion-outside', !entry.isIntersecting);
      if (entry.target === stack && entry.isIntersecting && !stackTouched && !paused()) spread(true);
    }), { threshold: .06 });
    [scene, stack, ...cards].forEach(el => observer.observe(el));
  }
  const progress = document.createElement('div');
  progress.className = 'scroll-reading-line'; progress.setAttribute('aria-hidden', 'true'); document.body.append(progress);
  let scrollFrame = 0;
  function updateProgress() {
    scrollFrame = 0;
    const length = root.scrollHeight - root.clientHeight;
    progress.style.transform = 'scaleX(' + (length ? Math.max(0, Math.min(1, scrollY / length)) : 0) + ')';
  }
  const scheduleProgress = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateProgress); };
  addEventListener('scroll', scheduleProgress, { passive: true });
  addEventListener('resize', scheduleProgress);
  new ResizeObserver(scheduleProgress).observe(document.body);
  updateProgress();

  // Sparse, silver connections echo the reference while leaving the reading area quiet.
  const canvas = document.getElementById('networkField');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let width = 0, height = 0, frame = 0, last = 0, time = 0, frames = 0;
  let pointerX = 0, pointerY = 0, targetX = 0, targetY = 0;
  let points = [];
  const running = () => !paused() && !document.hidden && !document.body.classList.contains('site-entry-locked');
  function draw() {
    ctx.clearRect(0, 0, width, height);
    const drift = paused() ? 0 : scrollY * .035;
    const positions = points.map(p => ({
      x: p.x * width + Math.sin(time * p.speed + p.phase) * 28 + pointerX * p.depth,
      y: ((p.y * height + Math.cos(time * .6 + p.phase) * 24 - drift * p.depth) % (height + 80) + height + 80) % (height + 80) - 40,
      depth: p.depth
    }));
    const range = width < 600 ? 115 : 155;
    for (let i = 0; i < positions.length; i++) {
      const a = positions[i];
      for (let j = i + 1; j < positions.length; j++) {
        const b = positions[j], distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance > range) continue;
        const alpha = (1 - distance / range) * .19;
        ctx.strokeStyle = `rgba(177,197,222,${alpha})`; ctx.lineWidth = .65;
        ctx.beginPath(); ctx.moveTo(a.x, a.y + pointerY * a.depth); ctx.lineTo(b.x, b.y + pointerY * b.depth); ctx.stroke();
        // One small pulse travels along a few connections, rather than flashing the page.
        if ((i + j) % 9 === 0) {
          const p = (time * .11 + i * .137) % 1;
          ctx.fillStyle = `rgba(211,225,242,${alpha * 2})`;
          ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p, 1.3, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.fillStyle = `rgba(202,216,236,${.14 + a.depth * .09})`;
      ctx.beginPath(); ctx.arc(a.x, a.y + pointerY * a.depth, a.depth > .8 ? 1.5 : .8, 0, Math.PI * 2); ctx.fill();
    }
    frames++; root.dataset.networkFrames = String(frames);
  }
  function tick(now) {
    frame = 0;
    if (!running()) return;
    if (now - last >= 32) {
      time += Math.min(64, now - last) / 1000; last = now;
      pointerX += (targetX - pointerX) * .06; pointerY += (targetY - pointerY) * .06;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame); frame = 0; last = performance.now();
    if (paused()) { pointerX = pointerY = 0; shield.style.removeProperty('--shield-tilt'); }
    draw();
    if (running()) frame = requestAnimationFrame(tick);
  }
  function resize() {
    width = innerWidth; height = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = width < 600 ? 38 : 72;
    points = Array.from({ length: count }, (_, i) => ({ x: (Math.sin(i * 127.1 + 3) + 1) / 2, y: (Math.cos(i * 91.7 + 7) + 1) / 2, depth: .3 + (i % 7) / 10, speed: .13 + (i % 5) * .025, phase: i * 2.4 }));
    root.dataset.networkPoints = String(count); sync();
  }
  addEventListener('pointermove', e => {
    if (paused() || !fine.matches) return;
    targetX = (e.clientX / width - .5) * 22; targetY = (e.clientY / height - .5) * 15;
  }, { passive: true });
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', sync);
  addEventListener('malguard-motion', sync);
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  resize();
  root.dataset.collectionReady = 'true';
})();
