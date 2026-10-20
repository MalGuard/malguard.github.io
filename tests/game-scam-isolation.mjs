// Real browser verification of authored inert HTML only. No metered VM is
// created. The loopback counter proves no asset/form/frame request escapes.
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {renderIsolatedSnapshot} from '../services/game-scam-guard/server/preview-renderer.mjs';
let requests=0;
const server=http.createServer((req,res)=>{requests++;res.end('Owned loopback fixture');}).listen(0,'127.0.0.1');await once(server,'listening');
try{
 const target=`http://127.0.0.1:${server.address().port}`;
 const html=`<html><title>Owned isolated preview</title><body><h1>Owned isolated preview</h1><script>document.body.dataset.guardScriptRan='yes';fetch('${target}/script');</script><img src="${target}/image"><iframe src="${target}/frame"></iframe><form method="post" action="${target}/form"><input name="fixture" value="inert"></form><object data="${target}/plugin"></object></body></html>`;
 const {jpeg,telemetry}=await renderIsolatedSnapshot({chromium,url:'https://fixture.example/',html,executablePath:process.env.TEST_CHROMIUM_EXECUTABLE,launchTimeout:20000});
 assert.equal(requests,0);assert.equal(telemetry.siteScriptsExecuted,false);assert.equal(telemetry.javaScriptEnabled,false);assert.equal(telemetry.networkPolicy,'deny-all');assert.equal(telemetry.documentServed,true);assert.ok(jpeg.length>1000&&jpeg.length<1024*1024);assert.deepEqual([...jpeg.subarray(0,3)],[255,216,255]);
 await mkdir('test-results',{recursive:true});await writeFile('test-results/game-scam-isolation.jpg',jpeg);await writeFile('test-results/game-scam-isolation.json',JSON.stringify({status:'passed',scope:'authored-local-browser-fixture',requests,...telemetry},null,2));
 console.log('PASS: real Chromium isolated snapshot; website script did not execute; no image/frame/plugin/form/script request reached the owned loopback server. No cloud VM was created.');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
