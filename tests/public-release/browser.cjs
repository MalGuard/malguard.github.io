const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {readFileSync,mkdirSync}=require('node:fs');
const privateRelease=JSON.parse(readFileSync('release/malguard-private-release.json','utf8'));
(async()=>{
 const server=spawn('python3',['-m','http.server','8769','--bind','127.0.0.1'],{cwd:process.cwd(),stdio:'ignore'});
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.TEST_CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();
  await page.route('**/release/malguard-public-release.json',r=>r.fulfill({status:404,body:'No release in this synthetic failure scenario'}));
  await page.goto('http://127.0.0.1:8769/download.html#scanner');
  await page.waitForFunction(()=>document.getElementById('downloadStatus').textContent.includes('cannot be verified'));
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.equal(await page.locator('#downloadButton').isDisabled(),true);
  assert.equal(await page.locator('input[type=password]').count(),0);
  assert.equal(await page.locator('#privatePackageDownload').getAttribute('href'),privateRelease.url);
  assert.equal(await page.locator('#privateBuild').innerText(),privateRelease.build);
  assert.equal(await page.locator('#privatePackageHash').innerText(),privateRelease.sha256);
  assert.equal(await page.locator('#private-release #scanner').count(),1);
  await page.locator('#buildInput').fill(privateRelease.build.toLowerCase());
  await page.locator('#buildCheckForm button').click();
  assert.ok((await page.locator('#buildCheckStatus').innerText()).includes('current private build'));
  const privateDownloadPromise=page.waitForEvent('download');
  await page.locator('#privatePackageDownload').click();
  const privateDownload=await privateDownloadPromise;
  assert.equal(privateDownload.suggestedFilename(),privateRelease.filename);
  const privateStream=await privateDownload.createReadStream();
  const privateHash=createHash('sha256');let privateSize=0;
  for await(const chunk of privateStream){privateHash.update(chunk);privateSize+=chunk.length;}
  assert.equal(privateSize,privateRelease.size);
  assert.equal(privateHash.digest('hex'),privateRelease.sha256);
  mkdirSync('test-results',{recursive:true});
  await page.setViewportSize({width:1280,height:1000});
  await page.locator('#private-release').screenshot({path:'test-results/private-release-en.png'});
  await page.locator('.mg-language select').selectOption('fa');
  assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
  assert.equal(await page.locator('h1').innerText(),'اسکنر برای بررسی ماد بعدی شما.');
  assert.ok((await page.locator('#downloadStatus').innerText()).includes('قابل تأیید نیست'));
  assert.ok((await page.locator('#privateReleaseTitle').innerText()).includes('نصب خصوصی'));
  assert.ok((await page.locator('#privatePackageDownload').innerText()).includes('دانلود بستهٔ خصوصی'));
  assert.ok((await page.locator('#buildCheckStatus').innerText()).includes('بیلد فعلی نسخهٔ خصوصی'));
  await page.setViewportSize({width:320,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#private-release').screenshot({path:'test-results/private-release-fa-mobile.png'});
  await page.locator('summary').filter({hasText:'Smart App Control یا سیاست سازمان'}).click();
  assert.ok((await page.locator('#troubleshooting').innerText()).includes('غیرفعال نکنید'));
  await page.reload();
  assert.equal(await page.locator('.mg-language select').inputValue(),'fa');
  await page.locator('.mg-language select').selectOption('en');
  assert.equal(await page.locator('h1').innerText(),'The scanner. Ready for your next mod.');
  await page.setViewportSize({width:375,height:812});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  console.log('PASS: English/Persian, RTL/persistence, private/public distinction, complete encrypted package download and SHA-256, mobile width and missing public release isolation.');
  const bytes=Buffer.from('Harmless synthetic download fixture');
  const latest={schemaVersion:'1.0.0',platform:'windows-x64',status:'public-download-ready',serviceUrl:'https://malguard-private-download.vercel.app/api/download',filename:'MalGuard-Setup-x64.exe',version:'1.2.0',engineVersion:'1.1.0',build:'MG-1.2.0-WIN64-aaaaaaaaaaaa',sourceCommit:'a'.repeat(40),sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.length,partBytes:3*1024*1024,partCount:1,changes:{en:['Synthetic change'],fa:['تغییر مصنوعی']}};
  const old='MG-1.1.0-IEXPRESS-WIN64-bbbbbbbbbbbb';
  await page.route('**/release/malguard-public-release.json',r=>r.fulfill({json:latest}));
  await page.route('**/release/malguard-release-history.json',r=>r.fulfill({json:[{build:old,supersededBy:latest.build}]}));
  await page.route(latest.serviceUrl,async r=>{
    if(r.request().method()==='OPTIONS'){await r.fulfill({status:204,headers:{'access-control-allow-origin':'http://127.0.0.1:8769','access-control-allow-methods':'POST','access-control-allow-headers':'content-type'}});return;}
    assert.deepEqual(r.request().postDataJSON(),{part:0});
    await r.fulfill({body:bytes,headers:{'access-control-allow-origin':'http://127.0.0.1:8769','access-control-expose-headers':'x-part-index,x-file-size,x-file-sha256','Content-Type':'application/octet-stream','x-part-index':'0','x-file-size':String(bytes.length),'x-file-sha256':latest.sha256}});
  });
  await page.reload();await page.waitForFunction(()=>!document.getElementById('downloadButton').disabled);
  assert.ok((await page.locator('#downloadStatus').innerText()).includes('Previous public release 1.2.0'));
  assert.ok((await page.locator('#downloadStatus').innerText()).includes('password-protected 1.3.0'));
  await page.locator('.mg-language select').selectOption('fa');
  assert.ok((await page.locator('#downloadStatus').innerText()).includes('نسخهٔ عمومی قبلی ۱.۲.۰'));
  assert.ok((await page.locator('#downloadStatus').innerText()).includes('بستهٔ رمزدار ۱.۳.۰'));
  await page.locator('.mg-language select').selectOption('en');
  for(const [input,message]of [[latest.build,'latest known build'],[old,'newer release'],['MG-1.1.0-GUI-WIN64-cccccccccccc','not recognized'],['beta6','complete build code']]){
    await page.locator('#buildInput').fill(input);await page.locator('#buildCheckForm button').click();
    assert.ok((await page.locator('#buildCheckStatus').innerText()).includes(message));
  }
  const downloadPromise=page.waitForEvent('download');await page.locator('#downloadButton').click();
  const download=await downloadPromise;assert.equal(download.suggestedFilename(),latest.filename);
  const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks),bytes);
  await page.route(latest.serviceUrl,r=>r.fulfill({body:Buffer.alloc(bytes.length),headers:{'access-control-allow-origin':'http://127.0.0.1:8769','access-control-expose-headers':'x-part-index,x-file-size,x-file-sha256','Content-Type':'application/octet-stream','x-part-index':'0','x-file-size':String(bytes.length),'x-file-sha256':latest.sha256}}));
  let unexpected=false;page.on('download',()=>{unexpected=true;});
  await page.locator('#downloadButton').click();await page.waitForFunction(()=>document.getElementById('downloadStatus').textContent.includes('Download stopped'));
  assert.equal(unexpected,false);
  console.log('PASS: synthetic current/older/unknown/invalid build checks, no-code request, exact-byte download and corrupted-byte rejection. No production download or executable was used.');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
