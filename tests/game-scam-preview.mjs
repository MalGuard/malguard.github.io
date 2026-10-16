// Owned secure-context loopback HTTP, benign JSON and public Example Domain only.
// This verifies the integration; it never requests cloud specimen execution.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import express from 'express';
process.env.PLAYWRIGHT_BROWSERS_PATH||=path.resolve('/workspace/.cache/browsers');
const require=createRequire(import.meta.url);
const {chromium,webkit}=require(process.env.MALGUARD_QA_PLAYWRIGHT||'playwright');
const handler=require('../api/game-scam-guard.js');
const app=express();const root=path.resolve('_site');
app.use('/api/game-scam-guard',(req,res)=>{const endpoint=req.path.slice(1);Object.defineProperty(req,'query',{value:{endpoint},configurable:true});handler(req,res).catch(error=>{console.error(error.name);if(!res.headersSent)res.status(500).json({error:'Integration failed'});else res.end();});});
app.use(express.static(root));const server=http.createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;const result={passed:[],cloudExecutionRequested:false};
await mkdir('test-results',{recursive:true});
try{
 for(const [name,engine]of [['chromium',chromium],['webkit',webkit]].filter(([browser])=>!process.env.TEST_BROWSER||browser===process.env.TEST_BROWSER)){
  const browser=await engine.launch(name==='chromium'?{args:['--no-sandbox']}:{});
  try{
   const context=await browser.newContext({viewport:{width:820,height:1080},reducedMotion:'reduce'});await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==base)return route.abort();if(url.pathname==='/api/game-scam-guard/auth/status')return route.fulfill({contentType:'application/json',body:JSON.stringify({provider:'first-party-email',configured:true,hasApiKey:true,hasFromEmail:true})});if(url.pathname==='/api/game-scam-guard/auth/start')return route.fulfill({contentType:'application/json',body:JSON.stringify({verificationToken:'fixture-email-code-ticket'})});return route.continue();});
   const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(base+'/game-scam-guard.html');assert.equal(await page.locator('#gameScamPreview').getAttribute('href'),'/game-scam-guard/');
   await page.goto(base+'/game-scam-guard/');assert.equal(await page.locator('html').getAttribute('lang'),'en');assert.equal(await page.locator('html').getAttribute('dir'),'ltr');
   await page.getByRole('button',{name:'Sign in or manage account'}).click();await page.getByRole('heading',{name:'Create your account'}).waitFor();await page.getByLabel('Username').fill('Persian Gamer');await page.getByLabel('Email address').fill('player@example.com');await page.getByRole('button',{name:'Continue'}).click();await page.getByRole('heading',{name:'Enter your code'}).waitFor();await page.getByRole('button',{name:'Close'}).click();
   await page.getByRole('button',{name:'Change language'}).click();await page.waitForFunction(()=>document.documentElement.lang==='fa');assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
   await page.getByRole('button',{name:'تغییر زبان'}).click();await page.waitForFunction(()=>document.documentElement.lang==='en');
   await page.evaluate(()=>localStorage.setItem('guard-locale','fa'));await page.reload();await page.getByLabel('لینک وب‌سایت').waitFor();
   const health=await context.request.get(base+'/api/game-scam-guard/health');assert.equal(health.status(),200);assert.equal((await health.json()).status,'ok');
   const unknown=await context.request.get(base+'/api/game-scam-guard/unknown');assert.equal(unknown.status(),404);
   const cross=await context.request.post(base+'/api/game-scam-guard/scan',{headers:{Origin:'https://foreign.test'},data:{url:'https://example.com'}});assert.equal(cross.status(),403);
   await page.getByLabel('لینک وب‌سایت').fill('http://169.254.169.254/');await page.getByRole('button',{name:'شروع بررسی',exact:true}).click();await page.getByRole('alert').filter({hasText:'خصوصی'}).waitFor();
   await page.getByLabel('لینک وب‌سایت').fill('https://example.com');const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/game-scam-guard/scan');await page.getByRole('button',{name:'شروع بررسی',exact:true}).click();const scan=await response;assert.equal(scan.status(),200);const report=await scan.json();assert.equal(report.title,'Example Domain');assert.match(report.siteAnalysis.htmlSha256,/^[a-f0-9]{64}$/);
   await page.getByText('تحلیل مستقل محتوای HTML',{exact:true}).waitFor();const content=Buffer.from('{"fixture":"authored harmless integration JSON"}');await page.getByLabel('فایل برای تحلیل').setInputFiles({name:'benign.json',mimeType:'application/json',buffer:content});assert.equal(await page.locator('#upload-execution-consent').isChecked(),false);await page.getByRole('button',{name:/آپلود و بررسی با رضایت من/}).click();await page.getByRole('heading',{name:'benign.json',exact:true}).waitFor();assert.equal(await page.locator('.hash-row code').innerText(),'SHA-256: '+createHash('sha256').update(content).digest('hex'));
   for(const [size,viewport]of [['desktop',{width:1440,height:1100}],['mobile',{width:390,height:844}],['ipad-portrait',{width:820,height:1080}],['ipad-landscape',{width:1080,height:820}]]){await page.setViewportSize(viewport);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`test-results/game-scam-${name}-${size}.png`,fullPage:false});}
   await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration('/game-scam-guard/')),{},{timeout:15000});await page.evaluate(async()=>{const registration=await navigator.serviceWorker.ready;if(!registration.scope.endsWith('/game-scam-guard/'))throw new Error('PWA scope');});const cached=await page.evaluate(async()=>{const cache=await caches.open('gamescam-guard-site-v3');return (await cache.keys()).map(request=>new URL(request.url).pathname);});assert.ok(cached.length>0);assert.ok(cached.every(item=>item.startsWith('/game-scam-guard/')));assert.ok(cached.every(item=>!item.startsWith('/api/')));
   await page.goto(base+'/download.html');assert.equal(await page.evaluate(()=>navigator.serviceWorker.controller),null);assert.equal(await page.locator('#downloadForm').count(),1);assert.deepEqual(errors,[]);result.passed.push(name+': first-party route, English/Persian switch, private/CORS, real HTML, benign upload/hash, responsive layouts and scoped PWA');await context.close();
  }finally{await browser.close();}
 }
 result.status='passed';console.log('PASS '+result.passed.join('\nPASS '));
}catch(error){result.status='failed';result.error=error.message;process.exitCode=1;console.error(error.stack);}
finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));result.serverClosed=true;result.completedAt=new Date().toISOString();await writeFile('test-results/game-scam-preview.json',JSON.stringify(result,null,2));}
