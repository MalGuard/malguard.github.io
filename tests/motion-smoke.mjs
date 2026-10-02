// Benign interaction and performance checks for the scroll-driven homepage flight.
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.TEST_BASE_URL || 'https://127.0.0.1:8443';
assert.ok(['https://127.0.0.1:8443','https://malguard.github.io'].includes(base));
const local = base.includes('127.0.0.1');
const report = [];
await mkdir('test-results', { recursive: true });

async function enter(page) {
  await page.goto(base + '/');
  await page.evaluate(() => document.fonts.ready);
  const entry = page.locator('#sitePublicEntry');
  if (await entry.isVisible()) await entry.click();
  await page.waitForFunction(() => document.documentElement.dataset.spaceReady === 'true');
}
async function station(page, i) {
  await page.locator(`[data-space-dot="${i}"]`).click();
  await page.waitForFunction(n => document.documentElement.dataset.spaceStation === String(n), i, { timeout:5000 });
  const card = page.locator(`.space-card[data-space-station="${i}"]`);
  assert.ok(await card.isVisible(), 'Station '+i+' card must be visible');
  return card;
}

for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch();
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      reducedMotion: 'no-preference',
      ignoreHTTPSErrors: local,
      hasTouch: width === 390
    });
    await context.route('**/*', r => new URL(r.request().url()).origin === base ? r.continue() : r.abort());
    const page = await context.newPage();
    const errors = [], missing = [], requests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400 && new URL(r.url()).origin === base) missing.push(r.url()); });
    page.on('request', r => requests.push(r.url()));
    await enter(page);

    assert.equal(await page.locator('[data-space-dot]').count(), 7);
    assert.ok(await page.locator('#spaceCanvas').isVisible());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.ok(['full','adaptive'].includes(await page.evaluate(() => document.documentElement.dataset.spaceQuality)));

    const shield = page.locator('#openCore');
    await shield.click();
    assert.equal(await shield.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('#coreDetails').getAttribute('aria-hidden'), 'false');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.spaceShield), 'open');
    await page.keyboard.press('Escape');
    assert.equal(await shield.getAttribute('aria-expanded'), 'false');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'openCore');

    for (let i = 0; i < 7; i++) {
      const card = await station(page, i);
      const box = await card.boundingBox();
      assert.ok(box && box.x >= -1 && box.x + box.width <= width + 1, 'Station '+i+' must remain inside viewport');
      assert.equal(await card.getAttribute('aria-hidden'), 'false');
    }

    // One user pulse must be able to scan at least one visible file in the belt.
    await station(page, 2);
    const beforeScan = Number(await page.evaluate(() => document.documentElement.dataset.spaceScanned || 0));
    const canvas = page.locator('#spaceCanvas');
    const probes = width === 390
      ? [{x:300,y:255},{x:250,y:330},{x:330,y:410},{x:205,y:215}]
      : [{x:1040,y:330},{x:980,y:500},{x:1180,y:580},{x:800,y:260},{x:1210,y:250}];
    let scanned = beforeScan;
    for (const p of probes) {
      await canvas.click({ position:p });
      await page.waitForTimeout(950);
      scanned = Number(await page.evaluate(() => document.documentElement.dataset.spaceScanned || 0));
      if (scanned > beforeScan) break;
    }
    assert.ok(scanned > beforeScan, 'Scan pulse should turn a nearby file into scanned state');
    assert.ok(await page.evaluate(() => document.documentElement.dataset.spaceFrames > 0));

    for (let i = 0; i < 3; i++) {
      const card = await station(page, i + 3);
      const trigger = page.locator('#inspectProduct' + i);
      const before = await card.boundingBox();
      await trigger.click(); await page.waitForTimeout(430);
      assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
      assert.ok(await page.locator('#productBack' + i + ' .orbit-card-link').isVisible());
      const after = await card.boundingBox();
      assert.ok(Math.abs(before.height - after.height) < 1 && Math.abs(before.y - after.y) < 2, 'Card flip keeps its position and size');
      assert.equal(await page.evaluate(() => document.activeElement.className), 'product-return');
      await page.locator('#productBack' + i + ' .product-return').click(); await page.waitForTimeout(430);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'inspectProduct' + i);
    }

    const resourceOrigins = [...new Set(requests.map(url => new URL(url).origin))];
    assert.deepEqual(resourceOrigins, [base], 'Flight must not create third-party network requests');
    assert.deepEqual(errors, []);
    assert.deepEqual(missing, []);

    // Pause must stop the flight loop while leaving controls usable.
    await page.locator('#motionToggle').click(); await page.waitForTimeout(130);
    const stopped = Number(await page.evaluate(() => document.documentElement.dataset.spaceFrames || 0));
    await page.waitForTimeout(280);
    assert.equal(Number(await page.evaluate(() => document.documentElement.dataset.spaceFrames || 0)), stopped);
    assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length), 0);
    await page.reload();
    assert.equal(await page.locator('#motionToggle').getAttribute('aria-pressed'), 'true');
    await page.emulateMedia({ reducedMotion:'reduce' });
    await page.waitForFunction(() => document.querySelector('#motionToggle').disabled);
    assert.ok(await page.locator('#motionToggle').isDisabled());

    const metrics = await page.evaluate(() => window.__malguardSpace?.metrics());
    report.push({ browser:name, width, base, result:'passed', metrics, scanned:scanned-beforeScan });
    console.log('PASS space smoke', name, width, base, JSON.stringify(metrics));
    await context.close();
  }

  // Chromium-only 4x CPU throttle approximates the requested DevTools stress check.
  if (name === 'chromium' && local) {
    const context = await browser.newContext({ viewport:{width:1440,height:1000}, reducedMotion:'no-preference', ignoreHTTPSErrors:true });
    await context.route('**/*', r => new URL(r.request().url()).origin === base ? r.continue() : r.abort());
    const page = await context.newPage();
    await enter(page);
    const session = await context.newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate', { rate:4 });
    await page.locator('[data-space-dot="6"]').click();
    await page.waitForFunction(() => document.documentElement.dataset.spaceStation === '6', null, { timeout:8000 });
    await page.waitForTimeout(650);
    const perf = await page.evaluate(() => window.__malguardSpace.metrics());
    console.log('PERF_4X ' + JSON.stringify(perf));
    assert.ok(Number.isFinite(perf.frameAverage) && perf.frameAverage < 30, '4x CPU average frame time must stay under 30 ms');
    assert.ok(['full','adaptive'].includes(perf.quality));
    report.push({ browser:'chromium', width:1440, base, result:'4x-cpu-passed', performance:perf });
    await session.send('Emulation.setCPUThrottlingRate', { rate:1 });
    await context.close();
  }
  await browser.close();
}
await writeFile(`test-results/${local?'local':'published'}-motion-report.json`, JSON.stringify(report, null, 2));
