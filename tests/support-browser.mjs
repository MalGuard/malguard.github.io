import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let closed=false,saved=['Report: scanner does not load'],revision=0,enabled=true,lastAdminCloseReason=null;
const ticket=()=>({id,kind:'bug',routing:'agent',subject:'Scanner timeout',status:closed?'closed':'open',
 revision,createdAt:'2026-11-20T00:00:00.000Z',closedAt:closed?'2026-11-20T00:01:00.000Z':null});
const mime={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css',
 '.html':'text/html','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')){
   res.setHeader('Content-Type','application/json');
   const body=await new Promise(done=>{
    let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{try{done(JSON.parse(raw||'{}'));}catch{done({});}});
   });
   let output={},status=200;
   if(url.pathname==='/api/support/status')output={enabled,attachmentsEnabled:false,adminEnabled:true,aiEnabled:false,turnstileSiteKey:null};
   else if(!enabled){status=503;output={error:'support_unavailable'};}
   else if(url.pathname==='/api/support/auth/password')output={sessionToken:'fixture-account-session'};
   else if(url.pathname==='/api/support/auth/start'){
     assert.equal(body.email,'verified@example.test');
     output={challengeId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',expiresInSeconds:600,
       delivery:'provider_accepted'};
   }
   else if(url.pathname==='/api/support/auth/verify'){
     assert.equal(body.challengeId,'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
     if(body.code==='123456')output={sessionToken:'verified-guest-session-token-from-email'};
     else{status=401;output={error:'invalid_login_or_code'};}
   }
   else if(url.pathname==='/api/support/admin-code-start')
     output={challengeId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',expiresInSeconds:600};
   else if(url.pathname==='/api/support/admin-code-verify')
     output={accessToken:'mgadm1.fixture-step-up-session',expiresAt:'2026-11-20T12:15:00.000Z'};
   else if(url.pathname==='/api/support/list')output={tickets:[ticket()]};
   else if(url.pathname==='/api/support/ticket')output={ticket:ticket(),messages:saved.map(content=>({author_kind:'reporter',content,created_at:'2026-11-20T00:00:00Z'}))};
   else if(url.pathname==='/api/support/message'){saved.push(body.message);revision++;output={saved:true,revision};}
   else if(url.pathname==='/api/support/close'){closed=true;revision++;lastAdminCloseReason=body.reason||null;output={ticket:ticket()};}
   else if(url.pathname==='/api/support/reopen'){closed=false;revision++;output={ticket:ticket()};}
   else {status=404;output={error:'not_found'};}
   res.statusCode=status;res.end(JSON.stringify(output));return;
 }
 const path=resolve(root,'.'+url.pathname.replace(/\/+/g,'/'));
 if(!path.startsWith(root+'/')&&!path.endsWith('/support-ticket.html')){res.statusCode=403;res.end();return;}
 try{
  const data=await readFile(path);
  res.statusCode=200;res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');
  res.end(data);
 }catch{res.statusCode=404;res.end('not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const port=server.address().port;
const browser=await chromium.launch({
 headless:true,executablePath:process.env.TEST_CHROMIUM_EXECUTABLE||undefined,
 args:['--no-sandbox']
});
try{
 for(const width of [390,1280]){
  closed=false;revision=0;saved=['Report: scanner does not load'];enabled=true;
  const context=await browser.newContext({viewport:{width,height:900}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push('pageerror:'+e.message));
  page.on('requestfailed',r=>errors.push('requestfailed:'+r.url()+' '+r.failure()?.errorText));
  page.on('console',m=>{if(m.type()==='error')errors.push('console:'+m.text());});
  const navigation=await page.goto('http://127.0.0.1:'+port+'/support-ticket.html');
  try {
    await page.waitForFunction(()=>document.querySelector('#serviceBanner')?.classList.contains('good'),null,{timeout:9000});
  }catch(error){
    console.error('Support browser debug',JSON.stringify({http:navigation?.status(),
      title:await page.title(),status:await page.locator('#serviceBanner').textContent().catch(()=>null),
      scripts:await page.locator('script[src]').evaluateAll(a=>a.map(x=>x.src)),
      errors}));
    throw error;
  }
  await page.fill('#accountEmail','one@example.test');
  await page.fill('#accountPassword','synthetic-password-not-real');
  await page.click('#accountSubmit');
  await page.waitForSelector('.ticket-choice');
  assert.equal(await page.locator('.ticket-choice').count(),1);
  await page.click('.ticket-choice');
  await page.waitForSelector('#chatPane:not([hidden])');
  await page.fill('#reply','I retried the scan');
  await page.click('#sendReply');
  await page.waitForFunction(()=>document.querySelector('#messages')?.textContent?.includes('I retried the scan'));
  page.once('dialog',dialog=>dialog.accept());
  await page.click('#closeTicket');
  await page.waitForSelector('#reopenTicket:not([hidden])');
  await page.click('#reopenTicket');
  await page.waitForSelector('#closeTicket:not([hidden])');
  await page.click('#lang');
  assert.equal(await page.locator('html').getAttribute('dir'),'ltr');
  const horizontal=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
  assert.equal(horizontal,false,'horizontal overflow at '+width);
  const savedCredential=await page.evaluate(()=>Object.keys(localStorage).concat(Object.keys(sessionStorage))
    .some(k=>k.includes('support')||k.includes('account-session')));
  assert.equal(savedCredential,false);
  await context.close();
 }


 // Guest email-code login works without persistence or provider OTP leakage.
 closed=false;revision=0;saved=['Report: scanner does not load'];enabled=true;
 const guestPage=await browser.newPage({viewport:{width:390,height:880}});
 const guestErrors=[];
 guestPage.on('pageerror',e=>guestErrors.push(e.message));
 await guestPage.goto('http://127.0.0.1:'+port+'/support-ticket.html');
 await guestPage.waitForFunction(()=>document.querySelector('#serviceBanner')?.classList.contains('good'));
 assert.equal(await guestPage.locator('#createSubmit').isDisabled(),true);
 await guestPage.fill('#linkEmail','verified@example.test');
 await guestPage.click('#linkSubmit');
 await guestPage.waitForSelector('#emailVerifyForm:not([hidden])');
 assert.equal(await guestPage.locator('#emailVerifyCode').isVisible(),true);
 await guestPage.fill('#emailVerifyCode','000000');
 await guestPage.click('#emailVerifySubmit');
 await guestPage.waitForFunction(()=>document.querySelector('#flash')?.textContent?.includes('کد نامعتبر'));
 await guestPage.fill('#emailVerifyCode','۱۲۳۴۵۶');
 await guestPage.click('#emailVerifySubmit');
 await guestPage.waitForSelector('.ticket-choice');
 assert.equal(await guestPage.locator('#emailVerifyForm').isHidden(),true);
 assert.equal(await guestPage.locator('#createSubmit').isEnabled(),true);
 assert.deepEqual(guestErrors,[]);
 assert.equal(await guestPage.evaluate(()=>localStorage.length+sessionStorage.length),0);
 await guestPage.close();

 closed=false;revision=0;saved=['Report: scanner does not load'];enabled=true;
 const ownerPage=await browser.newPage({viewport:{width:390,height:880}});
 await ownerPage.goto('http://127.0.0.1:'+port+'/support-ticket.html?owner=1');
 await ownerPage.waitForFunction(()=>document.querySelector('#serviceBanner')?.classList.contains('good'));
 await ownerPage.fill('#accountEmail','one@example.test');
 await ownerPage.fill('#accountPassword','synthetic-password-not-real');
 await ownerPage.click('#accountSubmit');
 await ownerPage.waitForSelector('#ownerPanel:not([hidden])');
 await ownerPage.click('#adminCodeStart');
 await ownerPage.waitForSelector('#adminVerifyBox:not([hidden])');
 await ownerPage.fill('#adminCode','123456');
 await ownerPage.click('#adminCodeVerify');
 await ownerPage.waitForFunction(()=>document.querySelector('#who')?.textContent==='MalGuard Support Admin');
 await ownerPage.click('.ticket-choice');
 await ownerPage.fill('#reply','Our expert needs an OS version');
 await ownerPage.click('#sendReply');
 await ownerPage.waitForFunction(()=>document.querySelector('#messages')?.textContent?.includes('Our expert needs an OS version'));
 ownerPage.once('dialog',dialog=>dialog.accept('Verified by support owner'));
 await ownerPage.click('#closeTicket');
 await ownerPage.locator('#closeTicket').waitFor({state:'hidden'});
 assert.equal(lastAdminCloseReason,'Verified by support owner');
 assert.equal(await ownerPage.locator('#reopenTicket').isHidden(),true);
 await ownerPage.close();

 enabled=false;
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:'+port+'/support-ticket.html');
 await page.waitForFunction(()=>document.querySelector('#serviceBanner')?.classList.contains('bad'));
 assert.equal(await page.locator('#createSubmit').isDisabled(),true);
 await page.close();
 console.log('PASS support browser: responsive sign-in, tickets, chat, close/reopen, no persistent credentials, offline fallback');
}finally{await browser.close();await new Promise(done=>server.close(done));}
