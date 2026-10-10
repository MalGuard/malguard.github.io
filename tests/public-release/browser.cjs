const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const {createHash,createCipheriv}=require('node:crypto');
const {mkdirSync}=require('node:fs');
const {createServer}=require('node:http');
(async()=>{
 const origin='http://127.0.0.1:8769';
 const staticServer=spawn('python3',['-m','http.server','8769','--bind','127.0.0.1'],{cwd:process.cwd(),stdio:'ignore'});
 let browser,server;
 try{
  const {createPasswordDownloadHandler,passwordDownloadKey}=await import('../../private-download-service/lib/password-download.mjs');
  const code='Browser&Fixture2013',wrong='MG'+'B'.repeat(32),build='MG-1.3.1-WIN64-aaaaaaaaaaaa',passwordKdf='scrypt-v1';
  const bytes=Buffer.alloc(3*1024*1024+101,84);bytes.write('Harmless synthetic browser fixture, never a real installer.');
  const salt='c'.repeat(64),nonce=Buffer.alloc(12,3),cipher=createCipheriv('aes-256-gcm',await passwordDownloadKey(code,salt,build,passwordKdf),nonce);cipher.setAAD(Buffer.from('MGDL1:'+build));
  const sealed=Buffer.concat([Buffer.from('MGDL1\0'),nonce,cipher.update(bytes),cipher.final(),cipher.getAuthTag()]);
  const hash=data=>createHash('sha256').update(data).digest('hex');
  const latest={schemaVersion:'1.0.0',platform:'windows-x64',status:'password-download-ready',serviceUrl:'https://malguard-private-download.vercel.app/api/installer',filename:'MalGuard-Setup-x64.exe',version:'1.3.1',engineVersion:'1.2.1',build,sourceCommit:'a'.repeat(40),sha256:hash(bytes),size:bytes.length,partBytes:3*1024*1024,partCount:2,passwordRequired:true,deviceLicenseRequired:false,installerPasswordRequired:false,changes:{en:['Synthetic change'],fa:['تغییر مصنوعی']}};
  const handler=createPasswordDownloadHandler({metadata:{...latest,passwordSalt:salt,passwordKdf,sealedSha256:hash(sealed)},readSealed:async()=>sealed,origin});
  server=createServer(handler);await new Promise(done=>server.listen(8770,'127.0.0.1',done));
  browser=await chromium.launch({executablePath:process.env.TEST_CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));let downloads=0,requests=0,corrupt=false,delay=false;
  page.on('download',()=>downloads++);
  await page.route('**/release/malguard-current-release.json',r=>r.fulfill({status:404,body:'Synthetic unavailable release'}));
  await page.goto(origin+'/download.html#scanner');
  await page.waitForFunction(()=>document.getElementById('downloadStatus').textContent.includes('cannot be verified'));
  assert.equal(await page.locator('#downloadButton').isDisabled(),true);
  assert.equal(await page.locator('input[type=password]').count(),1);
  assert.equal(await page.locator('a[href$=".7z"],#privatePackageDownload').count(),0);
  await page.unroute('**/release/malguard-current-release.json');
  await page.route('**/release/malguard-current-release.json',r=>r.fulfill({json:latest}));
  const old='MG-1.2.0-WIN64-bbbbbbbbbbbb';
  await page.route('**/release/malguard-release-history.json',r=>r.fulfill({json:[{build:old,supersededBy:build}]}));
  await page.route(latest.serviceUrl,async route=>{
   if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-methods':'POST','access-control-allow-headers':'content-type'}});return;}
   requests++;const payload=route.request().postDataJSON();assert.deepEqual(Object.keys(payload).sort(),['code','part']);
   if(delay)await new Promise(done=>setTimeout(done,150));
   const response=await fetch('http://127.0.0.1:8770',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(payload)});
   let body=Buffer.from(await response.arrayBuffer());
   if(corrupt&&response.status===200&&payload.part===1){body=Buffer.from(body);body[0]^=1;}
   await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body});
  });
  await page.reload();await page.waitForFunction(()=>!document.getElementById('downloadButton').disabled);
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  await page.locator('#downloadButton').click();assert.equal(requests,0);assert.equal(downloads,0);
  await page.locator('#downloadPassword').fill(wrong);await page.locator('#downloadButton').click();
  await page.waitForFunction(()=>document.getElementById('downloadStatus').textContent.includes('incorrect'));
  assert.equal(downloads,0);assert.equal(await page.locator('#downloadPassword').inputValue(),'');
  await page.locator('#downloadPassword').fill(code);
  const promise=page.waitForEvent('download');await page.locator('#downloadButton').click();const download=await promise;
  assert.equal(download.suggestedFilename(),latest.filename);let size=0;const digest=createHash('sha256');
  for await(const chunk of await download.createReadStream()){size+=chunk.length;digest.update(chunk);}
  assert.equal(size,latest.size);assert.equal(digest.digest('hex'),latest.sha256);
  await page.waitForFunction(()=>document.getElementById('downloadStatus').textContent.includes('ready to save'));
  assert.equal(await page.locator('#downloadPassword').inputValue(),'');
  assert.equal(await page.evaluate(value=>location.href.includes(value)||[...Object.keys(localStorage),...Object.keys(sessionStorage)].some(k=>/password|code|download/i.test(k)),code),false);
  await page.locator('#downloadPassword').fill(wrong);await page.locator('#downloadButton').click();await page.waitForFunction(()=>document.getElementById('downloadStatus').textContent.includes('incorrect'));assert.equal(downloads,1);
  corrupt=true;await page.locator('#downloadPassword').fill(code);await page.locator('#downloadButton').click();await page.waitForFunction(()=>document.getElementById('downloadStatus').textContent.includes('Download stopped'));assert.equal(downloads,1);corrupt=false;
  delay=true;await page.locator('#downloadPassword').fill(code);await page.locator('#downloadButton').click();await page.locator('#cancelDownload').click();await page.waitForFunction(()=>document.getElementById('downloadStatus').textContent.includes('cancelled'));assert.equal(downloads,1);delay=false;
  await page.locator('#buildInput').fill(old);await page.locator('#buildCheckForm button').click();assert.match(await page.locator('#buildCheckStatus').innerText(),/newer release/);
  await page.locator('#buildInput').fill(build);await page.locator('#buildCheckForm button').click();assert.match(await page.locator('#buildCheckStatus').innerText(),/current build/);
  mkdirSync('test-results',{recursive:true});await page.setViewportSize({width:1280,height:1000});await page.locator('#scanner').screenshot({path:'test-results/password-download-en.png'});
  assert.equal(await page.locator('.mg-language select').count(),1);
  await page.locator('.mg-language select').selectOption('fa');assert.equal(await page.locator('html').getAttribute('dir'),'rtl');assert.match(await page.locator('#downloadButton').innerText(),/بررسی رمز/);assert.match(await page.locator('#passwordHelp').innerText(),/نصب و اجرا آزاد/);assert.match(await page.locator('#buildCheckStatus').innerText(),/بیلد فعلی/);
  await page.setViewportSize({width:320,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.locator('#scanner').screenshot({path:'test-results/password-download-fa-mobile.png'});
  await page.reload();await page.waitForFunction(()=>!document.getElementById('downloadButton').disabled);assert.equal(await page.locator('.mg-language select').inputValue(),'fa');
  await page.locator('summary').filter({hasText:'Smart App Control یا سیاست سازمان'}).click();assert.match(await page.locator('#troubleshooting').innerText(),/غیرفعال نکنید/);
  assert.deepEqual(errors,[]);
  console.log('PASS: actual server authentication, missing/wrong/cached passwords, complete multipart download and SHA-256, corrupted transfer, cancellation, no password storage, build check, EN/FA, RTL/mobile and language persistence. All download bytes were harmless synthetic fixtures.');
 }finally{await browser?.close();await new Promise(done=>server?server.close(done):done());staticServer.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
