/* Browser verification for the authored GTA Guard cinematic journey.
   Run only against a local preview. This script never uploads or reads a file. */
const { playwright, siteURL } = require('./qa-runtime.cjs');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const webkit = process.argv[2] === 'webkit';
const negative = process.argv.includes('--negative');
const only = process.argv.find(a => a.startsWith('--only='))?.slice(7);
const keepGoing = process.argv.includes('--keep-going');
const engine = webkit ? 'webkit' : 'chromium';
const output = path.resolve(__dirname, '../../test-results/fusion');
fs.mkdirSync(output, { recursive: true });
const profiles = negative ? [
  { label: 'no-webgl', width: 1440, height: 900, disableGL: true },
  { label: 'scene-failure', width: 1440, height: 900, failScene: true },
  { label: 'reduced-keyboard', width: 1440, height: 900, reduced: true },
  { label: 'reduced-during-load', width: 1440, height: 900, delayScene: true },
  { label: 'reduced-while-idle', width: 1440, height: 900, switchReduced: true },
  { label: 'weak-desktop', width: 1440, height: 900, memory: 2 }
] : [
  { label: 'desktop', width: 1440, height: 900, full: true },
  { label: 'retina', width: 1440, height: 900, dpr: 2 },
  { label: 'ipad', width: 820, height: 1180, touch: true },
  { label: 'compact-ipad', width: 768, height: 1024, touch: true },
  { label: 'ipad-landscape', width: 1024, height: 768, touch: true },
  { label: 'mobile', width: 390, height: 844, touch: true },
  { label: 'phone-edge', width: 360, height: 800, touch: true },
  { label: 'small-tall', width: 320, height: 844, touch: true },
  { label: 'short-mobile', width: 390, height: 740, touch: true },
  { label: 'small-mobile', width: 320, height: 568, touch: true },
  { label: 'landscape', width: 844, height: 390, touch: true },
  { label: 'zoom-short', width: 360, height: 225 }
];
const stations = [
  { p: .275, chapter: 0, name: 'identify' },
  { p: .46, chapter: 1, name: 'inspect' },
  { p: .65, chapter: 2, name: 'analyze' },
  { p: .81, chapter: 3, name: 'decide' }
];
let browser;
const allReports = [];

function check(condition, description) { assert(condition, description); }
function checkpoint(p, name) { return path.join(output, `gta-cinematic-${engine}-${p.label}-${name}.png`); }
async function state(page) { return page.evaluate(() => MalGuardGTA.snapshot()); }
async function idle(page) {
  // scrollTo returns before the native scroll event is dispatched. Let two
  // browser frames consume it before observing the controller's idle state.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForFunction(() => !MalGuardGTA.snapshot().raf, null, { timeout: 10000 });
  const before = await state(page);
  await page.waitForTimeout(350);
  const after = await state(page);
  check(!after.raf, 'requestAnimationFrame kept running after the composition settled');
  if (before.scene && after.scene) assert.equal(before.scene.frames, after.scene.frames, 'idle GPU renderer kept rendering');
  return { framesBefore: before.scene?.frames, framesAfter: after.scene?.frames, stopped: !after.raf };
}
async function seek(page, p) {
  await page.evaluate(p => {
    const h = document.getElementById('overview');
    const stage = document.getElementById('gta-stage');
    const start = scrollY + h.getBoundingClientRect().top;
    scrollTo({ top: start + Math.max(1, h.offsetHeight - stage.offsetHeight) * p, behavior: 'instant' });
  }, p);
  await page.waitForFunction(p => Math.abs(MalGuardGTA.snapshot().journey - p) < .0015, p, { timeout: 9000 });
  await page.waitForTimeout(80);
}
async function composition(page, selector) {
  return page.evaluate(selector => {
    const box = e => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
    const element = document.querySelector(selector);
    const children = [...element.children].filter(e => {
      const r = e.getBoundingClientRect(), s = getComputedStyle(e);
      return r.width && r.height && s.visibility !== 'hidden';
    });
    const boxes = children.map(box);
    const text = boxes.length ? { left: Math.min(...boxes.map(r => r.left)), right: Math.max(...boxes.map(r => r.right)), top: Math.min(...boxes.map(r => r.top)), bottom: Math.max(...boxes.map(r => r.bottom)) } : box(element);
    const stage = box(document.getElementById('gta-stage'));
    const art = box(document.getElementById('gta-art'));
    const snapshot = MalGuardGTA.snapshot();
    const localBounds = snapshot.scene?.bounds;
    const bounds = localBounds ? { left: localBounds.left + art.left, right: localBounds.right + art.left, top: localBounds.top + art.top, bottom: localBounds.bottom + art.top } : box(document.querySelector('.gate-fallback'));
    return { state: snapshot, text, bounds, stage, rail:box(document.getElementById('journey-rail')), opacity: Number(getComputedStyle(element).opacity), background: getComputedStyle(element).backgroundColor, ariaHidden: element.getAttribute('aria-hidden'), inert: element.inert, viewport: { width: innerWidth, height: innerHeight } };
  }, selector);
}
function checkComposition(c, profile, label) {
  check(c.opacity >= .95, `${label}: copy did not settle into its readable hold (${c.opacity})`);
  assert.equal(c.background, 'rgba(0, 0, 0, 0)', `${label}: a dark backplate was placed behind the text`);
  check(c.text.left >= -1 && c.text.right <= profile.width + 1, `${label}: text exceeds the viewport horizontally`);
  if (c.state.enhanced) {
    check(Math.abs(c.stage.top) < 2, `${label}: sticky stage moved while a chapter was being read`);
    check(c.text.top >= 70 && c.text.bottom <= profile.height - 65, `${label}: reading copy collided with header/footer or was clipped`);
    check(c.text.bottom<=c.rail.top-12,`${label}: reading copy collided with the stage rail`);
  }
  if (profile.width > 900) {
    check(c.bounds.left >= c.text.right + 8 || c.bounds.bottom <= c.text.top - 8 || c.bounds.top >= c.text.bottom + 8,
      `${label}: conservative art bounds overlap readable text (art left=${c.bounds.left.toFixed(1)}, text right=${c.text.right.toFixed(1)})`);
  } else {
    check(c.bounds.bottom <= c.text.top - 6 || c.bounds.right <= c.text.left - 6 || c.bounds.left >= c.text.right + 6,
      `${label}: artwork intersects the mobile/tablet reading region (art bottom=${c.bounds.bottom.toFixed(1)}, text top=${c.text.top.toFixed(1)})`);
  }
  if (c.state.scene) {
    check(c.state.scene.authenticLogo, `${label}: authentic MalGuard logo missing from 3D surface`);
    check(c.state.scene.triangles <= 50000, `${label}: triangle budget exceeded`);
    check(c.state.scene.drawCalls < 100, `${label}: draw-call budget exceeded`);
  }
}
async function panelRect(page) {
  return page.evaluate(() => {
    const app = document.getElementById('scanner-app'), r = app.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height, inert: app.inert, position: getComputedStyle(app).position, count: document.querySelectorAll('#scanner-app').length, portal: MalGuardGTA.snapshot().portalActive };
  });
}
async function handoff(page, report) {
  await seek(page, .90);
  const entering = await panelRect(page);
  check(entering.portal, 'the HTML evidence panel did not enter the camera handoff');
  check(entering.inert, 'scaled evidence preview accepts interaction before the handoff');
  assert.equal(entering.count, 1, 'duplicate scanner-app during camera handoff');
  await page.screenshot({ path: checkpoint(report.profile, 'handoff') });
  const nativeTop = await page.evaluate(() => { const r = document.querySelector('.app-slot').getBoundingClientRect(); return r.top + scrollY; });
  await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), nativeTop - 92);
  await idle(page);
  const before = await panelRect(page);
  await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), nativeTop - 88);
  await idle(page);
  const after = await panelRect(page);
  check(!after.portal && !after.inert, 'evidence panel did not become the normal interactive HTML panel');
  assert.equal(after.count, 1, 'duplicated scanner-app after handoff');
  check(Math.abs(before.left - after.left) <= 3 && Math.abs(before.width - after.width) <= 3 && Math.abs(before.top - after.top) <= 7,
    `camera-to-HTML handoff jumped: ${JSON.stringify({ before, after })}`);
  // Reverse across the exact same boundary: no second panel, no lost form state.
  await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), nativeTop - 92);
  await idle(page);
  const reversed = await panelRect(page);
  check(reversed.portal && reversed.inert && reversed.count === 1, 'reverse handoff failed to return to the same cinematic panel');
  await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), nativeTop - 88);
  await idle(page);
  report.handoff = { entering, before, after, reversed, continuity: true };
}
async function scanEvidence(page, profile, report) {
  await page.locator('#sample-form').scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  check(!(await panelRect(page)).inert, 'native demo remained inert at the form');
  if (profile.full) {
    await page.evaluate(() => {
      window.observedStages = [];
      const e = document.getElementById('scanner-app');
      new MutationObserver(() => { const n = Number(e.dataset.stage); if (n >= 0 && !observedStages.includes(n)) observedStages.push(n); }).observe(e, { attributes: true, attributeFilter: ['data-stage'] });
    });
    await page.locator('#scan-button').click();
    await page.waitForFunction(() => MalGuardGTA.snapshot().completed, null, { timeout: 20000 });
    assert.deepEqual(await page.evaluate(() => observedStages), [0, 1, 2, 3], 'four analysis stages were not shown in order');
  }
  // Reduced motion preserves all outcomes without waiting for decorative typing.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(220);
  const verdicts = [];
  for (const [sample, title] of [[1, 'Inconclusive'], [0, 'Suspicious'], [2, 'No scripted indicators'], [3, 'Malicious']]) {
    await page.locator('#sample-select').selectOption(String(sample));
    await page.locator('#scan-button').click();
    await page.waitForFunction(() => MalGuardGTA.snapshot().completed, null, { timeout: 5000 });
    assert.equal((await page.locator('#result-title').textContent()).trim(), title);
    if (sample === 1) {
      assert.equal((await page.locator('#coverage-label').textContent()).trim(), 'Incomplete');
      check((await page.locator('#result-detail').textContent()).includes('missing'), 'missing evidence was omitted');
      check((await page.locator('#evidence-coverage').textContent()).includes('never be interpreted as Safe'), 'Inconclusive was not qualified');
    }
    if (sample === 2) check((await page.locator('#result-detail').textContent()).includes('never a guarantee'), 'completed demo checks were presented as a safety guarantee');
    verdicts.push(title);
  }
  await page.locator('#sample-name').fill('fictional_custom_mod.asi');
  await page.locator('#sample-name').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => MalGuardGTA.snapshot().completed, null, { timeout: 5000 });
  assert.equal((await page.locator('#result-title').textContent()).trim(), 'Inconclusive');
  assert.equal((await page.locator('#evidence-name').textContent()).trim(), 'fictional_custom_mod.asi');
  if(profile.switchReduced){
    await idle(page);
    const originalTop=(await page.locator('#scanner-app').boundingBox()).y;
    report.motionPreferenceTransitions=[];
    for(const preference of ['no-preference','reduce']){
      await page.emulateMedia({reducedMotion:preference});
      await page.waitForFunction(enhanced=>MalGuardGTA.snapshot().enhanced===enhanced,preference==='no-preference',{timeout:8000});
      await idle(page);
      report.motionPreferenceTransitions.push({preference,originalTop,actualTop:(await page.locator('#scanner-app').boundingBox()).y,state:await state(page)});
      check(Math.abs((await page.locator('#scanner-app').boundingBox()).y-originalTop)<=3,'motion preference moved the interactive demo out of the reading viewport');
      assert.equal(await page.locator('#sample-name').inputValue(),'fictional_custom_mod.asi','motion preference lost the typed filename');
      check(!(await panelRect(page)).inert,'motion preference left the active HTML demo inert');
    }
    report.motionPreferenceInDemo={viewportPreserved:true,typedNamePreserved:true,interactive:true};
  }
  await page.locator('#evidence-details summary').focus();
  await page.keyboard.press('Enter');
  check(await page.locator('#evidence-details').evaluate(e => e.open), 'evidence details cannot be opened using a keyboard');
  check((await page.locator('#evidence-finding').textContent()).includes('Encrypted'), 'fictional evidence is unavailable');
  const focus = await page.locator('#evidence-details summary').evaluate(e => { const s = getComputedStyle(e); return { focused: document.activeElement === e, outlineWidth: s.outlineWidth, outlineStyle: s.outlineStyle }; });
  check(focus.focused && parseFloat(focus.outlineWidth) >= 2 && focus.outlineStyle !== 'none', 'keyboard focus is not clearly visible');
  await page.locator('#evidence-details').evaluate(e => scrollTo({ top: scrollY + e.getBoundingClientRect().top - innerHeight * .6, behavior: 'instant' }));
  await page.waitForTimeout(100);
  const warning = await page.locator('#demo-warning').boundingBox();
  check(warning && warning.y >= 0 && warning.y + warning.height <= profile.height + 1, 'permanent demo warning was clipped while reading evidence');
  check(await page.locator('#demo-warning').evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));}), 'permanent demo warning was obscured by another element');
  assert.equal((await page.locator('#demo-warning').textContent()).trim(), 'Illustrative demo only — no file is uploaded, read, or executed.');
  assert.equal(await page.locator('input[type=file]').count(), 0, 'a real file input was added');
  check(!(await page.locator('#scanner').innerText()).includes('Looks safe'), 'definitive Looks safe text returned');
  report.analysis = { orderedStages: profile.full ? [0, 1, 2, 3] : 'reduced-motion immediate completion', verdicts, typedCustomName: true, keyboardSubmit: true, keyboardDetails: true, focus, permanentWarning: true, noFileInput: true };
  await page.screenshot({ path: checkpoint(profile, 'evidence') });
}

async function runProfile(profile) {
  const context = await browser.newContext({ ignoreHTTPSErrors:true,viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: profile.dpr || 1, hasTouch: !!profile.touch, isMobile: !!profile.touch, reducedMotion: profile.reduced ? 'reduce' : 'no-preference' });
  await context.addInitScript(({ memory, disableGL }) => {
    Object.defineProperty(navigator, 'deviceMemory', { get: () => memory });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    window.__gtaQAFileReads = [];
    for (const method of ['readAsArrayBuffer', 'readAsBinaryString', 'readAsDataURL', 'readAsText']) {
      const original = FileReader.prototype[method];
      if (original) FileReader.prototype[method] = function(...args) { window.__gtaQAFileReads.push('FileReader.' + method); return Reflect.apply(original, this, args); };
    }
    for (const method of ['arrayBuffer', 'text', 'stream']) {
      const original = File.prototype[method];
      if (original) File.prototype[method] = function(...args) { window.__gtaQAFileReads.push('File.' + method); return Reflect.apply(original, this, args); };
    }
    if (disableGL) { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type, ...args) { return /webgl/.test(type) ? null : original.call(this, type, ...args); }; }
  }, { memory: profile.memory || 8, disableGL: !!profile.disableGL });
  if (profile.failScene) await context.route('**/gta-guard-scene.js*', route => route.abort());
  if(profile.delayScene)await context.route('**/gta-guard-scene.js*',async route=>{await new Promise(resolve=>setTimeout(resolve,900));await route.continue();});
  // Allow the local fault/delay fixtures registered above to receive requests.
  await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(siteURL).origin?r.fallback():r.abort());
  const page = await context.newPage();
  const errors = [], writes = [], sceneRequests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (!['GET', 'HEAD'].includes(r.method())) writes.push({ url: r.url(), method: r.method() }); if (r.url().includes('gta-guard-scene.js')) sceneRequests.push(r.url()); });
  const report = { engine, profile, url: siteURL + 'gta-guard.html', errors, writes, sceneRequests, status: 'RUNNING' };
  allReports.push(report);
  try {
    await page.goto(report.url);
    await page.waitForFunction(() => window.MalGuardGTA);
    if(profile.delayScene){await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(1300);check((await state(page)).renderer==='css'&&!((await state(page)).scene),'Reduced Motion during loading initialized an active GPU scene');profile.reduced=true;report.reducedDuringLoad=true;}
    report.initial = await composition(page, '.hero-copy');
    if (!profile.reduced) { assert.equal(report.initial.opacity, 0, 'copy appeared before the cinematic opening'); check(report.initial.inert, 'intro copy accepts interaction while invisible'); }
    assert.equal(await page.locator('#scanner-app').count(), 1, 'multiple copies of the analysis app exist');
    await page.waitForFunction(() => MalGuardGTA.snapshot().ready, null, { timeout: 25000 });
    const expectsGL = (await state(page)).enhanced && profile.width > 600 && !profile.reduced && !profile.disableGL && !profile.failScene && (profile.memory || 8) > 2;
    if (expectsGL) await page.waitForFunction(() => MalGuardGTA.snapshot().renderer === 'webgl', null, { timeout: 25000 });
    if(profile.switchReduced){
      await idle(page);await page.emulateMedia({reducedMotion:'reduce'});
      await page.waitForFunction(()=>!MalGuardGTA.snapshot().enhanced&&MalGuardGTA.snapshot().renderer==='css',null,{timeout:7000});
      profile.reduced=true;report.reducedWhileIdle=true;
    }
    if (profile.disableGL || profile.failScene) await page.waitForFunction(() => MalGuardGTA.snapshot().renderFailed, null, { timeout: 15000 });
    await page.waitForTimeout(1150);
    report.hero = await composition(page, '.hero-copy');
    checkComposition(report.hero, profile, 'hero');
    if (!expectsGL && !profile.disableGL && !profile.failScene && !profile.delayScene) assert.equal(sceneRequests.length, 0, 'the heavy renderer was loaded on a fallback device');
    report.idleHero = await idle(page);
    await page.screenshot({ path: checkpoint(profile, 'hero') });
    if (profile.full) {
      await page.locator('#intro-replay').click();
      await page.waitForTimeout(100);
      const replay = await composition(page, '.hero-copy');
      check(!replay.state.ready && replay.opacity === 0 && replay.inert, 'Replay did not restart the finite opening before the copy');
      await page.locator('#intro-skip').click();
      await page.waitForFunction(() => MalGuardGTA.snapshot().ready);
      await idle(page);
      await page.locator('#motion-toggle').click();
      check((await state(page)).paused, 'Pause control did not pause motion');
      await page.locator('#motion-toggle').click();
      check(!(await state(page)).paused, 'Resume control did not resume motion');
      await idle(page);
      report.openingControls = { replay: true, skip: true, pause: true, resume: true };
    }
    // Wheel over artwork remains native page scrolling. Drag is deliberately inert.
    const startCamera = report.hero.state.scene?.camera;
    const wheelBefore = await page.evaluate(() => scrollY);
    await page.mouse.move(profile.width * .75, Math.min(profile.height * .35, 330));
    await page.mouse.down(); await page.mouse.move(profile.width * .75 + 35, Math.min(profile.height * .35, 330) + 20, { steps: 4 }); await page.mouse.up();
    await page.waitForTimeout(100);
    if (startCamera) assert.deepEqual((await state(page)).scene.camera, startCamera, 'the 3D introduction became a draggable toy');
    if(webkit&&profile.touch)await page.evaluate(()=>scrollBy({top:160,behavior:'instant'}));
    else await page.mouse.wheel(0, 160);
    // wheel() dispatches input; it does not await the browser's scrolling frame.
    await page.waitForFunction(before=>scrollY>before+40,wheelBefore,{timeout:6000});
    report.nativeWheel = !(webkit&&profile.touch);report.nativePageScroll=true;report.touchSwipeLimit=webkit&&profile.touch?'Physical swipe untested; native engine scroll exercised':undefined;report.noObjectDrag = true;
    const enhanced = (await state(page)).enhanced;
    report.readingHolds = [];
    if (enhanced) {
      for (const direction of ['forward', 'reverse']) {
        for (const station of direction === 'forward' ? stations : [...stations].reverse()) {
          await seek(page, station.p);
          const c = await composition(page, `[data-chapter="${station.chapter}"]`);
          assert.equal(c.state.chapter, station.chapter, `${direction} ${station.name}: wrong active chapter`);
          checkComposition(c, profile, `${direction} ${station.name}`);
          const idleResult = await idle(page);
          report.readingHolds.push({ direction, station, composition: c, idle: idleResult });
          if (direction === 'forward') await page.screenshot({ path: checkpoint(profile, station.name) });
        }
      }
      await handoff(page, report);
    } else {
      assert.equal((await state(page)).portalActive, false, 'short/reduced-motion layout created a fixed application overlay');
      for (const station of stations) {
        const locator = page.locator(`[data-chapter="${station.chapter}"]`);
        await locator.scrollIntoViewIfNeeded();
        await page.waitForTimeout(70);
        const visible = await locator.evaluate(e => ({ opacity: Number(getComputedStyle(e).opacity), inert: e.inert, ariaHidden: e.getAttribute('aria-hidden') }));
        check(visible.opacity >= .95 && !visible.inert && visible.ariaHidden !== 'true', 'fallback hides an analysis chapter');
      }
      report.staticChaptersReadable = true;
    }
    // Sweep the complete route, then return through it to catch overflow/re-entry bugs.
    const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    let maxOverflow = 0;
    for (const reverse of [false, true]) {
      const points = []; for (let y = 0; y <= fullHeight; y += Math.max(140, profile.height * .7)) points.push(y); points.push(fullHeight);
      for (const y of reverse ? points.reverse() : points) {
        await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), y);
        await page.waitForTimeout(20);
        maxOverflow = Math.max(maxOverflow, await page.evaluate(() => document.documentElement.scrollWidth - innerWidth));
      }
    }
    check(maxOverflow <= 1, `horizontal overflow: ${maxOverflow}px`);
    report.fullPageScroll = { forward: true, reverse: true, maxOverflow };
    if (profile.full) {
      await seek(page, .46); await idle(page);
      await page.evaluate(() => MalGuardGTA.loseContext());
      await page.waitForFunction(() => MalGuardGTA.snapshot().renderer === 'css' && MalGuardGTA.snapshot().renderFailed, null, { timeout: 7000 });
      report.contextLossFallback = true;
      const c = await composition(page, '[data-chapter="1"]');
      check(c.opacity >= .95, 'context loss removed the reading copy');
    }
    const headerSkip = page.locator('.site-header a[href="#scanner"]');
    if (await headerSkip.isVisible()) {
      await headerSkip.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => {
        const app = document.getElementById('scanner-app'), top = app.getBoundingClientRect().top;
        return !MalGuardGTA.snapshot().portalActive && !app.inert && document.activeElement?.id === 'sample-select' && top >= 60 && top <= 110;
      }, null, { timeout: 10000 });
      await page.waitForTimeout(150);
      const destination = await panelRect(page);
      check(!destination.portal && !destination.inert, 'header skip reactivated the inert portal after releasing it');
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'sample-select', 'header skip focus was lost during the camera handoff');
      check(destination.top >= 60 && destination.top <= 110, 'header skip stopped before the native panel landing');
      report.headerSkip = { keyboardActivated: true, normalFlowReleased: true, focus: 'sample-select', destination };
    } else {
      report.headerSkip = { intentionallyHiddenAtSmallViewport: true, alternateCTAAvailable: await page.locator('.hero-actions a[href="#scanner"]').count() === 1 };
    }
    if (enhanced) await seek(page, 0);
    if(profile.touch)await page.locator('.hero-actions a[href="#scanner"]').tap();else await page.locator('.hero-actions a[href="#scanner"]').click();
    await page.waitForFunction(() => {
      const app=document.getElementById('scanner-app'),top=app.getBoundingClientRect().top;
      return !MalGuardGTA.snapshot().portalActive&&!app.inert&&document.activeElement?.id==='sample-select'&&top>=60&&top<=110;
    }, null, { timeout: 10000 });
    await scanEvidence(page, profile, report);
    assert.deepEqual(errors, [], 'browser JavaScript errors');
    assert.deepEqual(writes, [], 'a request wrote/uploaded data');
    report.fileAPICalls = await page.evaluate(() => __gtaQAFileReads);
    assert.deepEqual(report.fileAPICalls, [], 'the illustration read file bytes');
    report.final = await state(page); report.status = 'PASS';
    console.log(`PASS GTA cinematic ${engine} ${profile.label}`);
  } catch (error) {
    report.status = 'FAIL'; report.failure = error.stack || String(error);
    report.lastState = await state(page).catch(() => null);
    await page.screenshot({ path: checkpoint(profile, 'failure'), fullPage: false }).catch(() => {});
    throw error;
  } finally {
    fs.writeFileSync(path.join(output, `gta-cinematic-${engine}-${profile.label}.json`), JSON.stringify(report, null, 2));
    await context.close();
  }
}

(async () => {
  browser = await (webkit ? playwright.webkit : playwright.chromium).launch(webkit ? { headless: !process.env.DISPLAY } : require('./qa-runtime.cjs').chromiumLaunch);
  let failures = 0;
  const selected = profiles.filter(p => !only || p.label === only);
  check(selected.length, `unknown profile: ${only}`);
  for (const profile of selected) {
    try { await runProfile(profile); } catch (error) { failures++; console.error(error.stack || error); if (!keepGoing) break; }
  }
  fs.writeFileSync(path.join(output, `gta-cinematic-${engine}-${negative ? 'negative' : only || 'matrix'}.json`), JSON.stringify(allReports, null, 2));
  await browser.close(); browser = null;
  if (failures) process.exitCode = 1;
})().catch(async error => { console.error(error.stack || error); if (browser) await browser.close(); process.exitCode = 1; });
