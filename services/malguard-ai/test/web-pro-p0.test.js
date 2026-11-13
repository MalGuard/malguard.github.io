import test from 'node:test';
import assert from 'node:assert/strict';
import {modelsApiRoot,PRODUCTION_MODELS_ORIGIN} from '../../../ai/api-root.mjs';
import {buildSearchQuery} from '../../../ai/search-query.mjs';
import {prepareStreamingMarkdown} from '../../../ai/code-view.mjs';
import {callCFModel} from '../../../ai/cloudflare-models.mjs';
import {createApp} from '../server/app.js';
import {readFileSync} from 'node:fs';

test('preview frontend hosts talk to the matching malware-ai preview, production stays on models.malguard.site',()=>{
  assert.equal(modelsApiRoot('malguard.site'),PRODUCTION_MODELS_ORIGIN);
  assert.equal(modelsApiRoot('www.malguard.site'),PRODUCTION_MODELS_ORIGIN);
  assert.equal(modelsApiRoot('malguard.github.io'),PRODUCTION_MODELS_ORIGIN);
  assert.equal(modelsApiRoot('localhost'),PRODUCTION_MODELS_ORIGIN);
  assert.equal(
    modelsApiRoot('malguard-galaxy-mobile-test-git-web-pro-p0-mcazarderakhsh-4187.vercel.app'),
    'https://malware-ai-git-web-pro-p0-mcazarderakhsh-4187.vercel.app'
  );
  assert.equal(
    modelsApiRoot('malguard-galaxy-mobile-test-abc12def-mcazarderakhsh-4187.vercel.app'),
    'https://malware-ai-git-web-pro-p0-mcazarderakhsh-4187.vercel.app'
  );
  assert.equal(modelsApiRoot('unrelated.vercel.app'),PRODUCTION_MODELS_ORIGIN);
});

test('search query uses the full question and recent conversation, not only the first clipped line',()=>{
  const query=buildSearchQuery('What is the capital of France?\nPlease cite sources.',[
    {role:'user',content:'We were discussing European cities.'},
    {role:'assistant',content:'Sure.'}
  ]);
  assert.match(query,/capital of France/);
  assert.match(query,/European cities/);
  assert.ok(!/[{}<>]/.test(query));
  const punct=buildSearchQuery('قیمت دلار امروز چند است؟');
  assert.match(punct,/دلار/);
  const embedded=buildSearchQuery('Fix the login form.\n```\nBuild source below:\nprivate code\n```',[],{clientQuery:'Fix the login form.'});
  assert.equal(embedded,'Fix the login form.');
  assert.doesNotMatch(embedded,/private code/);
});

test('open fences render as closed code during streaming and partial tables stay stable',()=>{
  const fenced=prepareStreamingMarkdown('Intro\n```js\nconst n = 1;');
  assert.match(fenced,/```js\nconst n = 1;\n```$/);
  const table=prepareStreamingMarkdown('| Name | Count |\n| Ada | 2 |');
  assert.match(table,/\|\s*---/);
  assert.equal(prepareStreamingMarkdown('```js\nconst n = 1;\n```'),'```js\nconst n = 1;\n```');
});

test('legacy chat without a session returns 401 sign_in_required',async t=>{
  const server=createApp({enabled:true,log:()=>{}}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const base=`http://127.0.0.1:${server.address().port}`;
  const r=await fetch(base+'/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://malguard.github.io'},body:JSON.stringify({message:'hello',mode:'chat',consent:{modelShare:true}})});
  assert.equal(r.status,401);
  assert.equal((await r.json()).error,'sign_in_required');
});

test('cloud chat streams tokens from SSE without waiting for a final JSON body',async()=>{
  const chunks=[];
  const events=[
    'event: status\ndata: {"phase":"search"}\n\n',
    'event: token\ndata: {"text":"Hello"}\n\n',
    'event: token\ndata: {"text":" world"}\n\n',
    'event: done\ndata: {"text":"Hello world","model":"gpt-oss-20b","provider":"groq","modelId":"chat_flash"}\n\n'
  ].join('');
  const result=await callCFModel({
    mode:'chat',model:'chat_flash',message:'سلام',history:[],sessionToken:'synthetic-session-valid-user',
    stream:true,onToken:text=>chunks.push(text),
    fetchImpl:async()=>new Response(events,{status:200,headers:{'Content-Type':'text/event-stream'}})
  });
  assert.equal(result.text,'Hello world');
  assert.deepEqual(chunks,['Hello','Hello world']);
  assert.equal(result.provider,'groq');
});

test('preview CSP and Web Pro badge are present on the AI shell',()=>{
  const html=readFileSync(new URL('../../../ai/index.html',import.meta.url),'utf8');
  assert.match(html,/malware-ai-git-web-pro-p0-mcazarderakhsh-4187\.vercel\.app/);
  assert.match(html,/web-pro-badge/);
  assert.match(html,/id="stop-generation"/);
  assert.match(html,/alt="MalGuard AI"/);
});
test('sidebar Settings is translated in fa and /ai/ CSP still overrides ACAO without dropping connect-src',()=>{
  const nav=readFileSync(new URL('../../../ai/navigation.mjs',import.meta.url),'utf8');
  assert.match(nav,/settingsLabel/);
  assert.match(nav,/const settingsWord=fa\?'تنظیمات':'Settings'/);
  assert.match(nav,/settingsSummary.setAttribute\('aria-label',settingsWord\)/);
  const vercel=JSON.parse(readFileSync(new URL('../../../vercel.json',import.meta.url),'utf8'));
  const ai=vercel.headers.find(h=>h.source==='/ai/(.*)');
  assert.ok(ai);
  const acao=ai.headers.find(h=>h.key==='Access-Control-Allow-Origin');
  assert.equal(acao?.value,'');
  const csp=ai.headers.find(h=>h.key==='Content-Security-Policy')?.value||'';
  assert.match(csp,/https:\/\/models\.malguard\.site/);
  assert.match(csp,/malware-ai-git-web-pro-p0-mcazarderakhsh-4187\.vercel\.app/);
});
