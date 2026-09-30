import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = process.env.TEST_BASE_URL || 'https://127.0.0.1:8443';
// The CI fixture uses an ephemeral, self-signed certificate. This exception is
// restricted to this loopback origin; production CSP and TLS remain unchanged.
assert.equal(base, 'https://127.0.0.1:8443', 'This isolated suite only targets the local HTTPS fixture');
const fixtureTLS = { ignoreHTTPSErrors: true };
const routes = ['/', '/products.html', '/tools.html', '/scan-url.html', '/gta-guard.html', '/ai-intelligence.html', '/malware-ai.html', '/malware-ai-windows.html', '/scan-mods.html', '/download.html', '/app.html', '/trust.html', '/privacy.html', '/about.html', '/founder.html', '/docs.html', '/labs.html', '/support.html', '/sandbox-help.html', '/ios-preview/', '/research/repackaged-mod.html'];
await mkdir('test-results', { recursive: true });
const report = { passed: [], failed: [], consoleErrors: [], requestFailures: [] };
let activePage;
async function check(name, work) { try { await work(); report.passed.push(name); console.log('PASS', name); } catch (e) { report.failed.push({ name, error: e.message }); console.error('FAIL', name, e.message); if(activePage && !activePage.isClosed()) await activePage.screenshot({path:'test-results/failed-'+name.replace(/[^a-zA-Z0-9]/g,'-')+'.png',fullPage:true}).catch(()=>{}); } }
async function settle(page) { await page.evaluate(() => document.fonts.ready); await page.waitForFunction(()=>document.documentElement.dataset.experienceReady==='true',null,{timeout:5000}); }
async function publicEntry(page) { await settle(page); const button = page.locator('#sitePublicEntry'); if (await button.isVisible()) await button.click(); }
for (const [name, engine, sizes] of [['chromium',chromium,[320,390,820,1440]], ['webkit',webkit,[390,820]]]) {
  const browser = await engine.launch();
  for (const width of sizes) {
    const context = await browser.newContext({ ...fixtureTLS, viewport:{ width, height: width<600?844:1000 }, reducedMotion:'reduce' });
    // All functional checks use benign inputs. External backends are blocked, not called.
    await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    const page = await context.newPage(); activePage=page;
    page.on('console',msg=>{if(msg.type()==='error')report.consoleErrors.push({browser:name,width,url:page.url(),message:msg.text()});});
    page.on('requestfailed',req=>report.requestFailures.push({browser:name,width,url:req.url(),error:req.failure()?.errorText}));
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    for (const path of routes) await check(`${name} ${width}px ${path} layout`, async () => {
      const startErrors=errors.length; const response=await page.goto(base+path); assert.equal(response.status(),200); await publicEntry(page); await settle(page);
      const state=await page.evaluate(()=>{
        const vw=document.documentElement.clientWidth;
        const outside=[...document.querySelectorAll('main a,main button,main input,main select,main textarea,header button,header a')].filter(e=>{
          const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'&&(r.left< -1||r.right>vw+1);
        }).map(e=>({id:e.id,text:(e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,70),left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}));
        const spill=[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>vw+1 && getComputedStyle(e).visibility!=='hidden').slice(0,12).map(e=>({tag:e.tagName,id:e.id,cls:e.className,right:e.getBoundingClientRect().right}));
        return {scroll:document.documentElement.scrollWidth,client:vw,outside,spill,h1:!!document.querySelector('h1')};
      });
      assert.ok(state.h1,'h1 required'); assert.ok(state.scroll<=state.client+1,JSON.stringify(state));assert.deepEqual(state.outside,[],JSON.stringify(state.outside));assert.deepEqual(errors.slice(startErrors),[],'Runtime exception');
      if (['/','/products.html','/tools.html','/gta-guard.html','/malware-ai-windows.html'].includes(path)) await page.screenshot({path:`test-results/${name}-${width}-${path==='/'?'home':path.slice(1).replace('.html','')}.png`,fullPage:true});
    });
    await check(`${name} ${width}px menu and search`, async()=>{
      await page.goto(base+'/');await publicEntry(page);
      await page.getByRole('button',{name:'Open navigation menu',exact:true}).click();
      assert.equal(await page.locator('#navLinks a').count(),18);
      const menu=await page.locator('#navLinks').boundingBox();assert.ok(menu.x>=0&&menu.x+menu.width<=width+1);
      await page.keyboard.press('Escape');assert.equal(await page.locator('#menuBtn').getAttribute('aria-expanded'),'false');
      await page.getByRole('button',{name:'Search MalGuard',exact:true}).click();
      await page.locator('#siteSearchInput').fill('<img src=x onerror=alert(1)>');
      assert.match(await page.locator('#siteSearchResults').innerText(),/No matching/);
      assert.equal(await page.locator('#siteSearchResults img').count(),0);
      assert.ok(await page.locator('main').evaluate(e=>e.inert));
      await page.locator('#siteSearchInput').fill('fingerprint');
      await page.locator('#siteSearchResults button').click();await page.waitForURL('**/tools.html');
    });
    await check(`${name} ${width}px core dialog and accordion`,async()=>{
      await page.goto(base+'/');await publicEntry(page);await page.locator('#openCore').click();assert.ok(await page.locator('#coreDialog').evaluate(e=>e.open));
      await page.keyboard.press('Escape');assert.equal(await page.locator('#coreDialog').evaluate(e=>e.open),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'openCore');
      const step=page.locator('.orbit-step').nth(1);await step.locator('summary').click();assert.ok(await step.evaluate(e=>e.open));
      assert.equal(await page.locator('#motionToggle').getAttribute('aria-pressed'),'true');
      const running=await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length);assert.equal(running,0);
    });
    await check(`${name} ${width}px URL inputs and local SHA-256`,async()=>{
      for(const path of ['/tools.html','/scan-url.html']){
        await page.goto(base+path);const button=page.locator(path==='/tools.html'?'#inspectButton':'#scanUrl');
        await button.click();assert.match(await page.locator('#urlResult').innerText(),/Paste a URL/);
        await page.locator('#urlInput').fill('https://');await button.click();assert.match(await page.locator('#urlResult').innerText(),/not a valid URL/);
        let outbound=0;const record=req=>{if(!req.url().startsWith(base))outbound++};page.on('request',record);
        await page.locator('#urlInput').fill('https://roblox.com@192.0.2.1:8080/<img>');await button.click();assert.match(await page.locator('#urlResult').innerText(),/credentials|@ symbol/);assert.match(await page.locator('#urlResult').innerText(),/IP address/i);assert.equal(await page.locator('#urlResult img').count(),0);
        await page.locator('#urlInput').fill('javascript:alert(1)');await button.click();assert.match(await page.locator('#urlResult').innerText(),/Non-web scheme/);
        const payload=Buffer.from('MalGuard benign UI regression fixture\n');await page.locator('#hashFile').setInputFiles({name:'benign-check.txt',mimeType:'text/plain',buffer:payload});
        await page.waitForFunction(()=>document.querySelector('#hashResult').textContent.includes('calculated locally')||document.querySelector('#hashResult').textContent.includes('Calculated locally'));
        assert.ok((await page.locator('#hashResult').innerText()).includes(createHash('sha256').update(payload).digest('hex')));assert.equal(outbound,0,'Local tools must not send inputs');page.off('request',record);
      }
    });
    await check(`${name} ${width}px legacy links and product boundary`,async()=>{
      await page.goto(base+'/#gta-guard');await page.waitForURL('**/gta-guard.html');
      assert.equal(await page.locator('a[href*="releases/download/gta-guard-"]').count(),0);
      await page.locator('#checkInstalledBuild').click();assert.match(await page.locator('#updateResult').innerText(),/Enter the Build/);
      await page.locator('#installedBuildInput').fill('not-a-build');await page.locator('#checkInstalledBuild').click();assert.match(await page.locator('#updateResult').innerText(),/does not look like/);
      await page.locator('#installedBuildInput').fill('bc60530');await page.locator('#checkInstalledBuild').click();assert.match(await page.locator('#updateResult').innerText(),/matches the latest published build/);
    });
    await context.close();
  }
  await check(`${name} entry gate and failed authentication`,async()=>{
    const context=await browser.newContext({...fixtureTLS,reducedMotion:'reduce'});let authCalls=0;
    await context.route('**/*',async route=>{
      if(new URL(route.request().url()).origin===new URL(base).origin)return route.continue();
      if(route.request().url().endsWith('/api/auth')){authCalls++;return route.fulfill({status:401,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:'{"error":"Access denied"}'});}return route.abort();
    });
    const page=await context.newPage();await page.goto(base+'/');assert.ok(await page.locator('#siteEntryGate').isVisible());assert.ok(await page.locator('main').evaluate(e=>e.inert));
    await page.locator('#siteAdminEntry').click();await page.locator('#siteAdminPassword').fill('benign-invalid-test-password');await page.locator('#siteAdminPasswordToggle').click();assert.equal(await page.locator('#siteAdminPassword').getAttribute('type'),'text');await page.locator('#siteAdminPasswordToggle').click();assert.equal(await page.locator('#siteAdminPassword').getAttribute('type'),'password');
    await page.locator('#siteAdminPasswordSubmit').click();await page.waitForFunction(()=>document.querySelector('#siteAdminPasswordError').textContent==='Access denied');assert.equal(authCalls,1);assert.equal(await page.locator('#siteAdminIdentityStep').isVisible(),false);
    await page.locator('#siteAdminPasswordBack').click();await publicEntry(page);assert.equal(await page.locator('main').evaluate(e=>e.inert),false);await context.close();
  });
  await check(`${name} motion preference and JavaScript-free content`,async()=>{
    const context=await browser.newContext(fixtureTLS);const page=await context.newPage();await page.goto(base+'/');await publicEntry(page);await page.locator('#motionToggle').click();assert.equal(await page.locator('#motionToggle').getAttribute('aria-pressed'),'true');await page.reload();assert.equal(await page.locator('#motionToggle').getAttribute('aria-pressed'),'true');await context.close();
    const nojs=await browser.newContext({...fixtureTLS,javaScriptEnabled:false});const p=await nojs.newPage();await p.goto(base+'/');assert.ok(await p.getByRole('heading',{name:'Play freely. Trust carefully.'}).isVisible());assert.ok(await p.getByRole('link',{name:'Explore MalGuard'}).isVisible());assert.equal(await p.locator('#siteEntryGate').isVisible(),false);await nojs.close();
  });
  await browser.close();
}
await writeFile('test-results/report.json',JSON.stringify(report,null,2));
console.log(`${report.passed.length} checks passed; ${report.failed.length} failed`);
if(report.failed.length)process.exitCode=1;
