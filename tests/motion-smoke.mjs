// Benign interaction checks can target the reviewed fixture or the published site.
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.TEST_BASE_URL || 'https://127.0.0.1:8443';
assert.ok(['https://127.0.0.1:8443','https://malguard.github.io'].includes(base));
const local = base.includes('127.0.0.1');
const report = [];
await mkdir('test-results', { recursive: true });
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch();
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, reducedMotion: 'no-preference', ignoreHTTPSErrors: local, hasTouch: width === 390 });
    // Never call administrator or analysis backends during visual verification.
    await context.route('**/*', r => new URL(r.request().url()).origin === base ? r.continue() : r.abort());
    const page = await context.newPage(); const errors = []; const missing = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400 && new URL(r.url()).origin === base) missing.push(r.url()); });
    await page.goto(base + '/');
    await page.evaluate(() => document.fonts.ready);
    await page.locator('#sitePublicEntry').click();
    await page.waitForFunction(() => document.documentElement.dataset.collectionReady === 'true');
    const shield = page.locator('#openCore');
    await shield.click(); await page.waitForTimeout(1250);
    assert.equal(await shield.getAttribute('aria-expanded'), 'true');
    const notes = await page.locator('.core-note').evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height, opacity:getComputedStyle(n).opacity }; }));
    notes.forEach(n => { assert.ok(n.x >= 0 && n.x + n.width <= width + 1); assert.equal(n.opacity, '1'); });
    for (let i = 0; i < notes.length; i++) for (let j = i+1; j < notes.length; j++) {
      const a=notes[i], b=notes[j]; assert.ok(a.x+a.width<=b.x || b.x+b.width<=a.x || a.y+a.height<=b.y || b.y+b.height<=a.y, 'Shield explanations must never overlap');
    }
    await page.locator('#securityScene').scrollIntoViewIfNeeded();
    await page.screenshot({ path:`test-results/${local?'local':'published'}-${name}-${width}-shield.png` });
    await shield.click();
    for (let i = 0; i < 4; i++) {
      await page.locator('.orbit-step summary').nth(i).click();
      // The first native details may close when selected again; open explicitly if needed.
      if (!(await page.locator('.orbit-step').nth(i).evaluate(e => e.open))) await page.locator('.orbit-step summary').nth(i).click();
      await page.waitForFunction(i => document.querySelector('.stack-plane.is-active')?.dataset.plane === String(i), i);
      assert.equal(await page.locator('.orbit-step[open]').count(), 1);
    }
    await page.locator('#stackToggle').click();
    const expanded = await page.locator('#stackToggle').getAttribute('aria-pressed');
    await page.locator('#stackToggle').click();
    assert.notEqual(await page.locator('#stackToggle').getAttribute('aria-pressed'), expanded);
    for (let i=0; i<3; i++) {
      const card=page.locator('.orbit-product').nth(i);
      await card.scrollIntoViewIfNeeded();await page.waitForTimeout(900);
      const box=await card.boundingBox();
      await page.locator('#inspectProduct'+i).click();await page.waitForTimeout(1050);
      const after=await card.boundingBox();assert.ok(Math.abs(box.height-after.height)<1 && Math.abs(box.y-after.y)<2,'Card turn keeps its position and size');
      assert.ok(await page.locator('#productBack'+i+' .orbit-card-link').isVisible());
      const active=await page.evaluate(()=>document.activeElement.className);assert.equal(active,'product-return');
      await page.locator('#productBack'+i+' .product-return').click();await page.waitForTimeout(1050);
      assert.equal(await page.evaluate(()=>document.activeElement.id),'inspectProduct'+i);
    }
    await page.locator('#motionToggle').click();await page.waitForTimeout(100);
    const frame=await page.evaluate(()=>document.documentElement.dataset.networkFrames);
    await page.waitForTimeout(220);
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.networkFrames),frame);
    assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0);
    await page.reload();assert.equal(await page.locator('#motionToggle').getAttribute('aria-pressed'),'true');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>document.querySelector('#motionToggle').disabled);
    assert.ok(await page.locator('#motionToggle').isDisabled());
    await shield.click();assert.equal(await shield.getAttribute('aria-expanded'),'true');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
    report.push({browser:name,width,base,result:'passed'});console.log('PASS motion smoke',name,width,base);
    await context.close();
  }
  await browser.close();
}
await writeFile(`test-results/${local?'local':'published'}-motion-report.json`,JSON.stringify(report,null,2));
