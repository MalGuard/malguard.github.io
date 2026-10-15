import {Worker} from 'node:worker_threads';
import {ScanError} from './network.js';
import {identifyArtifact} from './artifact-engine.js';
export function analyzeArtifact(bytes,name,{password='',timeout=10000}={}){
  if(!Buffer.isBuffer(bytes)||bytes.length>12*1024*1024)throw new ScanError('حجم فایل بیش از سقف تحلیل است.',413);
  if(typeof password!=='string'||password.length>256)throw new ScanError('رمز آرشیو بیش از سقف مجاز است.',400);
  identifyArtifact(bytes,name); // Keep the parser dependency traced in serverless worker packages.
  // Trusted parsers inspect data; the sample is NEVER evaluated or executed.
  // Worker memory/time limits protect the API from malformed decompression work.
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./artifact-worker.mjs',import.meta.url),{env:{},execArgv:[],workerData:{bytes,name,password},resourceLimits:{maxOldGenerationSizeMb:128,maxYoungGenerationSizeMb:16}});
    let finished=false;const done=(error,value)=>{if(finished)return;finished=true;clearTimeout(timer);worker.terminate();error?reject(error):resolve(value);};
    const timer=setTimeout(()=>done(new ScanError('زمان تحلیل محتوای فایل تمام شد؛ نتیجه کامل نیست.')),timeout);
    worker.on('message',value=>value?.error?done(new ScanError(value.error)):done(null,value));
    worker.on('error',()=>done(new ScanError('کارگر تحلیل فایل متوقف شد؛ امنیت فایل تأیید نمی‌شود.')));
    worker.on('exit',()=>{if(!finished)done(new ScanError('کارگر تحلیل بدون نتیجه پایان یافت.'));});
  });
}
