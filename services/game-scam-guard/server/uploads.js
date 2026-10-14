import busboy from 'busboy';
import {randomUUID} from 'node:crypto';
import {ScanError} from './network.js';
import {analyzeArtifact} from './artifact-analysis.js';
import {lookupFileHash} from './threat-intel.js';
import {runCloudBehavior} from './cloud-execution.js';
import {routeFile} from './file-routing.js';
export const MAX_UPLOAD_BYTES=3*1024*1024;

export async function readUpload(req){
  // JSON/base64 preserves arbitrary bytes across Vercel's automatic body parser.
  // Multipart remains available on hosts that keep the original request bytes.
  if(req.is('application/json')){
    let body=req.body;
    try{if(Buffer.isBuffer(body)||typeof body==='string')body=JSON.parse(body.toString());}catch{throw new ScanError('فرم فایل معتبر نیست.',400);}
    if(!body||typeof body.name!=='string'||!body.name||body.name.length>180||/[\x00-\x1f\/\\]/.test(body.name)||typeof body.data!=='string')throw new ScanError('نام یا دادهٔ فایل معتبر نیست.',400);
    if(body.data.length>Math.ceil(MAX_UPLOAD_BYTES*4/3)+4)throw new ScanError('سقف فایل آپلودی ۳ مگابایت است.',413);
    if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.data))throw new ScanError('کدگذاری فایل معتبر نیست.',400);
    const bytes=Buffer.from(body.data,'base64');
    if(!bytes.length||bytes.toString('base64')!==body.data)throw new ScanError('فایل غیرخالی با کدگذاری معتبر ارسال کنید.',400);
    if(bytes.length>MAX_UPLOAD_BYTES)throw new ScanError('سقف فایل آپلودی ۳ مگابایت است.',413);
    return {name:body.name,bytes,mode:body.mode,consent:body.consent===true?'true':body.consent,password:body.password||'',behaviorConsent:body.behaviorConsent===true};
  }
  return new Promise((resolve,reject)=>{
    let parser;try{parser=busboy({headers:req.headers,limits:{files:1,fileSize:MAX_UPLOAD_BYTES,fields:4,fieldSize:1024,parts:5}});}catch{reject(new ScanError('فرم فایل معتبر نیست.',400));return;}
    let failure,file,fields={},received=false,total=0;
    const fail=message=>{failure=new ScanError(message,413);};
    parser.on('file',(field,stream,info)=>{
      if(field!=='file'||received){fail('فقط یک فایل قابل ارسال است.');stream.resume();return;}
      received=true;const name=info.filename;
      if(typeof name!=='string'||!name||name.length>180||/[\x00-\x1f]/.test(name)){failure=new ScanError('نام فایل معتبر نیست.',400);stream.resume();return;}
      const chunks=[];stream.on('data',bytes=>{total+=bytes.length;if(total<=MAX_UPLOAD_BYTES)chunks.push(bytes);else fail('سقف فایل آپلودی ۳ مگابایت است.');});
      stream.on('limit',()=>fail('سقف فایل آپلودی ۳ مگابایت است.'));
      stream.on('end',()=>{file={name,bytes:Buffer.concat(chunks)};});
    });
    parser.on('field',(name,value,info)=>{if(info.valueTruncated)fail('اطلاعات فرم بیش از سقف است.');else if(['password','mode','consent','behaviorConsent'].includes(name))fields[name]=value;});
    for(const event of ['filesLimit','fieldsLimit','partsLimit'])parser.on(event,()=>fail('اطلاعات فرم بیش از سقف است.'));
    parser.on('error',()=>reject(new ScanError('دریافت فایل کامل نشد.',400)));
    req.on('aborted',()=>reject(new ScanError('ارسال فایل قطع شد.',400)));
    parser.on('close',()=>failure?reject(failure):!file||!file.bytes.length?reject(new ScanError('یک فایل غیرخالی انتخاب کنید.',400)):resolve({...file,...fields}));
    if(Buffer.isBuffer(req.body))parser.end(req.body);
    else if(typeof req.body==='string'){reject(new ScanError('میزبان فایل را به متن تبدیل کرده است؛ دریافت بایت معتبر ممکن نشد.',400));parser.destroy();}
    else req.pipe(parser);
  });
}

export async function scanUploadedFile(upload,{analyze=analyzeArtifact,lookup=lookupFileHash,behavior=runCloudBehavior}={}){
  if(upload.consent!=='true')throw new ScanError('برای تحلیل فایل آپلودی رضایت لازم است.',400);
  if(!['advanced','ultra'].includes(upload.mode))throw new ScanError('حالت فایل معتبر نیست.',400);
  const artifact=await analyze(upload.bytes,upload.name,{password:upload.password||''});
  const intel=await Promise.resolve().then(()=>lookup(artifact.sha256)).catch(()=>({status:'unavailable',message:'استعلام MalwareBazaar کامل نشد؛ نبودن هش در پایگاه تأیید نمی‌شود.'}));
  let status=intel.status==='listed'?'danger':artifact.findings.length?'warning':artifact.status==='complete'&&upload.mode!=='ultra'?'limited':'unavailable';
  const url='https://local-upload.invalid/';
  const file={id:randomUUID(),name:upload.name,url,extension:upload.name.split('.').pop().slice(0,6).toUpperCase(),status,size:artifact.size,sha256:artifact.sha256,format:artifact.format,artifact,reputation:intel,detail:artifact.details.join(' ')};
  Object.assign(file,await routeFile(upload.bytes,{name:upload.name,artifact,intel,behaviorConsent:upload.behaviorConsent===true||upload.behaviorConsent==='true'},{behavior}));
  if(file.behavior.status==='done'&&artifact.status==='complete'&&status==='unavailable'){status='limited';file.status=status;}
  return {id:randomUUID(),source:'upload',scanMode:upload.mode,url,finalUrl:url,domain:'فایل آپلودی',createdAt:new Date().toISOString(),title:upload.name,description:'این فایل از دستگاه شما دریافت شد؛ برای این گزارش سایتی باز نشده است.',excerpt:'',contentType:artifact.format,status,advanced:true,files:[file],fileCount:1,linkCount:0,headings:[],redirects:[],signals:artifact.findings.map(f=>({level:'warning',title:f.reason,detail:`${f.location}: ${f.evidence}`})),checks:[{title:'دریافت فایل با رضایت',status:'done',detail:`${artifact.size} بایت؛ بدون ذخیره روی دیسک`},{title:'تحلیل مستقل فایل',status:artifact.status==='complete'?'done':'unavailable',detail:artifact.details.join(' ')},{title:'استعلام MalwareBazaar',status:['listed','not_found'].includes(intel.status)?'done':'unavailable',detail:intel.message}],limitations:['رمز آرشیو فقط برای همین بررسی در حافظه استفاده شد و در گزارش نگهداری نمی‌شود.','این نتیجه تضمین امنیت نیست؛ تحلیل رفتار اجرا فقط با محیط ابری آماده ممکن است.']};
}
