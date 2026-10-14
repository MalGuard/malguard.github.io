import { readFile, writeFile, mkdir } from 'node:fs/promises';
for (const key of ['ABUSECH_AUTH_KEY','MALWAREBAZAAR_AUTH_KEY','MALGUARD_ABUSECH_AUTH_KEY','GUARD_REPORT_SECRET','VERCEL_OIDC_TOKEN','VERCEL_TOKEN']) {
  if (process.env[key]) throw new Error('Unexpected credential in isolated renderer');
}
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/vercel/sandbox/browsers';
const {chromium} = await import('/vercel/sandbox/node_modules/playwright/index.mjs');
const job = JSON.parse(await readFile(process.argv[2],'utf8'));
if (typeof job.html !== 'string' || job.html.length > 2*1024*1024) throw new Error('Invalid preview job');
const browser = await chromium.launch({headless:true,args:['--no-sandbox','--disable-background-networking','--disable-extensions'],timeout:5000});
try {
  // Firecracker VM isolation + deny-all egress are the boundary; this VM has no app keys.
  const context = await browser.newContext({viewport:{width:1280,height:800},javaScriptEnabled:false,acceptDownloads:false,serviceWorkers:'block'});
  const page = await context.newPage();
  let blockedRequests=0;
  await context.route('**/*',route=> {
    const request=route.request();
    if (request.url()===job.url && request.resourceType()==='document' && request.frame()===page.mainFrame()) return route.fulfill({status:200,contentType:'text/html; charset=utf-8',headers:{'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src 'none'; object-src 'none'; frame-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'"},body:job.html});
    blockedRequests++; return route.abort();
  });
  await page.goto(job.url,{waitUntil:'domcontentloaded',timeout:6000});
  const jpeg=await page.screenshot({type:'jpeg',quality:55,animations:'disabled',timeout:3000});
  await mkdir('/tmp/guard-preview-output',{recursive:true});
  await writeFile('/tmp/guard-preview-output/preview.jpg',jpeg);
  await writeFile('/tmp/guard-preview-output/preview-check.json',JSON.stringify({title:await page.title(),pageScriptsExecuted:await page.evaluate(()=>document.body.dataset.guardScriptRan==='yes'),blockedRequests}));
} finally {await browser.close();}
