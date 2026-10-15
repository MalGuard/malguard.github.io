import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
export const CLOUD_COLLECTOR_SHA256=(()=>{try{return createHash('sha256').update(readFileSync(new URL('./cloud-execution-worker.py',import.meta.url))).digest('hex');}catch{return '';}})();
export const CLOUD_IMAGE='vercel/sandbox/universal@sha256:c77f7436b9bc0a8b01ef7b09dbcea2de6a18a9fe2aafa89996d2da193da72cf0';

export function cloudExecutionStatus(env=process.env){
  const ready=!!CLOUD_COLLECTOR_SHA256&&env.GUARD_CLOUD_EXECUTION_ENABLED==='true'&&env.GUARD_CLOUD_FREE_QUOTA_CONFIRMED==='true'&&env.GUARD_CLOUD_ISOLATION_VALIDATED==='true'&&env.GUARD_CLOUD_VALIDATED_DRIVER_SHA256===CLOUD_COLLECTOR_SHA256;
  return {ready,supported:['Linux ELF','JavaScript','Python','shell'],reason:ready?'اجرای محدود در microVM لینوکسی جداگانه فعال است.':'اجرای ابری تا تأیید سهمیهٔ رایگان و آزمون جداسازی فعال نمی‌شود.'};
}
export async function runCloudBehavior(bytes,{name,format},{Sandbox,env=process.env}={}){
  let attempted=false;
  const unavailable=reason=>({status:'unavailable',executed:false,attempted,reason});
  const runtime=format==='ELF executable'?'elf':format!=='Text / script'?null:/\.(?:m?js|cjs)$/i.test(name)?'js':/\.py$/i.test(name)?'python':/\.sh$/i.test(name)?'shell':null;
  if(!runtime)return unavailable('محیط ابری لینوکسی با اجرای این قالب سازگار نیست؛ اجرای ویندوز/اندروید یا افزونه در این محیط ادعا نمی‌شود.');
  if(!cloudExecutionStatus(env).ready)return unavailable(cloudExecutionStatus(env).reason);
  if(bytes.length>1024*1024)return unavailable('سقف ورودی اجرای ابری یک مگابایت است؛ این فایل اجرا نشده است.');
  const sha256=createHash('sha256').update(bytes).digest('hex');let sandbox,result,stopped=false;
  try{
    if(!Sandbox)({Sandbox}=await import('@vercel/sandbox'));
    attempted=true;
    sandbox=await Sandbox.create({image:CLOUD_IMAGE,resources:{vcpus:1},timeout:60000,persistent:false,ports:[],networkPolicy:'deny-all',env:{}});
    await sandbox.mkDir('/tmp/guard-cloud');
    await sandbox.writeFiles([{path:'/tmp/guard-cloud/collector.py',content:await readFile(new URL('./cloud-execution-worker.py',import.meta.url))},{path:'/tmp/guard-cloud/sample.bin',content:bytes},{path:'/tmp/guard-cloud/job.json',content:Buffer.from(JSON.stringify({sha256,runtime}))}]);
    const command=await sandbox.runCommand({cmd:'python3',args:['/tmp/guard-cloud/collector.py'],sudo:true,cwd:'/tmp/guard-cloud'});
    if(command.exitCode!==0)result=unavailable('اجرای ابری یا پیش‌شرط جداسازی کامل نشد؛ فایل امن اعلام نمی‌شود.');
    else{
      const output=await command.stdout();if(Buffer.byteLength(output)>128*1024)throw new Error('report_budget');
      const evidence=JSON.parse(output);
      if(evidence.schema!==1||evidence.sampleSha256!==sha256||evidence.execution?.started!==true||!Number.isInteger(evidence.isolation?.uid)||evidence.isolation.uid<=0||evidence.isolation?.noNewPrivileges!==true||evidence.isolation?.networkProbeDenied!==true||evidence.isolation?.appSecretsAbsent!==true||!Array.isArray(evidence.createdFiles)||evidence.createdFiles.length>32)throw new Error('execution_evidence_invalid');
      result={...evidence,status:evidence.execution.exitCode===0&&!evidence.execution.timedOut&&!evidence.execution.budgetExceeded?'done':'incomplete',executed:true,attempted:true,reason:'نمونه در ماشین ابری جدا اجرا شد؛ فقط رفتار مشاهده‌شده گزارش می‌شود و نبود رفتار مشکوک تضمین امنیت نیست.'};
    }
  }catch{result=unavailable('سرویس ابری، سهمیه یا جمع‌آوری معتبر رفتار در دسترس نبود؛ هیچ اجرای میزبان جایگزین انجام نشد.');}
  finally{if(sandbox)try{await sandbox.stop();stopped=true;}catch{}}
  if(result.executed&&!stopped)return {...result,status:'incomplete',reason:'اجرا مشاهده شد، اما توقف صریح محیط تأیید نشد؛ سقف زمانی ماشین برقرار است.',teardownConfirmed:false};
  return {...result,teardownConfirmed:stopped};
}
