const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
(async()=>{
 const server=spawn('python3',['-m','http.server','8769','--bind','127.0.0.1'],{cwd:process.cwd(),stdio:'ignore'});
 let browser;
 try{
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();
  await page.route('**/release/malguard-public-release.json',r=>r.fulfill({status:404,body:'No release in this synthetic failure scenario'}));
  await page.goto('http://127.0.0.1:8769/download.html');
  await page.waitForFunction(()=>document.getElementById('downloadStatus').textContent.includes('cannot be verified'));
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.equal(await page.locator('#downloadButton').isDisabled(),true);
  assert.equal(await page.locator('input[type=password]').count(),0);
  await page.locator('.mg-language select').selectOption('fa');
  assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
  assert.equal(await page.locator('h1').innerText(),'اسکنر برای بررسی ماد بعدی شما.');
  assert.ok((await page.locator('#downloadStatus').innerText()).includes('قابل تأیید نیست'));
  await page.locator('summary').filter({hasText:'Smart App Control یا سیاست سازمان'}).click();
  assert.ok((await page.locator('#troubleshooting').innerText()).includes('غیرفعال نکنید'));
  await page.reload();
  assert.equal(await page.locator('.mg-language select').inputValue(),'fa');
  await page.locator('.mg-language select').selectOption('en');
  assert.equal(await page.locator('h1').innerText(),'The scanner. Ready for your next mod.');
  await page.setViewportSize({width:375,height:812});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  console.log('PASS: English default, Persian/RTL/persistence, return to English, mobile width, password removed, missing release fails closed.');
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
