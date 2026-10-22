import assert from 'node:assert/strict';
import { chromium, webkit,launchOptions } from './browser-runtime.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = process.env.TEST_BASE_URL || 'https://127.0.0.1:8443';
// The CI fixture uses an ephemeral, self-signed certificate. This exception is
// restricted to this loopback origin; production CSP and TLS remain unchanged.
assert.equal(base, 'https://127.0.0.1:8443', 'This isolated suite only targets the local HTTPS fixture');
const fixtureTLS = { ignoreHTTPSErrors: true };
const routes = ['/', '/products.html', '/tools.html', '/scan-url.html', '/gta-guard.html', '/threat-radar.html', '/ai-intelligence.html', '/malware-ai.html', '/malware-ai-windows.html', '/scan-mods.html', '/download.html', '/app.html', '/trust.html', '/privacy.html', '/about.html', '/founder.html', '/docs.html', '/labs.html', '/support.html', '/sandbox-help.html', '/ios-preview/', '/research/repackaged-mod.html','/game-scam-guard.html','/research/security-motion.html','/release/sandbox-help-historical.html','/404.html'];
await mkdir('test-results', { recursive: true });
const report = { passed: [], failed: [], consoleErrors: [], requestFailures: [] };
let activePage;
async function check(name, work) { try { await work(); report.passed.push(name); console.log('PASS', name); } catch (e) { report.failed.push({ name, error: e.message }); console.error('FAIL', name, e.message); if(activePage && !activePage.isClosed()) await activePage.screenshot({path:'test-results/failed-'+name.replace(/[^a-zA-Z0-9]/g,'-')+'.png',fullPage:true}).catch(()=>{}); } }
async function settle(page) { await page.waitForFunction(()=>document.documentElement.dataset.experienceReady==='true'||(location.pathname==='/'&&document.documentElement.dataset.precisionTypeReady==='true'),null,{timeout:7500});await page.evaluate(async()=>{await new Promise(requestAnimationFrame);const h=document.querySelector('main h1')||document.querySelector('h1');if(h)await document.fonts.load(getComputedStyle(h).font);await document.fonts.ready;}); }
async function publicEntry(page) { await settle(page); const button = page.locator('#sitePublicEntry'); if (await button.isVisible()) await button.click(); }
const browserMatrix = [['chromium',chromium,[320,390,820,1440]], ['webkit',webkit,[390,820]]];
const selectedBrowser = process.env.TEST_BROWSER;
if(selectedBrowser)assert.ok(['chromium','webkit'].includes(selectedBrowser),'Unknown requested browser');
for (const [name, engine, sizes] of browserMatrix.filter(([name])=>!selectedBrowser||name===selectedBrowser)) {
  const browser = await engine.launch(launchOptions(name));
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
      if(path!=='/')assert.equal(await page.evaluate(()=>document.fonts.check('16px "Inter"')),true,'Shared body font loaded');
      assert.equal(await page.evaluate(()=>document.fonts.check(getComputedStyle(document.querySelector('main h1')||document.querySelector('h1')).font)),true,'Actual heading font loaded');
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
    await check(`${name} ${width}px substantive homepage copy is preserved`,async()=>{
      await page.goto(base+'/');await publicEntry(page);
      const expected=JSON.parse(await (await import('node:fs/promises')).readFile('tests/homepage-copy.json','utf8'));
      const text=(await page.locator('body').textContent()).replace(/\s+/g,' ').trim();
      for(const paragraph of expected)assert.ok(text.includes(paragraph),'Missing original copy: '+paragraph);
    });
    await check(`${name} ${width}px accessible Precision nav, four stages and no-WebGL view`,async()=>{
      await page.goto(base+'/');await publicEntry(page);
      await page.waitForFunction(()=>document.querySelector('#navbar')?.dataset.navigationReady==='true');
      assert.equal(await page.locator('#navbar .mg-primary-links a').count(),5);
      assert.equal(await page.locator('#navbar .nav-download').getAttribute('href'),'/download.html');
      const button=page.locator('#menuBtn'),menu=page.locator('#navLinks');
      await button.click();assert.equal(await button.getAttribute('aria-expanded'),'true');
      const box=await menu.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);
      await page.keyboard.press('Escape');assert.equal(await button.getAttribute('aria-expanded'),'false');
      await page.locator('#searchButton').click();
      assert.equal(await page.locator('#siteSearch').isVisible(),true);
      await page.keyboard.press('Escape');assert.equal(await page.locator('#siteSearch').isVisible(),false);
      await page.waitForFunction(()=>document.querySelector('.flow-stage')?.dataset.renderer==='vector');
      assert.equal(await page.locator('.flow-stage svg text').filter({hasText:'undefined'}).count(),0);
      assert.equal(await page.locator('.flow-stage canvas').isVisible(),false);
      for(const step of ['Identify','Inspect','Analyze','Decide'])assert.ok((await page.locator('#technology h3').allTextContents()).some(t=>t.trim()===step));
      assert.ok((await page.locator('.metric-clarification').innerText()).includes('not verified'));
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
      await page.goto(base+'/gta-guard.html');
      assert.equal(await page.locator('a[href*="releases/download/gta-guard-"]').count(),0);
      assert.ok((await page.locator('#method').innerText()).includes('IDENTIFY'));
      await page.getByRole('link',{name:'Check your installed build',exact:true}).click();
      await page.waitForURL('**/download.html#updates');
      assert.equal(await page.locator('#buildInput').count(),1);
      assert.equal(await page.locator('input[type=password]').count(),0);
      assert.equal(await page.locator('#downloadPassword').count(),0);
      await page.waitForFunction(()=>!document.getElementById('downloadButton').disabled);
      assert.match(await page.locator('#downloadHelp').innerText(),/require no password/);
      assert.equal(await page.locator('#downloadForm').count(),1);
      assert.equal(await page.locator('a[href$=".7z"]').count(),0);
      assert.ok((await page.locator('#troubleshooting').textContent()).includes('Do not disable protection'));
    });


    await check(`${name} ${width}px accessible product links and lightweight cards`,async()=>{
      await page.goto(base+'/');await publicEntry(page);
      const links=page.locator('#products article.product a.text-link');
      assert.deepEqual(await links.evaluateAll(a=>a.map(x=>new URL(x.href).pathname)),['/gta-guard.html','/game-scam-guard.html','/threat-radar.html']);
      assert.equal(await page.locator('#products canvas').count(),0);
      for(const link of await links.all()){await link.focus();assert.equal(await link.evaluate(el=>document.activeElement===el),true);}
    });
    await context.close();
  }
  await check(`${name} entry gate and failed authentication`,async()=>{
    const context=await browser.newContext({...fixtureTLS,reducedMotion:'reduce'});let authCalls=0;
    await context.route('**/*',async route=>{
      if(new URL(route.request().url()).origin===new URL(base).origin)return route.continue();
      if(route.request().url().endsWith('/api/auth')){authCalls++;return route.fulfill({status:401,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:'{"error":"Access denied"}'});}return route.abort();
    });
    const page=await context.newPage();await page.goto(base+'/');await settle(page);assert.equal(await page.locator('#siteEntryGate').isVisible(),false);assert.equal(await page.locator('a[href*="admin-access"]').count(),0);assert.equal(await page.locator('#adminSessionBadge').isVisible(),false);
    assert.equal(await page.getByText('Administrator access',{exact:true}).count(),0);
    await page.goto(base+'/console-8d42b69fda13705cc47a.html');await settle(page);assert.ok(await page.locator('#siteEntryGate').isVisible());assert.ok(await page.locator('#navbar').evaluate(e=>e.inert));
    await page.locator('#siteAdminPassword').fill('benign-invalid-test-password');await page.locator('#siteAdminPasswordToggle').click();assert.equal(await page.locator('#siteAdminPassword').getAttribute('type'),'text');await page.locator('#siteAdminPasswordToggle').click();assert.equal(await page.locator('#siteAdminPassword').getAttribute('type'),'password');
    await page.locator('#siteAdminPasswordSubmit').click();await page.waitForFunction(()=>document.querySelector('#siteAdminPasswordError').textContent==='Access denied');assert.equal(authCalls,1);assert.equal(await page.locator('#siteAdminIdentityStep').isVisible(),false);
    await page.locator('#siteAdminPasswordBack').click();await page.locator('#sitePublicEntry').click();await page.waitForURL(base+'/');await settle(page);assert.equal(await page.locator('main').evaluate(e=>e.inert),false);await context.close();
  });
  await check(`${name} private administrator session indicator and retired AI product`,async()=>{
    const context=await browser.newContext({...fixtureTLS,reducedMotion:'reduce'});
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin===new URL(base).origin)return route.continue();
      if(url.pathname==='/api/auth'){
        const cors={'access-control-allow-origin':'*','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type'};
        if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
        const request=JSON.parse(route.request().postData()||'{}');
        const body=request.phase==='enter'?{emailConfigured:true,emailSent:true,sessionToken:'test-admin-session',sessionExpiresAt:Date.now()+3600000}:{ok:true};
        return route.fulfill({status:200,headers:cors,contentType:'application/json',body:JSON.stringify(body)});
      }
      return route.abort();
    });
    const page=await context.newPage();await page.goto(base+'/console-8d42b69fda13705cc47a.html');await settle(page);
    await page.locator('#siteAdminPassword').fill('benign-success-test-password');await page.locator('#siteAdminPasswordSubmit').click();
    await page.locator('#siteAdminName').fill('MalGuard Owner');await page.locator('#siteAdminPhone').fill('+1 202 555 0148');await page.locator('#siteAdminConsent').check();await page.locator('#siteAdminEnter').click();
    await page.waitForURL(base+'/');
    assert.equal(await page.locator('#navbar').count(),1);
     assert.equal(await page.locator('main').evaluate(el=>el.inert),false);
     assert.equal(await page.locator('#siteAdminPassword').count(),0);
     await page.goto(base+'/malware-ai-windows.html');await settle(page);
    assert.equal(await page.getByRole('heading',{name:'Now replaced by Threat Radar.'}).count(),1);
    assert.equal(await page.locator('#accessGate').count(),0,'Retired chat must not expose authentication or messaging');
    await context.close();
  });
  await check(`${name} Threat Radar degrades safely when external data is unavailable`,async()=>{
    const context=await browser.newContext({...fixtureTLS,reducedMotion:'reduce'});
    await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
    const page=await context.newPage();
    await page.goto(base+'/threat-radar.html');await settle(page);
    await page.waitForFunction(()=>document.querySelector('#radarStatus').textContent.includes('Public advisory data is unavailable'));
    assert.equal(await page.locator('.radar-item').count(),0);
    assert.equal(await page.locator('#radarCount').textContent(),'—');
    await context.close();
  });
  await check(`${name} Threat Radar sanitizes reviewed source records`,async()=>{
    const context=await browser.newContext({...fixtureTLS,reducedMotion:'reduce'});
    const valid={type:'reviewed',ghsa_id:'GHSA-aaaa-bbbb-cccc',cve_id:'CVE-2026-12345',summary:'<img src=x onerror=alert(1)> harmless markup test',severity:'high',published_at:'2026-10-01T00:00:00Z'};
    const fake={...valid,type:'unreviewed',ghsa_id:'GHSA-zzzz-yyyy-xxxx',summary:'Do not show this'};
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.origin===new URL(base).origin)return route.continue();
      if(url.hostname==='api.github.com'&&url.pathname==='/advisories')return route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify([valid,fake])});
      return route.abort();
    });
    const page=await context.newPage();await page.goto(base+'/threat-radar.html');await settle(page);
    await page.waitForFunction(()=>document.querySelectorAll('.radar-item').length===1);
    assert.equal(await page.locator('.radar-item img').count(),0,'Advisory content must not become HTML');
    assert.ok((await page.locator('.radar-item h3').textContent()).includes('<img src=x onerror'));
    assert.equal(await page.locator('#radarCount').textContent(),'1');
    assert.equal(await page.locator('.radar-item a').getAttribute('href'),'https://github.com/advisories/GHSA-aaaa-bbbb-cccc');
    await page.locator('#radarSeverity').selectOption('critical');assert.equal(await page.locator('.radar-item').count(),0);
    await page.locator('#radarSeverity').selectOption('high');assert.equal(await page.locator('.radar-item').count(),1);
    await context.close();
  });
  await check(`${name} Threat Radar preserves existing brand fonts and colors`,async()=>{
    const context=await browser.newContext({...fixtureTLS,reducedMotion:'reduce'});
    await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
    const page=await context.newPage();
    await page.goto(base+'/products.html');await settle(page);
    const original=await page.evaluate(()=>({
      body:getComputedStyle(document.body).backgroundColor,
      heading:getComputedStyle(document.querySelector('.product-hero h1')).fontFamily,
      accent:getComputedStyle(document.documentElement).getPropertyValue('--mg-accent').trim()
    }));
    await page.goto(base+'/threat-radar.html');await settle(page);
    const radar=await page.evaluate(()=>({
      body:getComputedStyle(document.body).backgroundColor,
      heading:getComputedStyle(document.querySelector('.radar-hero h1')).fontFamily,
      accent:getComputedStyle(document.documentElement).getPropertyValue('--mg-accent').trim()
    }));
    assert.deepEqual(radar,original,'Radar must inherit the exact existing MalGuard background, heading font and brand accent');
    await context.close();
  });
  await check(`${name} reduced motion and JS-free copy remain visible`,async()=>{
     const c=await browser.newContext({...fixtureTLS,reducedMotion:'reduce'}),p=await c.newPage();
     await p.goto(base+'/');await settle(p);
     await p.waitForFunction(()=>document.querySelector('.flow-stage')?.dataset.renderer==='vector');
     assert.equal(await p.locator('.motion-toggle').isVisible(),false);
     assert.equal(await p.locator('.flow-stage svg text').filter({hasText:'undefined'}).count(),0);
     await c.close();
     const nojs=await browser.newContext({...fixtureTLS,javaScriptEnabled:false}),q=await nojs.newPage();await q.goto(base+'/');
     assert.ok(await q.getByRole('heading',{name:'Scan smart. Play safe.'}).isVisible());
     assert.ok(await q.getByRole('link',{name:'Explore products'}).isVisible());await nojs.close();
   });
   await check(`${name} viewport typing is sequential and scroll-triggered`,async()=>{
     const c=await browser.newContext({...fixtureTLS,viewport:{width:1280,height:850},reducedMotion:'no-preference'}),p=await c.newPage();
     await c.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
     await p.goto(base+'/');await settle(p);
     const title=p.locator('#technology [data-type]').first();assert.equal(await title.getAttribute('data-type-state'),'pending');
     await title.evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));
     await p.waitForFunction(()=>['typing','complete'].includes(document.querySelector('#technology [data-type]')?.dataset.typeState),null,{timeout:30000});
     assert.equal(await p.locator('#products article.product').count(),3);await c.close();
   });
   await browser.close();
}
await writeFile('test-results/report'+(selectedBrowser?'-'+selectedBrowser:'')+'.json',JSON.stringify(report,null,2));
console.log(`${report.passed.length} checks passed; ${report.failed.length} failed`);
if(report.failed.length)process.exitCode=1;
