import assert from 'node:assert/strict';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { chromium, launchOptions } from './browser-runtime.mjs';

const origin = 'https://127.0.0.1:8443';
const persianGuide = '/research/gta-mod-security-fa.html';
const output = 'test-results/ui-review';
const viewports = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];
const themes = ['dark', 'light'];
const results = [];
const failures = [];

await mkdir(output, { recursive: true });
const browser = await chromium.launch(launchOptions('chromium'));

try {
  for (const viewport of viewports) {
    for (const theme of themes) {
      const context = await browser.newContext({
        viewport,
        colorScheme: theme,
        reducedMotion: 'reduce',
        ignoreHTTPSErrors: true,
        serviceWorkers: 'block',
      });
      try {
        await context.addInitScript((mode) => localStorage.setItem('malguard-theme', mode), theme);
        await context.route('**/*', (route) => (
          new URL(route.request().url()).origin === origin ? route.continue() : route.abort()
        ));

        for (const path of ['/', persianGuide]) {
          const label = `${viewport.width}×${viewport.height} ${theme} ${path}`;
          const result = { viewport, theme, path, pageErrors: [], localHttpErrors: [] };
          results.push(result);
          const page = await context.newPage();
          page.on('pageerror', (error) => result.pageErrors.push(error.message));
          page.on('response', (response) => {
            const url = new URL(response.url());
            if (url.origin === origin && response.status() >= 400) {
              result.localHttpErrors.push(`${response.status()} ${url.pathname}`);
            }
          });

          try {
            const response = await page.goto(origin + path, { waitUntil: 'load', timeout: 30000 });
            assert.equal(response?.status(), 200, 'Expected the site route to load successfully');
            await page.locator('main h1').first().waitFor({ state: 'visible', timeout: 10000 });
            await page.waitForFunction((mode) => (
              document.documentElement.dataset.theme === mode &&
              getComputedStyle(document.documentElement).colorScheme === mode &&
              Boolean(document.getElementById('mg-theme-css')?.sheet)
            ), theme, { timeout: 10000 });
            await page.evaluate(() => document.fonts.ready.then(() => true));

            if (path === '/') {
              const filename = `home-default-${viewport.width}x${viewport.height}-${theme}-round-1.png`;
              await page.screenshot({ path: `${output}/${filename}`, animations: 'disabled', timeout: 15000 });
              result.screenshot = filename;
            }

            result.layout = await page.locator('main h1').first().evaluate((heading) => {
              const root = document.documentElement;
              const scroller = document.scrollingElement;
              const style = getComputedStyle(heading);
              const main = heading.closest('main');
              const original = scroller.scrollLeft;
              // Test both ends because RTL scroll offsets can be negative.
              scroller.scrollLeft = root.scrollWidth + root.clientWidth;
              const rightScroll = scroller.scrollLeft;
              scroller.scrollLeft = -root.scrollWidth - root.clientWidth;
              const leftScroll = scroller.scrollLeft;
              scroller.scrollLeft = original;
              return {
                lang: root.lang,
                dir: root.dir,
                heading: heading.textContent.trim(),
                headingDirection: style.direction,
                headingAlign: style.textAlign,
                mainDirection: getComputedStyle(main).direction,
                colorScheme: getComputedStyle(root).colorScheme,
                headingColor: style.color,
                clientWidth: root.clientWidth,
                scrollWidth: scroller.scrollWidth,
                leftScroll,
                rightScroll,
              };
            });

            const { layout } = result;
            const checks = {
              theme: layout.colorScheme === theme,
              horizontalOverflow: layout.scrollWidth <= layout.clientWidth + 1 &&
                Math.abs(layout.leftScroll) <= 1 && Math.abs(layout.rightScroll) <= 1,
              languageAndDirection: path === persianGuide
                ? layout.lang === 'fa' && layout.dir === 'rtl' &&
                  layout.mainDirection === 'rtl' && layout.headingDirection === 'rtl' &&
                  ['start', 'right'].includes(layout.headingAlign) && /[\u0600-\u06ff]/u.test(layout.heading)
                : layout.lang === 'en' && layout.dir === 'ltr',
              pageErrors: result.pageErrors.length === 0,
            };
            result.checks = checks;
            for (const [check, passed] of Object.entries(checks)) {
              if (!passed) failures.push(`${label}: ${check}`);
            }
          } catch (error) {
            result.error = error.message;
            failures.push(`${label}: ${error.message}`);
          } finally {
            await page.close();
          }
        }
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}

const count = results.filter((result) => result.screenshot).length;
if (count !== 6) failures.push(`Expected 6 screenshots, got ${count}`);
await writeFile(`${output}/checks.json`, JSON.stringify({ screenshots: count, failures, results }, null, 2) + '\n');

const summary = [
  '## UI review',
  '',
  `Captured **${count}/6** homepage PNGs. Persian RTL and horizontal overflow details are in \`checks.json\`.`,
  '',
  ...(failures.length ? failures.map((failure) => `- ${failure.split('\n')[0]}`) : ['All layout checks passed.']),
  '',
].join('\n');
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(summary);
if (failures.length) process.exitCode = 1;
