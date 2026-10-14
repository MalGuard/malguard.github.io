// Verify the published current installer anonymously. Receipts contain no keys or passwords.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {validateRelease,readJsonBounded,INSTALLER_URL} from '../assets/public-release-model.mjs';
const release=validateRelease(JSON.parse(readFileSync('release/malguard-current-release.json','utf8')));
if(release.status!=='public-download-ready'||release.serviceUrl!==INSTALLER_URL)throw new Error('Unreviewed public release');
const run=process.env.GITHUB_RUN_ID;
if(!/^\d+$/.test(run||''))throw new Error('Missing workflow identity');
const base='https://malguard.site';
const checks=[];let failure=null;
const check=(name,ok,detail)=>{checks.push({name,ok,detail});if(!ok)throw new Error(name);};
try{
 let live=null;
 for(let attempt=0;attempt<72;attempt++){
  try{
   const response=await fetch(base+'/release/malguard-current-release.json?verified='+process.env.GITHUB_SHA,{credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
   if(response.ok){const value=validateRelease(await readJsonBounded(response,20000));if(value.build===release.build&&value.sha256===release.sha256&&value.size===release.size&&value.serviceUrl===INSTALLER_URL){live=value;break;}}
   else await response.body?.cancel();
  }catch{}
  await new Promise(r=>setTimeout(r,5000));
 }
 check('published-current-build',live?.build===release.build,release.build);
 check('unrestricted-download-install-and-launch',live.passwordRequired===false&&live.deviceLicenseRequired===false&&live.installerPasswordRequired===false,'No password or device binding');
 const page=await fetch(base+'/download.html?verified='+process.env.GITHUB_SHA,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
 const html=await page.text();
 check('public-download-control',page.ok&&html.includes('id="downloadButton"')&&html.includes('Download Windows EXE')&&!html.includes('id="downloadPassword"')&&!html.includes('Download paused'),'Visible Windows download without password field');
 const response=await fetch(base+INSTALLER_URL,{method:'GET',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(180000)});
 check('anonymous-installer-get',response.status===200,'HTTP '+response.status+' without password, cookie or authorization');
 const hash=createHash('sha256');let size=0,header=Buffer.alloc(0);
 for await(const chunk of response.body){size+=chunk.length;if(size>release.size)throw new Error('Published installer exceeds reviewed size');if(header.length<2)header=Buffer.concat([header,chunk]).subarray(0,2);hash.update(chunk);}
 check('native-pe-installer',header.toString()==='MZ','Windows executable');
 check('complete-public-installer-sha256',size===release.size&&hash.digest('hex')===release.sha256,size+' bytes; exact reviewed SHA-256');
 const checksum=await fetch(base+INSTALLER_URL+'.sha256',{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
 check('published-checksum',checksum.ok&&(await checksum.text())===release.sha256+'  '+release.filename+'\n','Published SHA-256 matches reviewed release');
}catch(error){failure=checks.find(c=>!c.ok)?.name||'Public release verification did not complete';}
const receipt={schema:1,runId:run,sourceCommit:process.env.GITHUB_SHA,build:release.build,sha256:release.sha256,size:release.size,status:failure?'failed':'verified',checks,failure};
const directory=resolve('test-results/public-download-proof-'+run);mkdirSync(directory,{recursive:true});
const branch='codex/public-download-proof-'+run;
const git=(...args)=>execFileSync('git',args,{cwd:directory,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:1024*1024}).trim();
git('init','-b',branch);git('config','user.name','MalGuard public verification');git('config','user.email','verification@users.noreply.github.com');git('remote','add','origin','https://github.com/'+process.env.GITHUB_REPOSITORY+'.git');
writeFileSync(directory+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');git('add','receipt.json');git('commit','-m','Record anonymous public installer verification');git('push','origin','HEAD:'+branch);
console.log(JSON.stringify({status:receipt.status,checks:checks.length,build:release.build,sha256:release.sha256,failure}));
if(failure)process.exitCode=1;
