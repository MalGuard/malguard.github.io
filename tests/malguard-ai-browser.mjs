import assert from 'node:assert/strict';
import express from 'express';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {createApp} from '../services/malguard-ai/server/app.js';
import {chromium,launchOptions} from './browser-runtime.mjs';
const web=express(),root=fileURLToPath(new URL('../',import.meta.url));let requests=0;
const server=web.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base=`http://127.0.0.1:${server.address().port}`;
web.use('/api/malguard-ai',(req,res,next)=>{if(req.method==='POST')requests++;next();},createApp({enabled:true,publicOrigin:base,log:()=>{}}));web.use(express.static(root));
const browser=await chromium.launch(launchOptions('chromium'));
try{
 for(const width of [360,390,768,1280]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',r=>{if(new URL(r.request().url()).origin===base)return r.continue();external.push(r.request().url());return r.abort();});
  await page.goto(base+'/ai/');await page.locator('#send').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('send').disabled);
  assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
  await page.locator('#language').click();assert.equal(await page.locator('html').getAttribute('dir'),'ltr');
  await page.locator('#file').setInputFiles({name:'benign.txt',mimeType:'text/plain',buffer:Buffer.from('Hello, harmless browser fixture.')});
  const before=requests;await page.locator('#send').click();assert.equal(requests,before,'no upload without consent');
  await page.locator('#file-consent').check();
  await page.locator('#send').click();
  try{await page.getByRole('heading',{name:'No malicious evidence found in the checks performed.'}).waitFor({timeout:15000});}
  catch(error){console.error('Browser failure:',await page.locator('#conversation').innerText(),errors);throw error;}
  assert.equal(await page.locator('#file-consent').isChecked(),false);
  await page.getByText('Inspection details',{exact:true}).click();assert.match(await page.locator('.result code').last().innerText(),/sha256/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`);
  assert.equal(await page.evaluate(()=>localStorage.length),0);
  assert.equal(await page.locator('#tool option[value="ai_web"]').isDisabled(),true);
  assert.equal(await page.locator('#tool option[value="malwarebazaar"]').isDisabled(),true);
  await page.locator('#language').click();assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
  await page.getByRole('heading',{name:'شواهد مخرب در بررسی‌های انجام‌شده یافت نشد.'}).waitFor();
  if([390,1280].includes(width)){await mkdir('test-results/malguard-ai',{recursive:true});await page.screenshot({path:`test-results/malguard-ai/${width}.png`,fullPage:true});}
  await page.locator('#clear').click();assert.equal(await page.locator('#conversation').innerText(),'');
  await page.reload();assert.equal(await page.locator('#conversation').innerText(),'');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await context.close();
  console.log(`PASS real AI frontend → backend → static worker, consent, RTL/LTR, no overflow/history at ${width}px`);
 }
 const context=await browser.newContext(),page=await context.newPage();await context.route('**/api/malguard-ai/status',r=>r.abort());await page.goto(base+'/ai/');await page.getByRole('status').filter({hasText:'ارتباط با بک‌اند برقرار نشد'}).waitFor();assert.equal(await page.locator('#send').isDisabled(),true);await context.close();console.log('PASS backend failure shown; submission disabled.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
