import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhishingFeed} from './phishing-feed.js';
import {lookupReputation} from './threat-intel.js';
const response=text=>({status:200,bytes:Buffer.from(text)});
test('disabled phishing source does not send the inspected URL or initiate network work',async()=>{
 let calls=0;const lookup=createPhishingFeed({enabled:()=>false,transport:async()=>{calls++;}});
 assert.equal((await lookup('https://store.example/')).status,'unconfigured');assert.equal(calls,0);
});
test('feed lookups use a fixed bounded source and exact local URL membership',async()=>{
 let calls=0;const lookup=createPhishingFeed({enabled:()=>true,transport:async(url,options)=>{calls++;assert.equal(url,'https://raw.githubusercontent.com/openphish/public_feed/main/feed.txt');assert.equal(options.noRedirect,true);assert.equal(options.limit,2*1024*1024);return response('https://store.example/login?campaign=one\nhttps://other.example/\n');}});
 assert.equal((await lookup('https://store.example/login?campaign=one#section')).status,'listed');
 assert.equal((await lookup('https://store.example/login?campaign=two')).status,'not_found');
 assert.equal((await lookup('https://store.example/')).status,'not_found');assert.equal(calls,1);
});
test('concurrent queries coalesce refresh and expired or malformed data cannot yield a negative observation',async()=>{
 let clock=1000,calls=0,broken=false;
 const lookup=createPhishingFeed({enabled:()=>true,now:()=>clock,ttl:100,transport:async()=>{calls++;await Promise.resolve();if(broken)throw new Error('outage');return response('https://store.example/\n');}});
 const results=await Promise.all([lookup('https://store.example/'),lookup('https://other.example/')]);assert.equal(calls,1);assert.equal(results[0].status,'listed');
 clock=1200;broken=true;assert.equal((await lookup('https://store.example/')).status,'unavailable');
 for(const text of ['', '<html>not a feed</html>', 'https://store.example/\nfile:///etc/passwd']){const bad=createPhishingFeed({enabled:()=>true,transport:async()=>response(text)});assert.equal((await bad('https://store.example/')).status,'unavailable');}
});
test('independent sources preserve their results and either source can supply known-threat evidence',async()=>{
 for(const provider of ['urlhaus','openphish']){const result=await lookupReputation('https://store.example/',{urlhaus:async()=>({status:provider==='urlhaus'?'listed':'not_found',message:'Fixture URLhaus'}),phishing:async()=>({status:provider==='openphish'?'listed':'not_found',message:'Fixture phishing'})});assert.equal(result.status,'listed');assert.equal(result.sources.length,2);}
 const unavailable=await lookupReputation('https://store.example/',{urlhaus:async()=>{throw new Error('outage');},phishing:async()=>({status:'unconfigured',message:'Disabled'})});assert.equal(unavailable.status,'unavailable');assert.equal(unavailable.coverage.checked,0);
});
