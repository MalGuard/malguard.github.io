const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {mkdirSync,writeFileSync}=require('node:fs');
const {createServer}=require('node:http');
(async()=>{
 const origin='http://127.0.0.1:8769';
 const staticServer=spawn('python3',['-m','http.server','8769','--bind','127.0.0.1'],{cwd:process.cwd(),stdio:'ignore'});
 let browser,server;
 const checks=[];const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);};
 try{
  const build='MG-1.3.2-WIN64-aaaaaaaaaaaa',bytes=Buffer.alloc(3*1024*1024+101,84);
  bytes.write('Harmless synthetic browser fixture, never a real installer.');
  const hash=data=>createHash('sha256').update(data).digest('hex');
  const latest={schemaVersion:'1.0.0',platform:'windows-x64',status:'public-download-ready',serviceUrl:'/release/MalGuard-Setup-x64.exe',filename:'MalGuard-Setup-x64.exe',version:'1.3.2',engineVersion:'1.2.2',build,sourceCommit:'a'.repeat(40),sha256:hash(bytes),size:bytes.length,partBytes:3*1024*1024,partCount:2,passwordRequired:false,deviceLicenseRequired:false,installerPasswordRequired:false,changes:{en:['Synthetic change'],fa:['تغییر مصنوعی']}};
  let mode='valid',requests=0,releaseDelayed;
  let announceDelayed;const delayedStarted=new Promise(resolve=>{announceDelayed=resolve;});
  server=createServer((req,res)=>{
   check('anonymous-get-'+requests,req.method==='GET'&&!req.headers.authorization&&!req.headers.cookie);requests++;
   if(mode==='error'){res.writeHead(503);res.end('Synthetic unavailable');return;}
   const body=Buffer.from(bytes);
   if(mode==='corrupt')body[100]^=1;
   res.writeHead(200,{'Content-Type':'application/octet-stream'});
   res.end(mode==='truncated'?body.subarray(0,100):mode==='overflow'?Buffer.concat([body,Buffer.from([1])]):body);
  });await new Promise(done=>server.listen(8770,'127.0.0.1',done));
  browser=await chromium.launch({executablePath:process.env.TEST_CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));let downloads=0;
  page.on('download',()=>downloads++);
  await page.route('**/release/malguard-current-release.json',r=>r.fulfill({status:404,body:'Synthetic unavailable release'}));
  await page.goto(origin+'/download.html#scanner');
  await page.waitForFunction(()=>document.getElementById('downloadStatus').textContent.includes('cannot be verified'));
  check('unverified-metadata-disables-transfer',await page.locator('#downloadButton').isDisabled());
  check('no-download-password-field',await page.locator('input[type=password]').count()===0);
  check('no-private-package-control',await page.locator('a[href$=".7z"],#privatePackageDownload').count()===0);
  await page.unroute('**/release/malguard-current-release.json');
  await page.route('**/release/malguard-current-release.json',r=>r.fulfill({json:latest}));
  const old='MG-1.3.1-WIN64-bbbbbbbbbbbb';
  await page.route('**/release/malguard-release-history.json',r=>r.fulfill({json:[{build:old,supersededBy:build}]}));
  await page.route('**/release/MalGuard-Setup-x64.exe',async route=>{
   const delayed=mode==='delay';
   check('browser-does-not-submit-password',route.request().method()==='GET'&&route.request().postData()===null);
   if(delayed){announceDelayed();await new Promise(done=>{releaseDelayed=done;});}
   const response=await fetch('http://127.0.0.1:8770');
   try{await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});}catch{if(!delayed)throw new Error('Transfer route failed');}
  });
  await page.reload();await page.waitForFunction(()=>!document.getElementById('downloadButton').disabled);
  check('english-default',await page.locator('html').getAttribute('lang')==='en');
  const promise=page.waitForEvent('download');await page.locator('#downloadButton').click();const download=await promise;
  check('correct-filename',download.suggestedFilename()===latest.filename);let size=0;const digest=createHash('sha256');
  for await(const chunk of await download.createReadStream()){size+=chunk.length;digest.update(chunk);}
  check('complete-public-file-size',size===latest.size);check('complete-public-file-sha256',digest.digest('hex')===latest.sha256);
  await page.waitForFunction(()=>document.getElementById('downloadStatus').textContent.includes('ready to save'));
  check('one-action-download',requests===1&&downloads===1);
  check('no-download-password-storage',await page.evaluate(()=>![...Object.keys(localStorage),...Object.keys(sessionStorage)].some(k=>/password|code|download/i.test(k))));
  for(const bad of ['corrupt','truncated','overflow','error']){
   mode=bad;await page.locator('#downloadButton').click();await page.waitForFunction(()=>document.getElementById('downloadStatus').textContent.includes('Download stopped'));
   check(bad+'-does-not-save-installer',downloads===1);
  }
  mode='delay';await page.locator('#downloadButton').click();await delayedStarted;
  try{await page.locator('#cancelDownload').click();await page.waitForFunction(()=>document.getElementById('downloadStatus').textContent.includes('cancelled'));check('cancel-does-not-save-partial-file',downloads===1);}finally{releaseDelayed();}
  await page.waitForTimeout(350);mode='valid';
  await page.locator('#buildInput').fill(old);await page.locator('#buildCheckForm button').click();check('older-build-explained',/newer release/.test(await page.locator('#buildCheckStatus').innerText()));
  await page.locator('#buildInput').fill(build);await page.locator('#buildCheckForm button').click();check('current-build-confirmed',/current build/.test(await page.locator('#buildCheckStatus').innerText()));
  mkdirSync('test-results',{recursive:true});await page.setViewportSize({width:1280,height:1000});await page.locator('#scanner').screenshot({path:'test-results/public-download-en.png'});
  check('one-language-control',await page.locator('.mg-language select').count()===1);
  await page.locator('.mg-language select').selectOption('fa');check('persian-rtl',await page.locator('html').getAttribute('dir')==='rtl');check('persian-download-button',/دانلود/.test(await page.locator('#downloadButton').innerText()));check('persian-public-no-password-help',/به رمز.*نیاز ندارد/.test(await page.locator('#downloadHelp').innerText()));check('persian-current-build',/بیلد فعلی/.test(await page.locator('#buildCheckStatus').innerText()));
  await page.setViewportSize({width:320,height:1000});check('mobile-without-overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('#scanner').screenshot({path:'test-results/public-download-fa-mobile.png'});
  await page.reload();await page.waitForFunction(()=>!document.getElementById('downloadButton').disabled);check('language-persists',await page.locator('.mg-language select').inputValue()==='fa');
  check('no-browser-errors: '+JSON.stringify(errors.slice(0,8)),errors.length===0);
  const result={passed:checks.length,checks,errors,synthetic_download_only:true};writeFileSync('test-results/public-download-browser.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:checks.length,errors,public_download_without_password:true}));
 }finally{await browser?.close();await new Promise(done=>server?server.close(done):done());staticServer.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
