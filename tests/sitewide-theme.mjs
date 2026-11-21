// Run against the production artifact served by tests/serve-https.py from _site.
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {chromium,launchOptions} from './browser-runtime.mjs';

const origin = new URL(process.argv[2] || 'https://127.0.0.1:8443').origin;
async function pages(dir) {
  const files = [];
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    const path = join(dir,entry.name);
    if (entry.isDirectory()) files.push(...await pages(path));
    else if (entry.name.endsWith('.html')) files.push(path);
  }
  return files;
}
const paths = [];
for (const file of await pages('_site')) {
  const path = '/' + relative('_site',file);
  // Redirects have no interface. Code preview is a sandbox for user-authored output.
  if (path === '/code-preview/index.html' || /http-equiv=["']refresh/i.test(await readFile(file,'utf8'))) continue;
  paths.push(path);
}
const browser = await chromium.launch(launchOptions('chromium'));
const failures = [];
try {
  for (const width of [390,1280]) {
    const remaining = [...paths];
    await Promise.all(Array.from({length:3},async () => {
      const context = await browser.newContext({viewport:{width,height:850},ignoreHTTPSErrors:true,
        reducedMotion:'reduce',timezoneId:'UTC',serviceWorkers:'block'});
      await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
      const page = await context.newPage();
      page.setDefaultTimeout(4500);
      await page.clock.setFixedTime(new Date('2026-11-20T10:00:00Z'));
      while (remaining.length) {
        const path = remaining.pop();
        try {
          assert.equal((await page.goto(origin+path,{waitUntil:'load'})).status(),200);
          const toggle=page.locator('#mgThemeToggle');
          await toggle.waitFor({state:'attached'});
          for (const [mode,theme] of [['auto','light'],['light','light'],['dark','dark']]) {
            await page.waitForFunction(([m,t])=>document.documentElement.dataset.themeMode===m &&
              document.documentElement.dataset.theme===t,[mode,theme]);
            const expectedCanvas = theme === 'light' ? '#faf9f5' : '#0e0e0f';
            await page.waitForFunction(expected =>
              getComputedStyle(document.documentElement).getPropertyValue('--site-canvas').trim() === expected,
              expectedCanvas);
            await toggle.click();
          }
        } catch (error) {
          failures.push([width,path,error.message.slice(0,400)]);
          await page.evaluate(()=>localStorage.removeItem('malguard-theme')).catch(()=>{});
        }
      }
      await context.close();
    }));
    console.log('Checked',paths.length,'pages at',width,'pixels');
  }
  assert.deepEqual(failures,[]);
} finally { await browser.close(); }
