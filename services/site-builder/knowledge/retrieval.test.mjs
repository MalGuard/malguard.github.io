import test from 'node:test';
import assert from 'node:assert/strict';
import {searchSite,retrieveKnowledge} from '../knowledge.mjs';

test('Farsi founder question retrieves official source', () => {
  assert.ok(searchSite('بنیان‌گذار مالگارد کیست؟').some(s => s.url.endsWith('/founder.html')));
});

test('external access disabled until selected', async () => {
  const res = await retrieveKnowledge('contact', {apiKey:'test',fetcher:()=>assert.fail()});
  assert.equal(res.webStatus,'off');
});

test('upstream outage retains official results', async () => {
  const res = await retrieveKnowledge('privacy',{webSearch:true, apiKey:'test',fetcher:async()=>new Response(null,{status:503})});
  assert.equal(res.webStatus,'unavailable');
  assert.ok(res.sources.some(s=>s.url.includes('privacy')));
});

test('external result URLs must be HTTPS',async()=>{
  const res=await retrieveKnowledge('hello',{webSearch:true,apiKey:'test',fetcher:async()=>Response.json({results:[
    {url:'javascript:alert(1)',text:'bad'},{url:'https://example.com/',text:'useful'}
  ]})});
  assert.equal(res.webStatus,'ok');
  assert.equal(res.sources.at(-1).url,'https://example.com/');
  assert.ok(res.sources.every(s=>s.url.startsWith('https://')));
});

test('reference design brief uses bounded provider text and exact requested URL', async () => {
  const res=await retrieveKnowledge('Build https://www.wikipedia.org/wiki/Design.',{
    webSearch:true,apiKey:'test',fetcher:async(endpoint,opts)=>{
      assert.equal(endpoint,'https://api.exa.ai/contents');
      assert.deepEqual(JSON.parse(opts.body).urls,['https://www.wikipedia.org/wiki/Design']);
      return Response.json({results:[
        {url:'https://www.wikipedia.org/wiki/Design',title:'Design',text:'A'.repeat(3200)},
        {url:'https://other.com/',text:'extra'}
      ]});
    }
  });
  assert.equal(res.sources[0].url,'https://www.wikipedia.org/wiki/Design');
  assert.equal(res.sources[0].text.length,2000);
  assert.ok(!res.sources.some(s=>s.url.includes('other.com')));
});

test('private reference URLs and query-bearing links never enter upstream search',async()=>{
  for (const url of ['http://public.com/','https://127.0.0.1/','https://0x7f000001/', 'https://[::1]/','https://foo.local/','https://x.com/?token=s','https://user:pw@public.com/']) {
    let sent=false;
    const result=await retrieveKnowledge('Read '+url,{webSearch:true,apiKey:'test',fetcher:async()=>{sent=true;}});
    assert.equal(sent,false,url);
    assert.equal(result.webStatus,'unavailable');
  }
});
