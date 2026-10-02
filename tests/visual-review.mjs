import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base='https://127.0.0.1:8443';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch();
const metrics=[];
for(const width of [390,1440]){
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:width===390?844:1000},reducedMotion:'no-preference'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.evaluate(()=>document.fonts.ready);
  await page.locator('#sitePublicEntry').click();
  await page.waitForFunction(()=>document.documentElement.dataset.spaceReady==='true');
  async function shot(name){const r=await page.locator('.space-card.is-active').boundingBox();if(!r||r.y<70||r.y+r.height>innerHeight-6)throw new Error('Active card leaves viewport at '+width+' '+name+': '+JSON.stringify(r));await page.screenshot({path:'test-results/visual-'+width+'-'+name+'.jpg',type:'jpeg',quality:72});console.log('SCREENSHOT '+width+'-'+name);}
  async function go(i){await page.locator(`[data-space-dot="${i}"]`).click();await page.waitForFunction(n=>document.documentElement.dataset.spaceStation===String(n),i,{timeout:5000});}
  await shot('first-view');
  await page.locator('#openCore').click();await page.waitForTimeout(180);await shot('shield-open');
  await go(4);await page.waitForTimeout(260);await shot('story-mid');
  await go(3);await page.locator('#inspectProduct0').click();await page.waitForTimeout(430);await shot('flipped-card');
  const m=await page.evaluate(()=>({
    overflow:document.documentElement.scrollWidth>innerWidth,
    fonts:document.fonts.status,
    transfer:performance.getEntriesByType('resource').reduce((n,r)=>n+(r.transferSize||0),0),
    resources:performance.getEntriesByType('resource').length,
    frameAverage:Number(document.documentElement.dataset.spaceFrameAverage||0),
    quality:document.documentElement.dataset.spaceQuality,
    station:document.documentElement.dataset.spaceStation
  }));
  if(errors.length)throw new Error('Page errors: '+errors.join(' | '));
  if(m.overflow)throw new Error('Horizontal overflow at '+width+'px');
  metrics.push({width,...m});console.log('DESIGN_METRICS '+JSON.stringify({width,...m}));
  await context.close();
}
await writeFile('test-results/visual-metrics.json',JSON.stringify(metrics,null,2));
await browser.close();
