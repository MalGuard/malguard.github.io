// Serve the production build from _site, then pass its loopback HTTPS URL.
import assert from 'node:assert/strict';
import {chromium, launchOptions} from './browser-runtime.mjs';

const origin = new URL(process.argv[2] || 'https://127.0.0.1:8443').origin;
assert.equal(new URL(origin).hostname, '127.0.0.1');
const browser = await chromium.launch(launchOptions('chromium'));
try {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true, viewport: {width, height: 900},
      timezoneId: 'UTC', reducedMotion: width === 390 ? 'reduce' : 'no-preference',
    });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    for (const path of ['/game-scam-guard.html', '/gamescam-guard-android.html', '/game-scam-guard/']) {
      await page.clock.setFixedTime(new Date('2026-11-20T10:00:00Z'));
      await page.goto(origin + path);
      const toggle = page.locator('#mgThemeToggle');
      for (const [mode, theme] of [['auto', 'light'], ['light', 'light'], ['dark', 'dark']]) {
        await page.waitForFunction(([m,t]) => document.documentElement.dataset.themeMode === m && document.documentElement.dataset.theme === t, [mode, theme]);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
        if (path.endsWith('/')) {
          if (theme === 'light') {
            assert.equal(await page.locator('#root').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(250, 249, 245)');
          }
          for (const tab of await page.locator('.g-nav button').all()) {
            await tab.click();
            assert.equal(await tab.getAttribute('aria-current'), 'page');
          }
        } else {
          await page.locator('#menuBtn').click();
          assert.equal(await page.locator('#navLinks').evaluate(el => getComputedStyle(el).backgroundColor),
            theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(11, 15, 21)');
          await page.keyboard.press('Escape');
          await page.locator('#searchButton').click();
          await page.locator('#siteSearchInput').fill('GameScam');
          await page.locator('#siteSearchResults button').first().waitFor();
          await page.keyboard.press('Escape');
        }
        await toggle.click();
      }
      await page.clock.setFixedTime(new Date('2026-11-20T23:00:00Z'));
      await page.reload();
      await page.waitForFunction(() => document.documentElement.dataset.themeMode === 'auto' && document.documentElement.dataset.theme === 'dark');
      console.log('PASS theme controls and automatic day/night', width, path);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
