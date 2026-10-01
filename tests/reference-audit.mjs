import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('reference-results',{recursive:true});
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:1280,height:850},reducedMotion:'reduce'});
const page=await context.newPage();
const ownPaths=['/','/products.html','/gta-guard.html','/tools.html','/scan-url.html','/ai-intelligence.html','/malware-ai.html','/malware-ai-windows.html','/scan-mods.html','/download.html','/app.html','/trust.html','/privacy.html','/about.html','/founder.html','/docs.html','/labs.html','/support.html','/sandbox-help.html','/ios-preview/','/research/repackaged-mod.html'];
const own=[];
for(const path of ownPaths){
 try{
  await page.goto('https://malguard.github.io'+path,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForTimeout(600);
  const entry=page.locator('#sitePublicEntry');if(await entry.isVisible())await entry.click();
  const data=await page.evaluate(()=>({title:document.title,h1:document.querySelector('main h1')?.textContent,headings:[...document.querySelectorAll('main h2,main h3')].map(e=>e.textContent),buttons:[...document.querySelectorAll('main button')].map(e=>({id:e.id,text:e.textContent.trim().slice(0,60)})),links:[...document.querySelectorAll('main a')].map(e=>({text:e.textContent.trim().slice(0,60),href:e.getAttribute('href')})),typeface:getComputedStyle(document.querySelector('main h1')||document.body).fontFamily,background:getComputedStyle(document.body).backgroundColor,animations:document.getAnimations().length,overflow:document.documentElement.scrollWidth>innerWidth}));
  own.push({path,...data});
  if(path==='/'){
   console.log('AUDIT_IMAGE home '+(await page.screenshot({type:'jpeg',quality:42})).toString('base64'));
   await page.locator('#products').scrollIntoViewIfNeeded();await page.waitForTimeout(200);
   console.log('AUDIT_IMAGE products '+(await page.screenshot({type:'jpeg',quality:42})).toString('base64'));
  }
 }catch(e){own.push({path,error:e.message});}
}
console.log('SITE_AUDIT '+JSON.stringify(own));
await writeFile('reference-results/site-audit.json',JSON.stringify(own,null,2));
const refs=[
 ['socket','https://socket.dev/','software supply-chain security'],
 ['snyk','https://snyk.io/','developer security'],
 ['cloudflare','https://www.cloudflare.com/','security platform'],
 ['proton','https://proton.me/','privacy and security'],
 ['sentinelone','https://www.sentinelone.com/','endpoint security'],
 ['lusion','https://lusion.co/','creative 3D motion reference'],
 ['activetheory','https://activetheory.net/','immersive motion reference'],
 ['stripe','https://stripe.com/','typography and interaction reference'],
 ['linear','https://linear.app/','product UI and lighting reference'],
 ['gsap','https://gsap.com/','scroll and motion reference']
];
for(const [name,url,category]of refs){
 try{
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});await page.waitForTimeout(1600);
  const info=await page.evaluate(()=>({title:document.title,headings:[...document.querySelectorAll('h1,h2')].slice(0,9).map(e=>e.textContent.trim().slice(0,160)),fonts:[...new Set([...document.querySelectorAll('h1,h2,p,button')].slice(0,40).map(e=>getComputedStyle(e).fontFamily))],background:getComputedStyle(document.body).backgroundColor,canvases:document.querySelectorAll('canvas').length,videos:document.querySelectorAll('video').length,animations:document.getAnimations().length,buttons:[...document.querySelectorAll('button')].slice(0,10).map(e=>e.textContent.trim().slice(0,60))}));
  console.log('REFERENCE_DATA '+JSON.stringify({name,url,category,...info}));
  await page.screenshot({path:'reference-results/'+name+'.jpg',type:'jpeg',quality:42});
  console.log('REFERENCE_IMAGE '+name+' '+(await page.screenshot({type:'jpeg',quality:35})).toString('base64'));
 }catch(e){console.log('REFERENCE_DATA '+JSON.stringify({name,url,category,error:e.message}));}
}
await browser.close();
