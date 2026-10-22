const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium'});try{
 for(const route of ['tools.html','scan-url.html']){
  const c=await b.newContext({reducedMotion:'reduce'}),p=await c.newPage();let scans=0;await c.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!=='http://127.0.0.1:4174')return r.abort();if(/\/api\/(?:game-scam-guard\/)?(?:scan|jobs)(?:\/|$)/.test(u.pathname))scans++;return r.continue();});await p.goto('http://127.0.0.1:4174/'+route);
  await p.locator('#urlInput').fill('poblox.com');await p.locator('#inspectButton,#scanUrl').click();assert.match(await p.locator('#urlResult').innerText(),/Possible roblox lookalike/);const href=await p.locator('#urlResult a').getAttribute('href');assert.equal(href,'/game-scam-guard/#inspect=https%3A%2F%2Fpoblox.com%2F');assert.equal(scans,0);
  await p.locator('#urlInput').fill('roblox.com');await p.locator('#urlInput').press('Enter');assert(!/lookalike/.test(await p.locator('#urlResult').innerText()));
  await p.locator('#urlInput').fill('https://roblox.com@192.0.2.1:8080/<img>');await p.locator('#inspectButton,#scanUrl').click();assert.equal(await p.locator('#urlResult img,#urlResult a').count(),0);assert.match(await p.locator('#urlResult').innerText(),/credentials/);await c.close();console.log('PASS',route,'lookalike, Enter, official host, escaped HTML, credentials, no local network scan');
 }
 const c=await b.newContext();let posts=0;await c.route('**/*',r=>{const url=new URL(r.request().url());if(url.pathname.includes('/api/')){if(r.request().method()==='POST')posts++;return r.fulfill({status:200,contentType:'application/json',body:'{"status":"ok","providers":{}}'});}if(url.origin!=='http://127.0.0.1:4174')return r.abort();return r.continue();});const p=await c.newPage();
 // Serve the actual production build under its configured base path.
 await c.route('**/game-scam-guard/**',r=>{const pathname=new URL(r.request().url()).pathname.replace('/game-scam-guard/','/services/game-scam-guard/dist/');return r.continue({url:'http://127.0.0.1:4174'+pathname});});
 await p.goto('http://127.0.0.1:4174/game-scam-guard/#inspect=https%3A%2F%2Fpoblox.com%2F');await p.waitForSelector('#site-url');assert.equal(await p.locator('#site-url').inputValue(),'https://poblox.com/');assert.equal(posts,0);console.log('PASS actual Game Scam Guard build pre-fills handoff without starting a scan');await c.close();
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
