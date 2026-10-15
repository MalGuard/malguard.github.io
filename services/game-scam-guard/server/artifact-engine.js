import {createHash} from 'node:crypto';
import {ZipReader,Uint8ArrayReader,configure} from '@zip.js/zip.js';
import {inspectGtaPe} from './gta-pe-adapter.js';
configure({useWebWorkers:false});
export const FILE_ENGINE_VERSION='1.1.0';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const MAX_ENTRY_BYTES=2*1024*1024,MAX_ARCHIVE_BYTES=8*1024*1024,MAX_ENTRIES=128;
const textTypes=/\.(js|mjs|cjs|ps1|bat|cmd|vbs|lua|cs|py|sh|txt|json|xml|html?|ini|cfg|manifest)$/i;
const short=value=>String(value).replace(/\s+/g,' ').slice(0,240);

export function identifyArtifact(bytes,name=''){
  if(bytes.subarray(0,2).toString()==='MZ')return 'PE / Windows executable';
  if(bytes.subarray(0,4).equals(Buffer.from([0x7f,0x45,0x4c,0x46])))return 'ELF executable';
  if(['504b0304','504b0506','504b0708'].includes(bytes.subarray(0,4).toString('hex')))return 'ZIP / APK archive';
  if(bytes.subarray(0,4).toString()==='Rar!')return 'RAR archive';
  if(bytes.subarray(0,6).toString('hex')==='377abcaf271c')return '7z archive';
  if(bytes.subarray(0,4).toString()==='%PDF')return 'PDF document';
  if(/^\s*<!doctype html|^\s*<html/i.test(bytes.toString('utf8',0,200)))return 'HTML page';
  if(textTypes.test(name)&&!bytes.subarray(0,4096).includes(0))return 'Text / script';
  return 'Unknown binary / text';
}

function inspectText(bytes,name){
  const source=bytes.subarray(0,MAX_ENTRY_BYTES).toString('utf8');const findings=[];
  const rule=(id,reason,patterns)=>{
    const hits=patterns.map(pattern=>pattern.exec(source));
    if(hits.every(Boolean))findings.push({rule:id,severity:'warning',reason,evidence:hits.map(hit=>short(hit[0])).join(' + '),location:name});
  };
  rule('credentials_and_transfer','نشانهٔ دسترسی به دادهٔ حساب همراه با قابلیت انتقال دیده شد؛ این شاهد ایستاست و سرقت واقعی مشاهده نشده است.',[/Login Data|Local State|Cookies|wallet\.dat|\.ssh|credential/i,/https?:\/\/|fetch\s*\(|Invoke-WebRequest|requests\.post|HttpClient/i]);
  rule('download_and_execute','دریافت از شبکه همراه با قابلیت اجرای کد دیده شد؛ بدون بررسی رفتار، هدف آن قطعی نیست.',[/https?:\/\/|Invoke-WebRequest|curl\s|wget\s/i,/\b(?:eval|exec|spawn|Start-Process|Invoke-Expression|iex)\b/i]);
  rule('persistence','نشانه‌های ایجاد اجرای خودکار یا وظیفهٔ زمان‌بندی دیده شد.',[/CurrentVersion[\\/]+Run|schtasks|crontab|Startup/i,/RegSetValue|reg\s+add|\/create|writeFile|Set-ItemProperty|open\s*\(/i]);
  rule('security_disabling','دستور مرتبط با خاموش‌کردن محافظت دیده شد؛ فایل اجرا نشده است.',[/Set-MpPreference|DisableRealtimeMonitoring|Add-MpPreference/i,/\b(?:true|1|ExclusionPath|DisableRealtimeMonitoring)\b/i]);
  rule('encoded_execution','رمزگشایی همراه با اجرای پویای کد دیده شد؛ کد مبهم به‌تنهایی بدافزار را ثابت نمی‌کند.',[/\b(?:atob|FromBase64String|base64\.b64decode|unescape)\b/i,/\b(?:eval|exec|Invoke-Expression|iex|Function)\b/i]);
  if(/package\.json$/i.test(name)){
    try{const p=JSON.parse(source);for(const phase of ['preinstall','install','postinstall'])if(typeof p.scripts?.[phase]==='string')findings.push({rule:'install_script',severity:'warning',reason:'این بسته هنگام نصب دستور اجرا می‌کند؛ صرف وجود آن اثبات بدافزار نیست.',evidence:`${phase}: ${short(p.scripts[phase])}`,location:name});}catch{}
  }
  return findings;
}

function inspectPE(bytes){
  const details=[];
  if(bytes.length<64)return {valid:false,details:['سرآیند DOS ناقص است.']};
  const offset=bytes.readUInt32LE(0x3c);
  if(offset>bytes.length-24||bytes.subarray(offset,offset+4).toString('hex')!=='50450000')return {valid:false,details:['امضای PE در محل اعلام‌شده معتبر نیست.']};
  const sections=bytes.readUInt16LE(offset+6),optionalSize=bytes.readUInt16LE(offset+20);
  const table=offset+24+optionalSize;
  if(sections>96||table+sections*40>bytes.length)return {valid:false,details:['جدول بخش‌های اجرایی ناقص یا بیش از سقف است.']};
  details.push(`معماری PE: 0x${bytes.readUInt16LE(offset+4).toString(16)}؛ تعداد بخش‌ها: ${sections}.`);
  for(let i=0;i<sections;i++){
    const row=table+i*40,size=bytes.readUInt32LE(row+16),start=bytes.readUInt32LE(row+20);
    if(size&&start+size>bytes.length)return {valid:false,details:['بخشی از فایل اجرایی خارج از دادهٔ دریافت‌شده اشاره می‌کند.']};
  }
  details.push('این بررسی، اعتبار ساختار را کنترل می‌کند؛ امضای ناشر یا رفتار برنامه تأیید نشده است.');
  return {valid:true,details};
}

function inspectLayers(bytes,name,result){
  const layer=(id,title,status,detail)=>result.layers.push({id,title,status,detail});
  result.layers=[];
  layer('identity','هش کامل و امضای محتوا','done',`${bytes.length} بایت؛ SHA-256 روی کل فایل و نوع از امضای محتوا: ${result.format}`);
  const extension=String(name).split('.').pop().toLowerCase();
  const expected={exe:'PE / Windows executable',dll:'PE / Windows executable',asi:'PE / Windows executable',zip:'ZIP / APK archive',apk:'ZIP / APK archive',pdf:'PDF document',elf:'ELF executable'}[extension];
  const mismatch=expected&&expected!==result.format;
  if(mismatch)result.findings.push({rule:'signature_mismatch',severity:'warning',reason:'پسوند با امضای محتوای دریافت‌شده سازگار نیست؛ این ناسازگاری به‌تنهایی بدافزار را ثابت نمی‌کند.',evidence:`.${extension}: ${result.format}`,location:name});
  const deceptive=/[\u202a-\u202e\u2066-\u2069]/.test(name)||/\.(?:pdf|jpe?g|png|txt)\.(?:exe|scr|bat|cmd|js)$/i.test(name);
  if(deceptive)result.findings.push({rule:'deceptive_filename',severity:'warning',reason:'نام فایل دارای نشانهٔ تغییر جهت متن یا پسوند دوگانهٔ اجرایی است.',evidence:short(name),location:name});
  layer('naming','نام و سازگاری پسوند','done',mismatch||deceptive?'ناسازگاری یا نام نیازمند احتیاط ثبت شد.':'نام و امضای فایل مقایسه شد؛ این بررسی تأیید ناشر نیست.');
  const source=bytes.subarray(0,MAX_ENTRY_BYTES).toString('utf8');
  const urls=[...new Set(source.match(/https?:\/\/[^\s"'<>\x00-\x1f]{1,200}/gi)||[])].slice(0,12);
  result.observedUrls=urls;
  layer('strings','نشانه‌های متنی و مقصدهای شبکه',bytes.length>MAX_ENTRY_BYTES?'partial':'done',`ترکیب نشانه‌های حساب، شبکه، اجرا و ماندگاری جستجو شد؛ ${urls.length} مقصد متنی ثبت شد. مقصدها باز نشده‌اند؛ ماشین‌کد تفسیر نشده است.`);
  // Only canonical quoted literals are decoded, under a shared byte/count cap.
  // No eval, script import, execution or remote fetching occurs here.
  let count=0,total=0;
  for(const hit of source.matchAll(/["']([A-Za-z0-9+/]{24,32768}={0,2})["']/g)){
    if(count>=8)break;
    const decoded=Buffer.from(hit[1],'base64');
    if(decoded.toString('base64')!==hit[1]||total+decoded.length>64*1024)continue;
    total+=decoded.length;count++;
    result.findings.push(...inspectText(decoded,`${name} · base64 literal ${count}`));
  }
  layer('encoded_literals','رمزگشایی محدود رشته‌های Base64','done',`${count} رشتهٔ معتبر و ${total} بایت رمزگشایی و ایستا بررسی شد؛ رمزگذاری سفارشی و کد پویا پوشش داده نشده است.`);
  const sample=bytes.subarray(0,MAX_ENTRY_BYTES),frequencies=new Uint32Array(256);
  for(const byte of sample)frequencies[byte]++;
  let entropy=0;for(const n of frequencies)if(n){const p=n/sample.length;entropy-=p*Math.log2(p);}
  result.entropy={bitsPerByte:Math.round(entropy*100)/100,sampledBytes:sample.length};
  layer('byte_distribution','توزیع بایت‌ها','done',`آنتروپی ${result.entropy.bitsPerByte} روی ${sample.length} بایت؛ فشرده‌سازی یا آنتروپی بالا به‌تنهایی نشانهٔ بدافزار نیست.`);
  layer('structure','ساختار قالب',result.status==='complete'?'done':'partial',result.details.join(' ').slice(0,700)||'تحلیل متنی انجام شد؛ امضای ناشر و رفتار بررسی نشده است.');
  if(result.archive)layer('archive','اعضای آرشیو',result.archive.complete?'done':'partial',`${result.archive.inspected} عضو از ${result.archive.listed} عضو خوانده شد؛ سقف عمق و حجم برقرار است، عضو اجرا نشده است.`);
}

function inspectELF(bytes){
  if(bytes.length<52||![1,2].includes(bytes[4])||![1,2].includes(bytes[5])||bytes[6]!==1)return {valid:false,detail:'سرآیند ELF ناقص یا نامعتبر است.'};
  const wide=bytes[4]===2,le=bytes[5]===1;
  if(wide&&bytes.length<64)return {valid:false,detail:'سرآیند ELF64 ناقص است.'};
  const u16=offset=>le?bytes.readUInt16LE(offset):bytes.readUInt16BE(offset);
  const word=offset=>wide?(le?bytes.readBigUInt64LE(offset):bytes.readBigUInt64BE(offset)):BigInt(le?bytes.readUInt32LE(offset):bytes.readUInt32BE(offset));
  const offset=word(wide?32:28),entry=u16(wide?54:42),count=u16(wide?56:44);
  const valid=count<=256&&(!count||(entry>=(wide?56:32)&&offset>=BigInt(wide?64:52)&&offset+BigInt(entry*count)<=BigInt(bytes.length)));
  return {valid,detail:`ELF${wide?64:32}؛ معماری ${u16(18)}؛ ${count} سرآیند برنامه؛ ${valid?'حدود جدول بررسی شد':'حدود جدول نامعتبر یا بیش از سقف است'}. ماشین‌کد و کتابخانه‌ها تحلیل کامل نشده‌اند.`};
}

export async function analyzeArtifactRaw(input,name,{password='',depth=0,budget={bytes:0,entries:0}}={}){
  const bytes=Buffer.from(input);const format=identifyArtifact(bytes,name);
  const result={engine:'GameScam Guard File',version:FILE_ENGINE_VERSION,status:'complete',format,size:bytes.length,sha256:digest(bytes),findings:[],details:[],executed:false};
  if(format==='Text / script')result.findings.push(...inspectText(bytes,name));
  else if(format==='PE / Windows executable'){
    const pe=inspectPE(bytes);result.details.push(...pe.details);
    if(!pe.valid){result.status='partial';result.findings.push({rule:'invalid_pe',severity:'warning',reason:'پسوند یا امضای MZ به‌تنهایی فایل اجرایی معتبر را ثابت نمی‌کند.',evidence:pe.details[0],location:name});}
    result.findings.push(...inspectText(bytes,name));
    result.peEngine=await inspectGtaPe(bytes,name);
    if(result.peEngine){
      if(!result.peEngine.peValid||result.peEngine.rulesStatus!=='official')result.status='partial';
      if(['suspicious','malicious'].includes(result.peEngine.verdict))result.findings.push({rule:'gta_pe_combined_evidence',severity:'warning',reason:'موتور ایستای GTA Guard ترکیب نشانه‌های نیازمند احتیاط را شناسایی کرد؛ رفتار اجرایی مشاهده نشده است.',evidence:result.peEngine.reasons.slice(0,3).join(' '),location:name});
      result.details.push(`قواعد ایستای GTA Guard ${result.peEngine.version} برای DLL/ASI بررسی شد؛ امضای ناشر و اجرای ویندوز تأیید نشده است.`);
    }else{result.status='partial';result.details.push('تحلیل ساختار و نشانه‌های PE انجام شد؛ ماشین‌کد، امضای ناشر و اجرای ویندوز تأیید نشده‌اند.');}
  }else if(format==='ZIP / APK archive'){
    const reader=new ZipReader(new Uint8ArrayReader(bytes),{useWebWorkers:false});
    const archive={entries:[],inspected:0,listed:0,complete:true,expandedBytes:0};result.archive=archive;
    const seen=new Set();let count=0;
    try{
      for await(const entry of reader.getEntriesGenerator()){
        if(++count>MAX_ENTRIES||++budget.entries>MAX_ENTRIES){archive.complete=false;result.details.push('فهرست آرشیو از سقف مجموع ۱۲۸ عضو گذشت؛ ادامه بررسی نشده است.');break;}
        archive.listed++;
        const filename=String(entry.filename);const row={name:filename.slice(0,180),directory:entry.directory,size:entry.uncompressedSize,status:'unscanned'};archive.entries.push(row);
        const unixMode=(entry.externalFileAttributes>>>16)&0xf000;
        if(filename.startsWith('/')||filename.includes('\\')||/^[a-z]:/i.test(filename)||filename.split('/').includes('..')||unixMode===0xa000||filename.includes('\0')){
          row.status='blocked';archive.complete=false;result.findings.push({rule:'archive_unsafe_path',severity:'warning',reason:'عضو دارای مسیر خروج از آرشیو یا پیوند نمادین است؛ روی دیسک استخراج نشده است.',evidence:row.name,location:name});continue;
        }
        if(entry.directory){row.status='directory';continue;}
        if(seen.has(filename)){row.status='duplicate';archive.complete=false;continue;}seen.add(filename);
        if(entry.encrypted&&!password){row.status='needs_password';archive.complete=false;continue;}
        if(!Number.isSafeInteger(entry.uncompressedSize)||entry.uncompressedSize>MAX_ENTRY_BYTES||budget.bytes+entry.uncompressedSize>MAX_ARCHIVE_BYTES||entry.uncompressedSize/Math.max(entry.compressedSize,1)>200){
          row.status='budget_exceeded';archive.complete=false;continue;
        }
        try{
          const chunks=[];let size=0;
          const writer=new WritableStream({write(chunk){size+=chunk.length;if(size>MAX_ENTRY_BYTES||budget.bytes+size>MAX_ARCHIVE_BYTES)throw new Error('output_budget');chunks.push(Buffer.from(chunk));}});
          await entry.getData(writer,{password:password||undefined,checkSignature:true,useWebWorkers:false});
          const data=Buffer.concat(chunks);archive.expandedBytes+=data.length;budget.bytes+=data.length;archive.inspected++;
          row.status='inspected';row.size=data.length;row.sha256=digest(data);row.format=identifyArtifact(data,filename);
          if(row.format==='ZIP / APK archive'){
            if(depth>=2){row.status='nested_not_expanded';archive.complete=false;}
            else{row.nested=await analyzeArtifactRaw(data,filename,{password,depth:depth+1,budget});row.status=row.nested.status==='complete'?'nested_inspected':'nested_partial';if(row.nested.status!=='complete')archive.complete=false;result.findings.push(...row.nested.findings.map(f=>({...f,location:`${row.name}/${f.location}`.slice(0,240)})));}
          }
          else if(row.format==='Text / script')result.findings.push(...inspectText(data,filename));
          else if(row.format==='PE / Windows executable'){
            const pe=inspectPE(data);row.structure=pe.valid?'valid':'invalid';result.findings.push(...inspectText(data,filename));
            if(!pe.valid)result.findings.push({rule:'archive_invalid_pe',severity:'warning',reason:'ساختار عضو اجرایی معتبر نیست.',evidence:row.name,location:name});
            row.peEngine=await inspectGtaPe(data,filename);
            if(!row.peEngine?.peValid||row.peEngine.rulesStatus!=='official')archive.complete=false;
            if(['suspicious','malicious'].includes(row.peEngine?.verdict))result.findings.push({rule:'archive_gta_pe_evidence',severity:'warning',reason:'ترکیب نشانه‌های ایستای مشکوک در عضو DLL/ASI دیده شد.',evidence:row.peEngine.reasons.slice(0,2).join(' '),location:filename});
          }
          else if(['Unknown binary / text','RAR archive','7z archive','ELF executable'].includes(row.format)){row.status='format_unsupported';archive.complete=false;}
          if(/vbaproject\.bin$/i.test(filename))result.findings.push({rule:'office_macro',severity:'warning',reason:'عضو حاوی کد ماکرو در سند دیده شد؛ ماکرو اجرا نشده است.',evidence:row.name,location:name});
          if(filename==='AndroidManifest.xml'){
            const manifest=data.toString('utf8')+' '+data.toString('utf16le');
            row.permissions=[...new Set(manifest.match(/android\.permission\.[A-Z_]+/g)||[])].slice(0,32);
            row.permissionCoverage='observed-strings-only';
          }
        }catch(error){row.status=/password/i.test(error.message)?'password_invalid':'unavailable';archive.complete=false;}
      }
    }catch(error){archive.complete=false;result.details.push('ساختار آرشیو قابل خواندن کامل نبود.');if(error.message==='Unsafe filename')result.findings.push({rule:'archive_unsafe_path',severity:'warning',reason:'کتابخانهٔ آرشیو مسیر عضو را نامعتبر و خطرناک تشخیص داد؛ هیچ عضوی روی دیسک استخراج نشد.',evidence:'Unsafe filename',location:name});}
    finally{await reader.close().catch(()=>{});}
    if(!archive.complete)result.status=archive.entries.some(entry=>entry.status==='needs_password')?'needs_password':'partial';
    result.details.push(`${archive.inspected} عضو از ${archive.listed} عضو فهرست‌شده، در حافظه خوانده شد؛ هیچ عضو اجرا یا روی دیسک استخراج نشد.`);
  }else if(format==='ELF executable'){
    const elf=inspectELF(bytes);result.details.push(elf.detail);result.status='partial';result.findings.push(...inspectText(bytes,name));
    if(!elf.valid)result.findings.push({rule:'invalid_elf',severity:'warning',reason:'امضای ELF موجود است، اما ساختار سرآیند تأیید نشد.',evidence:elf.detail,location:name});
  }else if(format==='PDF document'){
    result.findings.push(...inspectText(bytes,name));
    for(const token of ['/JavaScript','/OpenAction','/Launch','/EmbeddedFile'])if(bytes.includes(Buffer.from(token)))result.findings.push({rule:'pdf_active_content',severity:'warning',reason:'نشانهٔ محتوای فعال یا پیوست در PDF دیده شد؛ اجرای آن مشاهده نشده است.',evidence:token,location:name});
    result.details.push('جستجوی نشانه‌های PDF انجام شد؛ رندر، رمزگشایی جریان‌ها و رفتار سند بررسی نشده است.');result.status='partial';
  }else{result.status='unsupported';result.details.push('هش و نوع اولیه بررسی شد؛ تحلیل کامل این قالب در موتور فعلی پشتیبانی نمی‌شود.');}
  if(bytes.length>MAX_ENTRY_BYTES&&['Text / script','PE / Windows executable'].includes(format)){result.status='partial';result.details.push('جستجوی متنی فقط دو مگابایت ابتدایی را پوشش داد؛ هش روی کل فایل محاسبه شده است.');}
  result.details.push('یافته‌ها بر پایهٔ تحلیل ایستا هستند؛ نبود یافته تضمین امنیت نیست.');
  if(!['Text / script','PE / Windows executable','PDF document','ELF executable'].includes(format))result.findings.push(...inspectText(bytes,name));
  inspectLayers(bytes,name,result);
  result.findings=result.findings.slice(0,64);
  return result;
}
