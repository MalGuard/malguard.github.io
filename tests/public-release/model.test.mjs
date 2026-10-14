import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateRelease, checkBuild, readBounded, readInstaller, readJsonBounded, SERVICE_URL, INSTALLER_URL, PART_BYTES, MAX_FILE_BYTES} from '../../assets/public-release-model.mjs';
// Synthetic metadata is deliberately never published as a real release.
const fixture = () => ({schemaVersion:'1.0.0',platform:'windows-x64',status:'public-download-ready',serviceUrl:SERVICE_URL,filename:'MalGuard-Setup-x64.exe',version:'1.2.0',engineVersion:'1.1.0',build:'MG-1.2.0-WIN64-aaaaaaaaaaaa',sourceCommit:'a'.repeat(40),sha256:'b'.repeat(64),size:3,partBytes:PART_BYTES,partCount:1,changes:{en:['Synthetic test'],fa:['آزمون مصنوعی']}});
test('validated release retains immutable bilingual changes',()=>{const input=fixture(),result=validateRelease(input);input.changes.en.push('changed');assert.equal(result.changes.en.length,1);assert.ok(Object.isFrozen(result));});
test('JSON arrays cannot masquerade as scalar versions or hashes',()=>{for(const field of ['version','engineVersion','sha256','sourceCommit'])assert.throws(()=>validateRelease({...fixture(),[field]:[fixture()[field]]}));});
for(const [field,value]of [['serviceUrl','https://attacker.example/api/download'],['serviceUrl',SERVICE_URL+'?redirect=1'],['status','private-download-ready'],['size',MAX_FILE_BYTES+1],['size',Infinity],['size',-1],['partCount',2],['sha256','broken'],['sourceCommit','short'],['filename','../../run.exe'],['engineVersion','fake'],['build','<script>'],['changes',{en:['valid'],fa:[]}]])test('reject untrusted metadata '+field+' '+String(value),()=>assert.throws(()=>validateRelease({...fixture(),[field]:value})));
test('build checker distinguishes current, superseded, unknown and invalid',()=>{const latest=fixture(),old='MG-1.1.0-IEXPRESS-WIN64-bbbbbbbbbbbb';const history=[{build:old,supersededBy:latest.build}];assert.equal(checkBuild(latest.build,latest,history),'current');assert.equal(checkBuild(old,latest,history),'older');assert.equal(checkBuild('MG-1.1.0-GUI-WIN64-cccccccccccc',latest,history),'unknown');assert.equal(checkBuild('beta6',latest,history),'invalid');assert.equal(checkBuild('x'.repeat(101),latest,history),'invalid');assert.equal(checkBuild(old,latest,[{build:old}]),'unknown');});
test('decoded part bounds work without Content-Length',async()=>assert.deepEqual(await readBounded(new Response(new Uint8Array([1,2,3])),3),new Uint8Array([1,2,3])));
test('truncated and oversized parts are rejected',async()=>{await assert.rejects(readBounded(new Response(new Uint8Array([1])),2));await assert.rejects(readBounded(new Response(new Uint8Array([1,2,3])),2));});
test('overflow cancels hostile stream',async()=>{let canceled=false;const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(10));},cancel(){canceled=true;}});await assert.rejects(readBounded(new Response(stream),2));assert.equal(canceled,true);});
test('JSON stream size and UTF-8 are bounded',async()=>{assert.deepEqual(await readJsonBounded(new Response('{"ok":true}'),20),{ok:true});await assert.rejects(readJsonBounded(new Response('x'.repeat(30)),20));await assert.rejects(readJsonBounded(new Response(new Uint8Array([255])),20));});
test('password release permits only the reviewed server and unrestricted installation',()=>{
 const gated={...fixture(),status:'password-download-ready',serviceUrl:'https://malguard-private-download.vercel.app/api/installer',passwordRequired:true,deviceLicenseRequired:false,installerPasswordRequired:false};
 assert.equal(validateRelease(gated).status,'password-download-ready');
 for(const change of [{serviceUrl:SERVICE_URL},{passwordRequired:false},{deviceLicenseRequired:true},{installerPasswordRequired:true},{serviceUrl:gated.serviceUrl+'?code=public'}])assert.throws(()=>validateRelease({...gated,...change}));
});
test('public static installer requires the fixed path and unrestricted release flags',()=>{
 const release={...fixture(),serviceUrl:INSTALLER_URL,passwordRequired:false,deviceLicenseRequired:false,installerPasswordRequired:false};
 assert.equal(validateRelease(release).serviceUrl,INSTALLER_URL);
 for(const change of [{serviceUrl:INSTALLER_URL+'?password=x'},{passwordRequired:true},{deviceLicenseRequired:true},{installerPasswordRequired:true}])assert.throws(()=>validateRelease({...release,...change}));
});
test('public file reader reports real bytes and supports a complete installer above the old part limit',async()=>{
 const bytes=new Uint8Array(PART_BYTES+101);bytes.fill(84);
 const seen=[];
 const stream=new ReadableStream({start(c){c.enqueue(bytes.subarray(0,512));c.enqueue(bytes.subarray(512));c.close();}});
 assert.deepEqual(await readInstaller(new Response(stream),bytes.length,n=>seen.push(n)),bytes);
 assert.deepEqual(seen,[512,bytes.length]);
});
test('public file reader rejects truncation and cancels overflow before offering a download',async()=>{
 await assert.rejects(readInstaller(new Response(new Uint8Array(3)),4));
 let cancelled=false;
 const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(5));},cancel(){cancelled=true;}});
 await assert.rejects(readInstaller(new Response(stream),4));assert.ok(cancelled);
 await assert.rejects(readInstaller(new Response('x'),MAX_FILE_BYTES+1));
});
