
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base='https://127.0.0.1:8443';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch();
for(const width of [390,1440]){
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:width===390?844:1000},reducedMotion:'no-preference'});
 await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 const page=await context.newPage();
 await page.goto(base);await page.evaluate(()=>document.fonts.ready);
 await page.locator('#sitePublicEntry').click();
 await page.waitForTimeout(750);
 async function shot(name){await page.screenshot({path:'test-results/visual-'+width+'-'+name+'.jpg',type:'jpeg',quality:65});console.log('SCREENSHOT '+width+'-'+name);}
 await shot('hero');
 await page.locator('#openCore').click();await page.waitForTimeout(1200);await page.locator('#securityScene').scrollIntoViewIfNeeded();await shot('shield-open');
 await page.locator('#how-it-works').scrollIntoViewIfNeeded();await page.waitForTimeout(900);await shot('layers');
 await page.locator('#products').scrollIntoViewIfNeeded();await page.waitForTimeout(900);await shot('collection');
 await page.locator('#inspectProduct0').click();await page.waitForTimeout(220);await shot('transition');await page.waitForTimeout(700);await shot('card-back');await page.keyboard.press('Escape');await page.waitForTimeout(130);await shot('return');await page.waitForTimeout(400);
 await page.locator('#developer').scrollIntoViewIfNeeded();await page.waitForTimeout(900);await shot('source');
 for(const path of ['products','gta-guard','tools']){
  await page.goto(base+'/'+path+'.html');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(300);await shot(path);
 }
 console.log('DESIGN_METRICS '+JSON.stringify({width,...await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,fonts:document.fonts.status,transfer:performance.getEntriesByType('resource').reduce((n,r)=>n+(r.transferSize||0),0),resources:performance.getEntriesByType('resource').length}))}));
 await context.close();
}
await browser.close();
