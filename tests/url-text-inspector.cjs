const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
vm.runInThisContext(fs.readFileSync('assets/url-text-inspector.js','utf8'));
const inspect=MalGuardURL.inspect;
for(const host of ['poblox.com','rbolox.com','r0blox.com','robloxx.com','roblox.com.evil.test','roblox-login.test'])assert(inspect(host).signals.some(s=>s.includes('roblox')),host);
for(const host of ['roblox.com','www.roblox.com','roblox.com.','create.roblox.com','example.com'])assert(!inspect(host).signals.some(s=>s.includes('lookalike')),host);
assert(inspect('https://roblox.com@evil.test').signals.some(s=>s.includes('credentials')));assert(!inspect('https://roblox.com@evil.test').onlineAllowed);
assert(inspect('https://[::1]:8888').signals.length>=2);assert(inspect('https://xn--80ak6aa92e.com').signals.some(s=>s.includes('Punycode')));
assert.throws(()=>inspect(''));assert.throws(()=>inspect('x'.repeat(8193)));assert(!inspect('javascript:alert(1)').onlineAllowed);
console.log('PASS: 18 local-inspection regression assertions.');
