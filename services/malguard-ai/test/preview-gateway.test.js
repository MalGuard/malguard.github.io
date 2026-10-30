import test from 'node:test';
import assert from 'node:assert/strict';
import {gatewayEndpoint} from '../server/provider-gateway.js';

const production='https://malware-ai-gray.vercel.app/api/malguard-assistant';
const preview='https://malware-8hnlurndr-mcazarderakhsh-4187.vercel.app/api/malguard-assistant';
test('Production does not honor preview URL overrides',()=>{
 assert.equal(gatewayEndpoint({VERCEL_ENV:'production',MALGUARD_AI_PREVIEW_GATEWAY_URL:preview}),production);
 assert.equal(gatewayEndpoint({VERCEL_ENV:'development',MALGUARD_AI_PREVIEW_GATEWAY_URL:preview}),production);
});
test('Preview accepts only scoped Vercel deployment URL',()=>{
 assert.equal(gatewayEndpoint({VERCEL_ENV:'preview',MALGUARD_AI_PREVIEW_GATEWAY_URL:preview}),preview);
 assert.equal(gatewayEndpoint({VERCEL_ENV:'preview'}),production);
});
test('Reject arbitrary external destinations and polluted preview URLs',()=>{
 for(const bad of [
  'https://evil.com/api/malguard-assistant',
  'http://malware-8hnlurndr-mcazarderakhsh-4187.vercel.app/api/malguard-assistant',
  'https://malware-8hnlurndr-mcazarderakhsh-4187.vercel.app/other',
  'https://malware-8hnlurndr-mcazarderakhsh-4187.vercel.app/api/malguard-assistant?token=x',
  'https://malware-8hnlurndr-mcazarderakhsh-4187.vercel.app.evil.com/api/malguard-assistant',
  'https://user:pass@malware-8hnlurndr-mcazarderakhsh-4187.vercel.app/api/malguard-assistant',
  'https://malware-8hnlurndr-mcazarderakhsh-4187.vercel.app:444/api/malguard-assistant'
 ]){
  assert.throws(()=>gatewayEndpoint({VERCEL_ENV:'preview',MALGUARD_AI_PREVIEW_GATEWAY_URL:bad}),{status:503});
 }
});
