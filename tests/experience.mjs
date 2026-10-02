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
      assert.equal(await page.evaluate(()=>document.fonts.check('16px "Manrope"')),true,'Shared body font loaded');
      assert.equal(await page.evaluate(()=>document.fonts.check('16px "Space Grotesk"')),true,'Shared heading font loaded');
      const state=await page.evaluate(()=>{
        const vw=document.documentElement.clientWidth;
        const outside=[...document.querySelectorAll('main a,main button,main input,main select,main textarea,header button,header a')].filter(e=>{
          const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'&&(r.left< -1||r.right>vw+1);
        }).map(e=>({id:e.id,text:(e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,70),left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}));
        const spill=[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>vw+1 && getComputedStyle(e).visibility!=='hidden').slice(0,12).map(e=>({tag:e.tagName,id:e.id,cls:e.className,right:e.getBoundingClientRect().right}));
        return {scroll:document.documentElement.scrollWidth,client:vw,outside,spill,h1:!!document.querySelector('h1')};
      });
      assert.ok(state.h1,'h1 required'); assert.ok(state.scroll<=state.client+1,JSON.stringify(state));assert.deepEqual(state.outside,[],JSON.stringify(state.outside));assert.deepEqual(errors.slice(startErrors),[],'Runtime exception');
      if (['/','/products.html','/tools.html','/gta-guard.html','/malware-ai-windows.html'].includes(path)) await page.screenshot({path:`test-results/${name}-${width}-${path==='/'?'home':path.slice(1).replace('.html','')}.png`,fullPage:path!=='/'});
    });
    await check(`${name} ${width}px substantive homepage copy is preserved`,async()=>{
      await page.goto(base+'/');await publicEntry(page);
      const expected=JSON.parse(await (await import('node:fs/promises')).readFile('tests/homepage-copy.json','utf8'));
      const text=(await page.locator('body').textContent()).replace(/\s+/g,' ').trim();
      for(const paragraph of expected)assert.ok(text.includes(paragraph),'Missing original copy: '+paragraph);
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
    await check(`${name} ${width}px space flight shield and reduced motion`,async()=>{
      await page.goto(base+'/');await publicEntry(page);
      await page.waitForFunction(()=>document.documentElement.dataset.spaceReady==='true');
      assert.equal(await page.locator('[data-space-dot]').count(),7);
      const shield=page.locator('#openCore');
      await shield.click();
      assert.equal(await shield.getAttribute('aria-expanded'),'true');
      assert.equal(await page.locator('#coreDetails').getAttribute('aria-hidden'),'false');
      await page.keyboard.press('Escape');
      assert.equal(await shield.getAttribute('aria-expanded'),'false');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'openCore');
      await page.locator('[data-space-dot="2"]').click();
      await page.waitForFunction(()=>document.documentElement.dataset.spaceStation==='2');
      assert.ok(await page.locator('[data-space-station="2"]').isVisible());
      assert.equal(await page.locator('#motionToggle').getAttribute('aria-pressed'),'true');
      assert.ok(await page.locator('#motionToggle').isDisabled());
      const running=await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length);
      assert.equal(running,0);
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


    await check(`${name} ${width}px spatial product inspection and developer example`,async()=>{
      await page.goto(base+'/');await publicEntry(page);
      await page.waitForFunction(()=>document.documentElement.dataset.spaceReady==='true');
      assert.equal(await page.locator('#studioDevice').count(),0,'Unwanted computer is removed');
      for(let i=0;i<3;i++){
        const station=i+3;
        await page.locator(`[data-space-dot="${station}"]`).click();
        await page.waitForFunction(n=>document.documentElement.dataset.spaceStation===String(n),station);
        const button=page.locator('#inspectProduct'+i);
        await button.focus();await page.keyboard.press('Enter');
        assert.equal(await button.getAttribute('aria-expanded'),'true');
        assert.equal(await page.locator('#productBack'+i+' h3').innerText(),['GTA Guard','Malware AI','Game Scam Guard'][i]);
        assert.ok(await page.locator('#productBack'+i+' .orbit-card-link').isVisible());
        const box=await page.locator('#productBack'+i).boundingBox();
        assert.ok(box.x>=0&&box.x+box.width<=width+1);
        await page.screenshot({path:`test-results/${name}-${width}-product-${i}.png`});
        await page.keyboard.press('Escape');
        assert.equal(await button.getAttribute('aria-expanded'),'false');
        assert.equal(await page.evaluate(()=>document.activeElement.id),'inspectProduct'+i);
      }
      await page.locator('[data-space-dot="3"]').click();
      await page.waitForFunction(()=>document.documentElement.dataset.spaceStation==='3');
      await page.locator('#inspectProduct0').click();await page.locator('#productBack0 .product-return').click();
      await page.locator('[data-space-dot="4"]').click();
      await page.waitForFunction(()=>document.documentElement.dataset.spaceStation==='4');
      await page.locator('#inspectProduct1').click();await page.locator('#productBack1 .orbit-card-link').click();await page.waitForURL('**/ai-intelligence.html');
      await page.goto(base+'/');await publicEntry(page);
      await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copiedStudio=text;}}}));
      await page.locator('#studioCopyCode').click();
      await page.waitForFunction(()=>document.querySelector('#studioCopyStatus').textContent==='Example copied');
      assert.equal(await page.evaluate(()=>window.__copiedStudio),await page.locator('#studioCode').textContent());
      await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied');}}}));
      await page.locator('#studioCopyCode').click();
      await page.waitForFunction(()=>document.querySelector('#studioCopyStatus').textContent.includes('highlighted example'));
      assert.ok((await page.evaluate(()=>window.getSelection().toString())).includes('local-first'));
      assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0);
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

  await check(`${name} normal-motion flight, reversals and pause`,async()=>{
    const context=await browser.newContext({...fixtureTLS,viewport:{width:1280,height:850},reducedMotion:'no-preference'});
    await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
    const page=await context.newPage();activePage=page;await page.goto(base+'/');await publicEntry(page);
    await page.waitForFunction(()=>document.documentElement.dataset.spaceReady==='true');
    const frameCount=()=>page.evaluate(()=>Number(document.documentElement.dataset.spaceFrames||0));
    const before=await frameCount();
    await page.locator('[data-space-dot="2"]').click();
    await page.waitForTimeout(220);
    assert.ok(await frameCount()>before,'Camera flight must render while moving');
    await page.locator('[data-space-dot="0"]').click();
    await page.waitForFunction(()=>document.documentElement.dataset.spaceStation==='0');
    const shield=page.locator('#openCore');
    await shield.click();
    assert.equal(await shield.getAttribute('aria-expanded'),'true');
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.spaceShield),'open');
    await page.keyboard.press('Escape');
    assert.equal(await shield.getAttribute('aria-expanded'),'false');
    await page.locator('[data-space-dot="3"]').click();
    await page.waitForFunction(()=>document.documentElement.dataset.spaceStation==='3');
    const card=page.locator('[data-space-station="3"]');
    const box=await card.boundingBox();
    await page.locator('#inspectProduct0').click();await page.waitForTimeout(430);
    assert.equal(await page.locator('#inspectProduct0').getAttribute('aria-expanded'),'true');
    const after=await card.boundingBox();
    assert.ok(Math.abs(box.height-after.height)<1,'Turning a card must not move the layout');
    assert.equal(await page.locator('.space-product-card .product-front').first().evaluate(e=>e.inert),true);
    await page.keyboard.press('Escape');await page.waitForTimeout(430);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'inspectProduct0');
    for(let cycle=0;cycle<3;cycle++){
      await page.locator('#inspectProduct0').click();await page.waitForTimeout(60);await page.keyboard.press('Escape');await page.waitForTimeout(430);
      assert.equal(await page.locator('#inspectProduct0').getAttribute('aria-expanded'),'false');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'inspectProduct0');
    }
    await page.locator('#motionToggle').click();await page.waitForTimeout(120);
    const stopped=await frameCount();await page.waitForTimeout(260);assert.equal(await frameCount(),stopped);
    assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0);
    await page.locator('[data-space-dot="0"]').click();await page.waitForFunction(()=>document.documentElement.dataset.spaceStation==='0');
    await page.locator('#openCore').click();assert.equal(await shield.getAttribute('aria-expanded'),'true','Paused motion keeps controls usable');
    await context.close();
  });
  await browser.close();
}
await writeFile('test-results/report.json',JSON.stringify(report,null,2));
console.log(`${report.passed.length} checks passed; ${report.failed.length} failed`);
if(report.failed.length)process.exitCode=1;
