import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, publicAddress, resolvePublic, fetchPublic } from './network.js';
import { parsePage, providerStatus } from './scanner.js';
import { abuseAuthKey, malwareBazaarAuthKey, urlhausAuthKey, createBazaarClient, mapBazaarResult, lookupUrl } from './threat-intel.js';

test('URL normalization accepts both web protocols and rejects credentials, ports and non-web schemes', () => {
  assert.equal(normalizeUrl('  example.com/page#section ').href, 'https://example.com/page');
  assert.equal(normalizeUrl('http://example.com').protocol, 'http:');
  for (const url of ['file:///etc/passwd','javascript:alert(1)','ftp://example.com','https://a:b@example.com','https://example.com:8080','']) assert.throws(()=>normalizeUrl(url));
});

test('private, local, metadata, reserved and mapped-private addresses are blocked', () => {
  for (const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.1','169.254.169.254','100.64.0.1','0.0.0.0','192.0.2.1','224.0.0.1','::1','fe80::1','fc00::1','::ffff:127.0.0.1','::ffff:10.0.0.1','2001:db8::1','not-an-ip']) assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress('8.8.8.8'), true);
  assert.equal(publicAddress('2606:4700:4700::1111'), true);
});

test('all DNS answers must be public, and alternative loopback URL spellings are rejected', async () => {
  const resolver = async()=>[{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}];
  await assert.rejects(resolvePublic(new URL('https://example.com'),resolver));
  for (const url of ['http://localhost','http://2130706433','http://0x7f000001','http://[::ffff:127.0.0.1]','https://service.internal']) await assert.rejects(resolvePublic(normalizeUrl(url)));
  const pinned=await resolvePublic(new URL('https://example.com'),async()=>[{address:'8.8.8.8',family:4}]);
  assert.equal(pinned.address,'8.8.8.8');
});

test('page evidence records download links as excluded without retrieving file content', () => {
  const html=Buffer.from('<html><head><title>Game Store</title><meta name="description" content="Games and mods"></head><body><h1>FC mods</h1><h2>Downloads</h2><a href="/mods/mod.zip">A mod</a><a href="/mods/mod.zip">Duplicate</a><a href="https://other.example/app.apk">App</a><a download href="/download?id=1">Installer</a><a href="/about">About</a><script>free gems</script></body></html>');
  const evidence=parsePage(html,'https://store.example/index',{'content-type':'text/html'});
  assert.equal(evidence.title,'Game Store');
  assert.equal(evidence.description,'Games and mods');
  assert.deepEqual(evidence.headings,['FC mods','Downloads']);
  assert.equal(evidence.fileCount,0);
  assert.deepEqual(evidence.files,[]);
  assert.equal(evidence.linkInventory.links.filter(link=>link.kind==='file').length,4);
  assert.ok(!evidence.signals.some(signal=>signal.code==='file_links_excluded'));
  assert.equal(evidence.signals.some(s=>s.title==='ادعاهای نیازمند احتیاط'),false);
  assert.ok(!evidence.excerpt.includes('free gems'));
});

test('HTTP and suspicious claims create caution signals without claiming a malware verdict', () => {
  const evidence=parsePage(Buffer.from('<title>FC crack</title><body>Unlimited coins<input type="password"></body>'),'http://store.example');
  assert.equal(evidence.signals.filter(s=>s.level==='warning').length,2);
  assert.equal(evidence.signals.some(s=>s.level==='danger'),false);
  assert.equal(evidence.signals.some(s=>s.title==='فرم ورود شناسایی شد'),true);
});

test('website provider status exposes URLhaus and optional remote evidence sources without keys', () => {
  assert.equal(typeof providerStatus().urlhaus,'boolean');
  assert.deepEqual(Object.keys(providerStatus()),['urlhaus','browserbase','tinyfish']);
});

const sampleHash = 'a'.repeat(64);
const apiResponse = payload => ({ok:true,status:200,text:async()=>JSON.stringify(payload)});

test('URLhaus checks use the fixed authenticated endpoint and distinguish absent reputation from a threat', async () => {
  let sent;
  const url = 'https://example.com/';
  const query = async payload => lookupUrl(url,{authKeyProvider:()=> 'fixture-key',transport:async (endpoint,options)=> {
    sent={endpoint,options}; return {status:200,bytes:Buffer.from(JSON.stringify(payload))};
  }});
  const unknown = await query({query_status:'no_results'});
  assert.equal(unknown.status,'not_found');
  assert.match(unknown.message,/به معنی امن بودن نیست/);
  assert.equal(sent.endpoint,'https://urlhaus-api.abuse.ch/v1/url/');
  assert.equal(sent.options.noRedirect,true);
  assert.equal(sent.options.headers['Auth-Key'],'fixture-key');
  assert.equal(new URLSearchParams(sent.options.body).get('url'),url);
  assert.equal((await query({query_status:'ok',url,threat:'fixture'})).status,'listed');
  assert.equal((await query({query_status:'ok',url:'https://different.example/'})).status,'unavailable');
  assert.equal((await query({query_status:'ok'})).status,'unavailable');
});

test('provider authentication failures and malformed URLhaus replies never become negative threat results', async () => {
  const url = 'https://example.com/';
  assert.equal((await lookupUrl(url,{authKeyProvider:()=>null,transport:async()=>{throw new Error('must not fetch');}})).status,'unconfigured');
  for (const status of [401,403]) {
    assert.equal((await lookupUrl(url,{authKeyProvider:()=> 'fixture',transport:async()=>{throw Object.assign(new Error('http'),{remoteStatus:status});}})).status,'auth_error');
    assert.equal(mapBazaarResult({status:'unavailable',reason:`http_${status}`}).status,'auth_error');
  }
  assert.equal((await lookupUrl(url,{authKeyProvider:()=> 'fixture',transport:async()=>({status:200,bytes:Buffer.from('invalid json')})})).status,'unavailable');
});

test('existing GTA client reads the real nested MalwareBazaar response and authenticates a metadata query', async () => {
  let sent;
  const client = createBazaarClient({authKeyProvider:async()=>'fixture-key',fetchImpl:async (url,request)=>{sent={url,request};return apiResponse({query_status:'ok',data:[{sha256_hash:sampleHash,signature:'FixtureFamily',file_type:'exe',tags:['fixture']}]});}});
  const mapped=mapBazaarResult(await client.lookupSha256(sampleHash));
  assert.equal(mapped.status,'listed');
  assert.equal(mapped.signature,'FixtureFamily');
  assert.equal(sent.url,'https://mb-api.abuse.ch/api/v1/');
  assert.equal(sent.request.headers['Auth-Key'],'fixture-key');
  assert.equal(new URLSearchParams(sent.request.body).get('query'),'get_info');
  assert.equal(new URLSearchParams(sent.request.body).get('hash'),sampleHash);
});

test('existing GTA client rejects a response for a different hash', async () => {
  const client=createBazaarClient({authKeyProvider:async()=>'fixture-key',fetchImpl:async()=>apiResponse({query_status:'ok',data:[{sha256_hash:'b'.repeat(64)}]})});
  const result=mapBazaarResult(await client.lookupSha256(sampleHash));
  assert.equal(result.status,'unavailable');
  assert.equal(result.reason,'hash_mismatch');
});

test('missing key and invalid hashes never initiate provider network requests', async () => {
  let calls=0;
  const client=createBazaarClient({authKeyProvider:async()=>null,fetchImpl:async()=>{calls++;throw new Error('must not fetch');}});
  assert.equal(mapBazaarResult(await client.lookupSha256(sampleHash)).status,'unconfigured');
  assert.equal((await client.lookupSha256('invalid')).status,'invalid_hash');
  assert.equal(calls,0);
});

test('unknown hash stays inconclusive and rejected provider credentials are reported distinctly', async () => {
  for(const [query,status] of [['hash_not_found','not_found'],['no_api_key','auth_error']]){
    const client=createBazaarClient({authKeyProvider:async()=>'fixture-key',fetchImpl:async()=>apiResponse({query_status:query})});
    const result=mapBazaarResult(await client.lookupSha256(sampleHash));
    assert.equal(result.status,status);
    if(status==='not_found')assert.match(result.message,/به معنی امن بودن نیست/);
  }
});

test('original GTA credential variable is compatible and the new variable takes precedence', () => {
  const previous=process.env.ABUSECH_AUTH_KEY;const previousLegacy=process.env.MALGUARD_ABUSECH_AUTH_KEY;
  try {
    delete process.env.ABUSECH_AUTH_KEY;
    process.env.MALGUARD_ABUSECH_AUTH_KEY='legacy-fixture';
    assert.equal(abuseAuthKey(),'legacy-fixture');
    assert.deepEqual(providerStatus(),{urlhaus:true,browserbase:false,tinyfish:false});
    process.env.ABUSECH_AUTH_KEY='new-fixture';
    assert.equal(abuseAuthKey(),'new-fixture');
  } finally {
    if(previous===undefined)delete process.env.ABUSECH_AUTH_KEY;else process.env.ABUSECH_AUTH_KEY=previous;
    if(previousLegacy===undefined)delete process.env.MALGUARD_ABUSECH_AUTH_KEY;else process.env.MALGUARD_ABUSECH_AUTH_KEY=previousLegacy;
  }
});

test('bounded GTA-client timeout aborts the injected transport and gives an inconclusive result', async () => {
  const client=createBazaarClient({authKeyProvider:async()=>'fixture-key',timeoutMs:250,fetchImpl:async(url,request)=>new Promise((resolve,reject)=>request.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true}))});
  const result=mapBazaarResult(await client.lookupSha256(sampleHash));
  assert.equal(result.status,'unavailable');
  assert.equal(result.reason,'timeout');
});

test('a separate MalwareBazaar key authenticates hash queries without replacing the URLhaus key', async () => {
  const keys = ['ABUSECH_AUTH_KEY','MALWAREBAZAAR_AUTH_KEY','MALGUARD_ABUSECH_AUTH_KEY'];
  const previous = Object.fromEntries(keys.map(key => [key,process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    process.env.MALWAREBAZAAR_AUTH_KEY = 'bazaar-fixture';
    assert.deepEqual(providerStatus(),{urlhaus:false,browserbase:false,tinyfish:false});
    let sent;
    const client = createBazaarClient({fetchImpl:async (url,request)=> {
      sent = request.headers['Auth-Key'];
      return apiResponse({query_status:'hash_not_found'});
    }});
    process.env.ABUSECH_AUTH_KEY = 'urlhaus-fixture';
    assert.equal(abuseAuthKey(),'urlhaus-fixture');
    assert.equal(malwareBazaarAuthKey(),'bazaar-fixture');
    await client.lookupSha256(sampleHash);
    assert.equal(sent,'bazaar-fixture');
    delete process.env.MALWAREBAZAAR_AUTH_KEY;
    await client.lookupSha256(sampleHash);
    assert.equal(sent,'urlhaus-fixture');
    delete process.env.ABUSECH_AUTH_KEY;
    process.env.MALGUARD_ABUSECH_AUTH_KEY = 'legacy-fixture';
    await client.lookupSha256(sampleHash);
    assert.equal(sent,'legacy-fixture');
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});

test('public network transport respects an already-aborted request before connecting', async () => {
  const controller=new AbortController();controller.abort();
  await assert.rejects(fetchPublic('https://example.com',{signal:controller.signal}),{name:'AbortError'});
});

test('URLhaus can explicitly reuse the existing abuse.ch Bazaar key without changing either secret', async () => {
  const keys=['ABUSECH_AUTH_KEY','MALWAREBAZAAR_AUTH_KEY','MALGUARD_ABUSECH_AUTH_KEY','URLHAUS_AUTH_KEY_SOURCE'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  try {
    for(const key of keys)delete process.env[key];
    process.env.ABUSECH_AUTH_KEY='original-fixture';
    process.env.MALWAREBAZAAR_AUTH_KEY='valid-shared-fixture';
    assert.equal(urlhausAuthKey(),'original-fixture');
    process.env.URLHAUS_AUTH_KEY_SOURCE='malwarebazaar';
    let sent;
    const result=await lookupUrl('https://example.com/',{transport:async(endpoint,options)=> {
      sent={endpoint,options};return {status:200,bytes:Buffer.from('{"query_status":"no_results"}')};
    }});
    assert.equal(sent.endpoint,'https://urlhaus-api.abuse.ch/v1/url/');
    assert.equal(sent.options.noRedirect,true);
    assert.equal(sent.options.headers['Auth-Key'],'valid-shared-fixture');
    assert.equal(result.status,'not_found');
    assert.equal(process.env.ABUSECH_AUTH_KEY,'original-fixture');
    assert.equal(malwareBazaarAuthKey(),'valid-shared-fixture');
    delete process.env.ABUSECH_AUTH_KEY;
    assert.deepEqual(providerStatus(),{urlhaus:true,browserbase:false,tinyfish:false});
    delete process.env.MALWAREBAZAAR_AUTH_KEY;
    assert.deepEqual(providerStatus(),{urlhaus:false,browserbase:false,tinyfish:false});
    process.env.ABUSECH_AUTH_KEY='original-fixture';
    assert.equal(urlhausAuthKey(),undefined,'Explicit source never silently substitutes another secret');
    delete process.env.URLHAUS_AUTH_KEY_SOURCE;
    assert.equal(urlhausAuthKey(),'original-fixture');
    const denied=await lookupUrl('https://example.com/',{transport:async()=>({status:200,bytes:Buffer.from('{"query_status":"unknown_auth_key"}')})});
    assert.equal(denied.status,'auth_error');
  } finally {
    for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}
  }
});

test('website result is green-safe only for retrieved HTML with no warning or threat signal', async()=>{
  const report=await (await import('./scanner.js')).scanSite('https://safe.example/',{
    validate:async()=>{},lookup:async()=>({status:'not_found',message:'No known URLhaus report; this is not a safety guarantee.'}),
    transport:async()=>({status:200,headers:{'content-type':'text/html'},bytes:Buffer.from('<title>Safe fixture</title><p>Welcome</p>'),url:'https://safe.example/',redirects:[]}),
    preview:async()=>{throw new Error('Basic scan must not start the cloud browser');}
  });
  assert.equal(report.status,'limited');
  assert.equal(report.preview.status,'skipped');
});

test('unresolvable domains are never reported as safe',async()=>{
  const report=await (await import('./scanner.js')).scanSite('https://missing.example/',{
    validate:async()=>{throw Object.assign(new Error('not found'),{code:'ENOTFOUND'});},
    lookup:async()=>({status:'not_found',message:'No known URLhaus report; this is not a safety guarantee.'})
  });
  assert.equal(report.status,'unavailable');
  assert.equal(report.pageFetch.reason,'domain_not_found');
  assert.match(report.pageFetch.detail,/دامنه پیدا نشد/);
});

test('a direct file result is unavailable and is never sent to the browser preview',async()=>{
  let previews=0;
  const report=await (await import('./scanner.js')).scanSite('https://download.example/track.mp3',{
    validate:async()=>{},lookup:async()=>({status:'not_found',message:'No known URLhaus report; this is not a safety guarantee.'}),
    transport:async()=>({status:200,headers:{'content-type':'audio/mpeg'},bytes:Buffer.alloc(0),url:'https://download.example/track.mp3',redirects:[]}),
    preview:async()=>{previews++;return {status:'done'};},allowCloudPreview:true
  });
  assert.equal(report.status,'unavailable');assert.equal(report.fileScanExcluded,true);assert.equal(previews,0);
});

test('cloud browser preview requires the explicit advanced website selection',async()=>{
  let previews=0;const options={validate:async()=>{},lookup:async()=>({status:'not_found',message:'No known URLhaus report; this is not a safety guarantee.'}),transport:async()=>({status:200,headers:{'content-type':'text/html'},bytes:Buffer.from('<title>Preview fixture</title>'),url:'https://preview.example/',redirects:[]}),preview:async()=>{previews++;return {status:'done',image:'data:image/jpeg;base64,fixture',detail:'Fixture'};}};
  const basic=await (await import('./scanner.js')).scanSite('https://preview.example/',options);assert.equal(basic.preview.status,'skipped');assert.equal(previews,0);
  const advanced=await (await import('./scanner.js')).scanSite('https://preview.example/',{...options,allowCloudPreview:true});assert.equal(advanced.preview.status,'done');assert.equal(previews,1);
});

test('known threats never start Browserbase or TinyFish, while unknown public HTML may request the selected source', async()=>{
  const page={status:200,headers:{'content-type':'text/html'},bytes:Buffer.from('<title>Public fixture</title>'),url:'https://public.example/',redirects:[]};
  let browserbase=0,tinyfish=0;
  const known=await (await import('./scanner.js')).scanSite(page.url,{validate:async()=>{},allowCloudPreview:true,browserMode:'browserbase',lookup:async()=>({status:'listed',message:'Known fixture threat'}),transport:async()=>page,browserbase:async()=>{browserbase++;return {status:'done'};},tinyfish:async()=>{tinyfish++;return {status:'done'};}});
  assert.equal(known.status,'danger');assert.equal(browserbase,0);assert.equal(tinyfish,0);
  const events=[];
  const unknown=await (await import('./scanner.js')).scanSite(page.url,{validate:async()=>{},allowCloudPreview:true,browserMode:'browserbase',lookup:async()=>({status:'not_found',message:'No known URLhaus report; this is not a safety guarantee.'}),transport:async()=>page,browserbase:async(_url,{onLiveReady})=>{browserbase++;onLiveReady({liveUrl:'https://live.example/view'});return {status:'done',provider:'browserbase',liveUrl:'https://live.example/view',detail:'Fixture live view'};},onEvent:event=>events.push(event)});
  assert.equal(browserbase,1);assert.equal(unknown.remote.browserbase.status,'done');assert.equal(unknown.preview.status,'skipped');assert.equal(events.some(event=>event.liveUrl==='https://live.example/view'),true);
});
