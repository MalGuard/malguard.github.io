import {validateRelease, checkBuild, readInstaller, readJsonBounded, INSTALLER_URL} from './public-release-model.mjs?v=20261014-public';
import {language} from './i18n.mjs?v=20261014-public';
const element = id => document.getElementById(id);
const words = {
 en: {loading:'Checking release metadata',ready:'Download the Windows installer. No password, account or device license is required.',unavailable:'Release details cannot be verified. Download is disabled; try again later.',authorizing:'Verifying the download password',receiving:'Receiving verified installer',verifying:'Checking SHA-256',saved:'Integrity verified. The Windows installer is ready to save.',denied:'The download password is incorrect. No installer was saved.',retry:'The service is busy or temporarily unavailable. Try again shortly.',cancelled:'Download cancelled. No partial installer was saved.',failed:'Download stopped. Network or integrity checks failed; retry from this page.',current:'This is the current build. Installation and launch require no password or device license.',older:'A newer release is available. Review the changes below and download it without a password.',unknown:'Build not recognized. Its update status cannot be confirmed.',invalid:'Enter the complete build code shown inside MalGuard.'},
 fa: {loading:'در حال بررسی مشخصات انتشار',ready:'فایل نصب ویندوز را دانلود کنید. رمز، حساب کاربری یا مجوز دستگاه لازم نیست.',unavailable:'مشخصات انتشار قابل تأیید نیست. دانلود غیرفعال است؛ بعداً دوباره امتحان کنید.',authorizing:'در حال بررسی رمز دانلود',receiving:'در حال دریافت فایل نصب',verifying:'در حال بررسی SHA-256',saved:'یکپارچگی تأیید شد. فایل نصب ویندوز آمادهٔ ذخیره است.',denied:'رمز دانلود درست نیست. هیچ فایل نصبی ذخیره نشد.',retry:'سرویس مشغول یا موقتاً در دسترس نیست. کمی بعد دوباره امتحان کنید.',cancelled:'دانلود لغو شد. فایل نصب ناقصی ذخیره نشد.',failed:'دانلود متوقف شد. بررسی شبکه یا یکپارچگی ناموفق بود؛ از همین صفحه دوباره امتحان کنید.',current:'این بیلد فعلی است. نصب و اجرای آن به رمز یا مجوز دستگاه نیاز ندارد.',older:'نسخهٔ جدید موجود است. تغییرات زیر را بخوانید و بدون رمز دانلود کنید.',unknown:'بیلد شناخته نشد؛ وضعیت به‌روزرسانی آن قابل تأیید نیست.',invalid:'کد کامل بیلد را از داخل MalGuard وارد کنید.'}
};
let release=null, history=[], state='loading', buildState=null, busy=false, received=0, controller=null;
function render() {
 const locale=language();
 element('downloadStatus').textContent=words[locale][state];
 element('downloadStatus').dataset.error=String(['denied','retry','failed','unavailable'].includes(state));
 element('downloadBytes').textContent=busy && release ? new Intl.NumberFormat(locale==='fa'?'fa-IR':'en-US').format(received)+' / '+new Intl.NumberFormat(locale==='fa'?'fa-IR':'en-US').format(release.size)+(locale==='fa'?' بایت':' bytes') : '';
 if(buildState)element('buildCheckStatus').textContent=words[locale][buildState];
 if(!release)return;
 for(const [id,value]of [['releaseVersion',release.version],['releaseEngine',release.engineVersion],['releaseBuild',release.build],['releaseHash',release.sha256],['sourceCommit',release.sourceCommit]])element(id).textContent=value;
 element('releaseSize').textContent=new Intl.NumberFormat(locale==='fa'?'fa-IR':'en-US').format(release.size)+(locale==='fa'?' بایت':' bytes');
 element('releaseChanges').replaceChildren(...release.changes[locale].map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
}
window.addEventListener('malguard-language',render);
element('buildCheckForm').addEventListener('submit',event=>{event.preventDefault();buildState=release?checkBuild(element('buildInput').value,release,history):null;render();});
element('cancelDownload').addEventListener('click',()=>{state='cancelled';controller?.abort();});
element('downloadForm').addEventListener('submit',async event=>{
 event.preventDefault();
 if(!release||busy)return;
 busy=true;received=0;
 element('downloadButton').disabled=true;
 element('cancelDownload').hidden=false;
 const progress=element('downloadProgress');progress.hidden=false;progress.max=release.size;progress.value=0;
 controller=new AbortController();const totalDeadline=setTimeout(()=>controller.abort(),600000);
 let url=null;
 try{
  state='receiving';render();
  const response=await fetch(INSTALLER_URL,{method:'GET',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',redirect:'error',signal:controller.signal});
  if(!response.ok){await response.body?.cancel();throw new Error('integrity');}
  const bytes=await readInstaller(response,release.size,count=>{received=count;progress.value=count;render();});
  state='verifying';render();
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  if(digest!==release.sha256||controller.signal.aborted)throw new Error('integrity');
  url=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));
  const link=document.createElement('a');link.href=url;link.download=release.filename;document.body.append(link);link.click();link.remove();
  state='saved';
 }catch(error){controller.abort();if(state!=='cancelled')state=['denied','retry'].includes(error.message)?error.message:'failed';}
 finally{
  clearTimeout(totalDeadline);
  if(url)setTimeout(()=>URL.revokeObjectURL(url),60000);
  progress.hidden=true;busy=false;controller=null;element('cancelDownload').hidden=true;element('downloadButton').disabled=false;render();
 }
});
async function initialize(){
 const abort=new AbortController(), deadline=setTimeout(()=>abort.abort(),15000);
 try{
  const response=await fetch('/release/malguard-current-release.json',{cache:'no-store',credentials:'omit',signal:abort.signal});
  if(!response.ok)throw new Error('metadata');
  const verified=validateRelease(await readJsonBounded(response,20000));
  if(verified.status!=='public-download-ready'||verified.serviceUrl!==INSTALLER_URL)throw new Error('metadata');
  release=verified;
  const records=await fetch('/release/malguard-release-history.json',{cache:'no-store',credentials:'omit',signal:abort.signal});
  if(records.ok){history=await readJsonBounded(records,100000);if(!Array.isArray(history)||history.length>1000)throw new Error('history');}
  state='ready';element('downloadButton').disabled=false;
 }catch{release=null;state='unavailable';element('downloadButton').disabled=true;}
 finally{clearTimeout(deadline);render();}
}
render();initialize();
