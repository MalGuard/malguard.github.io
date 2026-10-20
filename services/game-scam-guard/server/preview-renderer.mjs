// Shared by the isolated VM worker and harmless local verification. The only
// document fulfilled is the already-guarded HTML; no destination is navigated
// over the network and no website JavaScript, frame, form or download runs.
export async function renderIsolatedSnapshot({chromium,url,html,executablePath,launchTimeout=10000}){
 const address=new URL(url);
 if(!['http:','https:'].includes(address.protocol)||address.username||address.password||typeof html!=='string'||Buffer.byteLength(html)>2*1024*1024)throw new Error('Invalid isolated preview input');
 const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-extensions'],timeout:Math.min(20000,launchTimeout)});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:800},javaScriptEnabled:false,acceptDownloads:false,serviceWorkers:'block'});
  const page=await context.newPage();let blockedRequests=0,documentServed=false;
  await context.route('**/*',route=>{
   const request=route.request();
   if(!documentServed&&request.url()===url&&request.resourceType()==='document'&&request.frame()===page.mainFrame()){
    documentServed=true;
    return route.fulfill({status:200,contentType:'text/html; charset=utf-8',headers:{'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src 'none'; object-src 'none'; frame-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'"},body:html});
   }
   blockedRequests++;return route.abort();
  });
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:6000});
  const jpeg=await page.screenshot({type:'jpeg',quality:55,animations:'disabled',timeout:3000});
  const telemetry={javaScriptEnabled:false,networkPolicy:'deny-all',siteScriptsExecuted:await page.evaluate(()=>document.body?.dataset.guardScriptRan==='yes'),blockedRequests,documentServed};
  return {jpeg,telemetry};
 }finally{await browser.close();}
}
