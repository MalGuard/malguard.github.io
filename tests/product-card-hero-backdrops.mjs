// Product-card art reused on the destination hero only, with a dark fade.
// This suite runs on local HTTPS; never submit a form or request a remote scanner.
import assert from 'node:assert/strict';
import {chromium,webkit,launchOptions} from './browser-runtime.mjs';
const base='https://127.0.0.1:8443';
const cases=[
 {path:'/gta-guard.html',hero:'#gta-stage',asset:'gta-card-960.webp'},
 {path:'/game-scam-guard.html',hero:'.mg-card-hero--scam',asset:'scam-card-960.webp'},
 {path:'/threat-radar.html',hero:'.mg-card-hero--radar',asset:'ai-card.svg'}
];
const engineName=process.env.TEST_BROWSER||'chromium';
const browser=await (engineName==='webkit'?webkit:chromium).launch(launchOptions(engineName));
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:850},reducedMotion:'reduce'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  const page=await context.newPage();
  for(const item of cases){
   const response=await page.goto(base+item.path,{waitUntil:'domcontentloaded',timeout:25000});
   assert.equal(response?.status(),200,'missing product '+item.path);
   const result=await page.locator(item.hero).evaluate(el=>{
    const isGta=el.id==='gta-stage';
    const css=getComputedStyle(el,isGta?null:'::before');
    const rect=el.getBoundingClientRect();
    const next=el.closest('section')?.nextElementSibling;
    return {
     image:css.backgroundImage,
     cover:css.backgroundSize,
     isPositioned:getComputedStyle(el).position!=='static',
     bodyOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
     height:rect.height,
     nextHasSameBackdrop:next?.classList.contains('mg-card-hero')||false,
     heading:!!document.querySelector('main h1')
    };
   });
   assert.ok(result.image.includes(item.asset),item.path+' does not use its own actual card artwork');
   assert.ok(result.cover.includes('cover'),item.path+' image is not cover cropped');
   assert.ok(result.height>=250,item.path+' hero too short');
   assert.ok(result.isPositioned,item.path+' hero is not independently layered');
   assert.ok(result.bodyOverflow<=2,item.path+' horizontal overflow @'+width);
   assert.equal(result.nextHasSameBackdrop,false,item.path+' background leaks beyond hero');
   assert.ok(result.heading,item.path+' headline missing');
   if(item.path==='/game-scam-guard.html'){
    assert.equal(await page.locator('main h1').count(),1,'Game Scam Guard duplicated heading');
    assert.ok(await page.locator('#gameScamPreview').count(),'Web app button removed');
   }
   console.log('PASS actual product-card hero with fade',engineName,width,item.path);
  }
  await context.close();
 }
}finally{await browser.close();}
