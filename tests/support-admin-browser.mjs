import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const ticketId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let status={enabled:true,adminEnabled:true},closed=false,authorized=false,requestCount=0,submitted=[];
const fakeTicket=()=>({id:ticketId,kind:'bug',routing:'expert',status:closed?'closed':'open',
  subject:'Scanner error',revision:submitted.length+(closed?1:0),createdAt:'2026-11-20T00:00:00.000Z'});
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')){
  let body={};let raw='';
  for await(const chunk of req)raw+=chunk;
  try{body=JSON.parse(raw||'{}');}catch{}
  res.setHeader('content-type','application/json');
  const auth=req.headers.authorization||'';
  let data={},code=200;
  switch(url.pathname){
   case '/api/support/status':data=status;break;
   case '/api/game-scam-guard/auth/password':
    data={sessionToken:'synthetic-account-token'};break;
   case '/api/support/admin-code-start':
    if(auth!=='Bearer synthetic-account-token'){code=401;data={error:'unauthorized'};}
    else{requestCount++;data={challengeId:ticketId};}break;
   case '/api/support/admin-code-verify':
    if(auth!=='Bearer synthetic-account-token'||body.code!=='12345678'){
     code=401;data={error:'unauthorized'};
    }else{authorized=true;data={accessToken:'synthetic-admin-token'};}break;
   case '/api/support/list':
    if(auth!=='Bearer synthetic-admin-token'){code=403;data={error:'forbidden'};}
    else data={tickets:[fakeTicket()]};break;
   case '/api/support/ticket':
    if(auth!=='Bearer synthetic-admin-token'){code=403;data={error:'forbidden'};}
    else data={ticket:fakeTicket(),messages:[{author_kind:'reporter',
      content:'Screen is blank <img src=x onerror=alert(1)>',created_at:'2026-11-20T00:00:00Z'}]};break;
   case '/api/support/message':
    if(auth!=='Bearer synthetic-admin-token'){code=403;data={error:'forbidden'};}
    else{submitted.push(body.message);data={saved:true};}break;
   case '/api/support/close':
    if(auth!=='Bearer synthetic-admin-token'||!body.reason){code=403;data={error:'forbidden'};}
    else{closed=true;data={ticket:fakeTicket()};}break;
   default:code=404;data={error:'unknown_endpoint'};
  }
  res.statusCode=code;res.end(JSON.stringify(data));return;
 }
 let pathname=url.pathname;
 if(pathname==='/')pathname='/support-admin.html';
 const full=resolve(root,'.'+pathname);
 if(!full.startsWith(root+'/')){res.statusCode=403;res.end();return;}
 try{res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(full)]||'application/octet-stream');
  res.end(await readFile(full));
 }catch{res.statusCode=404;res.end('not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});
try{
 for(const width of [390,1280]){
  status={enabled:true,adminEnabled:true};closed=false;authorized=false;requestCount=0;submitted=[];
  const context=await browser.newContext({viewport:{width,height:900}});
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:'+server.address().port+'/support-admin.html');
  await page.waitForFunction(()=>document.querySelector('#adminNotice')?.classList.contains('good'));
  assert.equal(await page.locator('#adminTickets .ticket-choice').count(),0);
  await page.fill('#ownerEmail','owner@example.test');
  await page.fill('#ownerPassword','synthetic-fixture');
  await page.click('#ownerForm button');
  await page.waitForSelector('#ownerOtp:not([hidden])');
  assert.equal(requestCount,1);
  assert.equal(await page.inputValue('#ownerPassword'),'');
  await page.fill('#otpCode','12345678');
  await page.click('#otpForm button');
  await page.waitForSelector('#ownerList:not([hidden])');
  await page.waitForSelector('.ticket-choice');
  assert.equal(authorized,true);
  await page.click('.ticket-choice');
  await page.waitForSelector('#adminChat:not([hidden])');
  assert.equal(await page.locator('#adminMessages img').count(),0);
  assert.match(await page.locator('#adminMessages').innerText(),/onerror/);
  await page.fill('#adminReply','Please share the app version');
  await page.click('#adminReplyForm button');
  await page.waitForFunction(()=>document.querySelector('#adminReply')?.value==='');
  assert.deepEqual(submitted,['Please share the app version']);
  await page.fill('#adminCloseReason','Reviewed and reporter notified');
  page.once('dialog',dialog=>dialog.accept());
  await page.click('#adminCloseForm button');
  await page.waitForSelector('#adminCloseForm[hidden]');
  assert.equal(closed,true);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
  assert.equal(overflow,false,'overflow at '+width);
  const leaks=await page.evaluate(()=>Object.entries(localStorage).concat(Object.entries(sessionStorage)).some(([k,v])=>/synthetic-admin-token|synthetic-account-token/.test(k+v)));
  assert.equal(leaks,false);
  await page.click('#ownerLogout');
  assert.equal(await page.locator('#ownerList').isHidden(),true);
  await context.close();
 }
 status={enabled:false,adminEnabled:false};
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:'+server.address().port+'/support-admin.html');
 await page.waitForFunction(()=>document.querySelector('#adminNotice')?.classList.contains('bad'));
 assert.equal(await page.locator('#ownerForm button').isDisabled(),true);
 await page.close();
 console.log('PASS support owner browser: OTP gating, no injection, human replies, close reasons, RTL layouts, disabled fallback');
}finally{await browser.close();await new Promise(done=>server.close(done));}
