import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

async function loadPagesModule(path){
  const content=await readFile(new URL(path,import.meta.url));
  return import('data:text/javascript;base64,'+content.toString('base64'));
}

test('Cloudflare Pages status is truthful, private and remains fail-closed',async()=>{
  const {onRequestGet}=await loadPagesModule('../functions/api/support/status.js');
  const response=await onRequestGet({env:{SUPPORT_API_ENABLED:'true',SUPABASE_URL:'synthetic'}});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'no-store');
  const body=await response.json();
  assert.equal(body.enabled,false);
  assert.equal(body.reason,'support_backend_not_connected');
  assert.equal(body.attachmentsEnabled,false);
  assert.equal(body.aiEnabled,false);
  assert.equal(body.adminEnabled,false);
  assert.equal(body.turnstileSiteKey,null);
  assert.ok(!JSON.stringify(body).includes('synthetic'));
});

test('Cloudflare ticket mutations refuse writes until authenticated backend exists',async()=>{
  const {onRequest}=await loadPagesModule('../functions/api/support/[endpoint].js');
  const result=await onRequest({
    request:new Request('https://support-preview.malguard.site/api/support/create',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({email:'example@example.test',message:'test'})
    })
  });
  assert.equal(result.status,503);
  assert.equal(result.headers.get('cache-control'),'no-store');
  const json=await result.json();
  assert.equal(json.error,'support_backend_not_connected');
  assert.equal(JSON.stringify(json).includes('example@example.test'),false);
});

test('browser ticket API uses its own same-origin Cloudflare endpoint, never Vercel',async()=>{
  const code=await readFile(new URL('../assets/support-agent.js',import.meta.url),'utf8');
  assert.match(code,/const apiBase='';/);
  assert.match(code,/support_backend_not_connected/);
  assert.match(code,/\/report\.html\?kind=bug/);
  assert.doesNotMatch(code,/const apiBase=[^\n]+https:\/\/api\.malguard\.site/);
});
