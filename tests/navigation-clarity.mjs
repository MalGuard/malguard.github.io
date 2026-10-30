import assert from 'node:assert/strict';
import { chromium, launchOptions } from './browser-runtime.mjs';

const browser = await chromium.launch(launchOptions('chromium'));
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:8790';
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 850 }, reducedMotion: 'reduce' });
    await page.goto(`${base}/products.html`);
    await page.waitForFunction(() => document.querySelector('#navbar')?.dataset.navigationReady === 'true');
    await page.locator('#menuBtn').click();
    const menu = page.locator('#navLinks');
    assert.equal(await menu.isVisible(), true);
    assert.deepEqual(await menu.locator('.mg-menu-label').allTextContents(), ['START HERE', 'TOOLS AND GUIDES', 'HELP AND PROJECT']);
    for (const path of ['/','/products.html','/ai/','/gta-guard.html','/game-scam-guard.html','/tools.html','/gta6-security.html','/docs.html','/labs.html','/support.html','/report.html','/trust.html','/about.html']) {
      assert.equal(await menu.locator(`a[href="${path}"]`).count(), 1, `${path} should be available once`);
    }
    await page.keyboard.press('Escape');
    assert.equal(await menu.isVisible(), false);
    assert.equal(await page.locator('#menuBtn').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'menuBtn');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page must not overflow');
    await page.close();
  }
  console.log('PASS navigation groups, preserved links, keyboard close and responsive width');
} finally {
  await browser.close();
}
