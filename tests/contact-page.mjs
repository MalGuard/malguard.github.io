import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,launchOptions} from './browser-runtime.mjs';
const base='https://127.0.0.1:8443';
const expected={
 'contact-email':'https://mail.google.com/mail/?view=cm&fs=1&to=contact%40malguard.site',
 'contact-instagram':'https://www.instagram.com/malguard.security/',
 'contact-linkedin':'https://www.linkedin.com/in/mohammadreza-azarderakhsh-782640446/'
};
const browser=await chromium.launch(launchOptions('chromium'));
const results=[];
await mkdir('test-results',{recursive:true});
try{
 for(const width of [320,390,820,1440]){
  const context=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true});
  const errors=[],external=[];
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin===base)return route.continue();external.push(route.request().url());return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Outbound-link fixture</title>'})});
  const page=await context.newPage();await page.goto(base+'/contact.html',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('#navbar').getAttribute('data-navigation-ready'),'true');
  assert.equal(await page.locator('h1').count(),1);
  const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,links:[...document.querySelectorAll('.contact-link')].map(a=>({border:getComputedStyle(a).borderWidth,background:getComputedStyle(a).backgroundColor,visible:a.getBoundingClientRect().width>0})),icons:[...document.querySelectorAll('.contact-icon')].every(i=>i.complete&&i.naturalWidth>0)}));
  assert.equal(layout.overflow,false,`Overflow at ${width}`);const headerFits=await page.locator('#navbar').evaluate(nav=>[...nav.querySelectorAll('button,.mg-brand')].filter(e=>e.getClientRects().length).every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth}));assert.ok(headerFits,'Visible header controls must fit the viewport');assert.ok(layout.icons);assert.ok(layout.links.every(a=>a.border==='0px'&&a.background==='rgba(0, 0, 0, 0)'&&a.visible));
  assert.equal(external.length,0,'Contact page must not fetch social embeds or trackers');
  for(const[id,url]of Object.entries(expected)){
   const link=page.locator('#'+id);assert.equal(await link.getAttribute('href'),url);assert.match(await link.getAttribute('rel'),/noopener/);
   const popupPromise=page.waitForEvent('popup');await link.click();const popup=await popupPromise;await popup.waitForLoadState('domcontentloaded');assert.equal(popup.url(),url);await popup.close();
  }
  assert.equal(await page.locator('.contact-mail-app').getAttribute('href'),'mailto:contact@malguard.site');
  await page.locator('#contact-instagram').focus();await page.keyboard.press('Tab');assert.equal(await page.locator('#contact-linkedin').evaluate(e=>e===document.activeElement),true);
  await page.locator('#menuBtn').click();await page.locator('#navLinks a[href="/contact.html"]').click();await page.waitForLoadState('domcontentloaded');assert.equal(new URL(page.url()).pathname,'/contact.html');
  await page.locator('#searchButton').click();await page.locator('#siteSearchInput').fill('instagram');assert.ok(await page.locator('#siteSearchResults').innerText().then(x=>x.includes('Contact')));await page.keyboard.press('Escape');
  await page.screenshot({path:`test-results/contact-${width}.png`,fullPage:true});
  await page.evaluate(()=>{document.documentElement.lang='fa';document.documentElement.dir='rtl'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'RTL overflow');
  assert.deepEqual(errors,[]);results.push({width,unboxedLinks:true,logosLoaded:true,outboundDestinations:'passed',menuAndSearch:'passed',keyboard:'passed',rtlOverflow:false,pageErrors:errors});await context.close();
 }
 const c=await browser.newContext({viewport:{width:390,height:844},javaScriptEnabled:false,ignoreHTTPSErrors:true});const p=await c.newPage();await p.goto(base+'/contact.html');assert.ok(await p.locator('#contact-email').isVisible());assert.equal(await p.locator('#contact-instagram').getAttribute('href'),expected['contact-instagram']);assert.ok(await p.locator('#contact-linkedin').isVisible());await c.close();
 await writeFile('test-results/contact-report.json',JSON.stringify({viewports:results,noJavaScript:'passed'},null,2));console.log('PASS contact: four sizes, exact popup destinations, borderless links, local logos, keyboard, menu/search, RTL and no-JS');
}finally{await browser.close()}
