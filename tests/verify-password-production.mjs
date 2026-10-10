// Verify the live server without putting the owner's password or installer in Git.
// Only a public ephemeral RSA recipient, wrapped code and bounded receipt are published.
import {generateKeyPairSync, privateDecrypt, constants, createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {metadata} from '../private-download-service/installer-release.mjs';
import {downloadPassword} from '../private-download-service/lib/password-download.mjs';
const release=JSON.parse(readFileSync('release/malguard-current-release.json','utf8'));
if(release.status!=='password-download-ready'||release.serviceUrl!=='https://malguard-private-download.vercel.app/api/installer')throw new Error('Unreviewed release');
const run=process.env.GITHUB_RUN_ID;
if(!/^\d+$/.test(run||''))throw new Error('Missing workflow identity');
const directory=resolve('test-results/password-proof-'+run);mkdirSync(directory,{recursive:true});
const branch='codex/site-password-proof-'+run;
const git=(...args)=>execFileSync('git',args,{cwd:directory,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:1024*1024}).trim();
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:3072});
const recipient={schema:1,runId:run,sourceCommit:process.env.GITHUB_SHA,build:release.build,sha256:release.sha256,sealedSha256:metadata.sealedSha256,publicKey:publicKey.export({format:'pem',type:'spki'})};
git('init','-b',branch);git('config','user.name','MalGuard verification');git('config','user.email','verification@users.noreply.github.com');git('remote','add','origin','https://github.com/'+process.env.GITHUB_REPOSITORY+'.git');
writeFileSync(directory+'/recipient.json',JSON.stringify(recipient,null,2)+'\n');git('add','recipient.json');git('commit','-m','Publish ephemeral recipient for password download verification');git('push','origin','HEAD:'+branch);
console.log('Ephemeral public recipient ready: '+branch);
let code=null, previousCode=null;
const checks=[];
let failure=null;
function record(name,ok,detail){checks.push({name,ok,detail});if(!ok)throw new Error(name);}
async function request(method,payload){
 return fetch(release.serviceUrl,{method,headers:{Origin:'https://malguard.github.io',...(payload?{'Content-Type':'application/json'}:{})},...(payload?{body:JSON.stringify(payload)}:{}),redirect:'error',signal:AbortSignal.timeout(60000)});
}
try{
 let wrapped;
 const until=Date.now()+12*60*1000;
 while(Date.now()<until){
  try{git('fetch','--depth=3','origin',branch);wrapped=JSON.parse(git('show','FETCH_HEAD:wrapped-code.json'));break;}catch{}
  await sleep(5000);
 }
 if(!wrapped)throw new Error('Private code delivery timed out');
 const pubHash=createHash('sha256').update(recipient.publicKey).digest('hex');
 if(wrapped.runId!==run||wrapped.recipientSha256!==pubHash||typeof wrapped.ciphertext!=='string'||wrapped.ciphertext.length>1024)throw new Error('Wrapped delivery identity mismatch');
 const raw=privateDecrypt({key:privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(wrapped.ciphertext,'base64'));
 const payload=JSON.parse(raw.toString('utf8'));raw.fill(0);
 if(payload.runId!==run||payload.sha256!==release.sha256||payload.sealedSha256!==metadata.sealedSha256||!downloadPassword(payload.code,metadata.passwordKdf)||
   (payload.previousCode!==undefined&&(typeof payload.previousCode!=='string'||!payload.previousCode||payload.previousCode.length>80||payload.previousCode===payload.code)))throw new Error('Private delivery binding mismatch');
 code=payload.code;previousCode=payload.previousCode||null;payload.code='';payload.previousCode='';
 // Git-hook deployments can finish after this validation workflow starts.
 let preflight;
 for(let i=0;i<60;i++){
  try{preflight=await request('OPTIONS');if(preflight.status===204&&preflight.headers.get('access-control-allow-origin')==='https://malguard.github.io'&&preflight.headers.get('x-release-seal-sha256')===metadata.sealedSha256)break;await preflight.body?.cancel();}catch{}
  await sleep(5000);
 }
 record('live-password-handler',preflight?.status===204&&preflight.headers.get('x-release-seal-sha256')===metadata.sealedSha256,'current seal identity; OPTIONS contains no installer');
 for(const path of ['https://malguard.github.io/release/MalGuard-Setup-x64.exe','https://malguard.github.io/release/private/MalGuard-Setup-x64.exe',release.serviceUrl.replace('/api/installer','/MalGuard-Setup-x64.exe')]){
  const response=await fetch(path,{redirect:'error',signal:AbortSignal.timeout(30000)});await response.body?.cancel();
  record('no-public-installer-'+new URL(path).pathname,response.status===404,'HTTP '+response.status);
 }
 const wrong=code.slice(0,-1)+(code.endsWith('A')?'B':'A');
 if(previousCode){const response=await request('POST',{code:previousCode,part:0});record('previous-password-rejected',response.status===403&&(await response.text()).length<512,'HTTP '+response.status+'; no installer bytes');}
 for(const [name,method,body,expected]of [['public-get','GET',null,405],['missing-password','POST',{part:0},400],['empty-password','POST',{code:'',part:0},403],['wrong-password','POST',{code:wrong,part:0},403]]){
  const response=await request(method,body);const text=await response.text();record(name,response.status===expected&&text.length<512&&!text.startsWith('MZ'),'HTTP '+response.status+'; no installer bytes');
 }
 const hash=createHash('sha256');let total=0;
 for(let part=0;part<release.partCount;part++){
  const response=await request('POST',{code,part});
  record('authorized-part-'+part,response.status===200&&response.headers.get('x-part-index')===String(part)&&response.headers.get('x-file-size')===String(release.size)&&response.headers.get('x-file-sha256')===release.sha256,'reviewed part headers');
  const expected=Math.min(release.partBytes,release.size-total);let size=0;
  for await(const chunk of response.body){size+=chunk.length;if(size>expected)throw new Error('Part exceeds reviewed size');hash.update(chunk);total+=chunk.length;}
  record('part-size-'+part,size===expected,String(size)+' bytes');
 }
 record('complete-installer-sha256',total===release.size&&hash.digest('hex')===release.sha256,String(total)+' bytes; exact SHA-256');
 const after=await request('POST',{code:wrong,part:0});record('cached-installer-still-protected',after.status===403&&(await after.text()).length<512,'wrong password rejected after successful full download');
 if(previousCode){const response=await request('POST',{code:previousCode,part:0});record('previous-password-rejected-after-download',response.status===403&&(await response.text()).length<512,'HTTP '+response.status+'; previous password cannot bypass cache');}
}catch(error){failure=checks.find(c=>!c.ok)?.name||(['Private code delivery timed out','Wrapped delivery identity mismatch','Private delivery binding mismatch','Part exceeds reviewed size'].includes(error.message)?error.message:'Live verification did not complete');}
finally{code=null;previousCode=null;}
try{
 git('fetch','--depth=3','origin',branch);git('merge','--ff-only','FETCH_HEAD');
 const receipt={schema:1,runId:run,sourceCommit:process.env.GITHUB_SHA,build:release.build,sha256:release.sha256,sealedSha256:metadata.sealedSha256,size:release.size,status:failure?'failed':'verified',checks,failure};
 writeFileSync(directory+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');git('add','receipt.json');git('commit','-m','Record bounded live password download verification');git('push','origin','HEAD:'+branch);
 console.log(JSON.stringify({status:receipt.status,checks:checks.length,build:release.build,sha256:release.sha256,failure}));
}catch{console.log('Could not publish bounded verification receipt');process.exitCode=1;}
if(failure)process.exitCode=1;
