import path from 'node:path';
import { fetchPublic } from './network.js';
import { renderCloudPreview } from './cloud-browser.js';

// A fresh browser process for each report. No site JavaScript, downloads, credentials,
// service workers or direct site connections. Every asset goes through the public-IP guard.
export async function renderPreview(url, html) {
  if (process.env.VERCEL) return renderCloudPreview(url,html);
  let browser;
  try {
    process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.resolve('.cache/browsers');
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true, timeout: 5000, chromiumSandbox: process.env.GUARD_BROWSER_SANDBOX !== 'false', args: ['--disable-background-networking', '--disable-extensions'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, javaScriptEnabled: false, acceptDownloads: false, serviceWorkers: 'block' });
    const page = await context.newPage();
    let requests = 0;
    const deadline = Date.now() + 8000;
    await context.route('**/*', async route => {
      const request = route.request();
      if (request.url() === url && request.resourceType() === 'document' && request.isNavigationRequest()) return route.fulfill({status:200,contentType:'text/html; charset=utf-8',headers:{'Content-Security-Policy':"script-src 'none'; object-src 'none'; frame-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'"},body:html});
      if (request.method() !== 'GET' || !['stylesheet','image','font'].includes(request.resourceType()) || ++requests > 18 || Date.now() > deadline) return route.abort();
      try {
        const response = await fetchPublic(request.url(), { limit: 512 * 1024, totalTimeout: 4000, timeout: 3000 });
        if (Date.now() > deadline) return route.abort();
        return await route.fulfill({ status:200, contentType:response.headers['content-type'] || 'application/octet-stream', body:response.bytes });
      } catch { return route.abort().catch(()=>{}); }
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 6000 });
    // Finish styles briefly, without waiting on unbounded third-party assets.
    await page.waitForLoadState('load', {timeout:2000}).catch(()=>{});
    const screenshot = await page.screenshot({type:'jpeg',quality:55,timeout:3000});
    return { status:'done', image:`data:image/jpeg;base64,${screenshot.toString('base64')}`, detail:'پیش‌نمایش مرورگر سرور؛ جاوااسکریپت و دانلود خودکار غیرفعال هستند.' };
  } catch {
    return { status:'unavailable', detail:'پیش‌نمایش مرورگر در این بررسی در دسترس نبود؛ شواهد HTML در گزارش آمده است.' };
  } finally { if (browser) await browser.close().catch(()=>{}); }
}
