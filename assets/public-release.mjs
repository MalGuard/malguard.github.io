import {validateRelease, checkBuild, readBounded, readJsonBounded} from './public-release-model.mjs';
import {language} from './i18n.mjs';
const element = id => document.getElementById(id);
const words = {
  en: {loading:'Checking release metadata',ready:'Public download is available. No password is required.',unavailable:'Release details cannot be verified. Public download is disabled; try again later.',receiving:'Receiving verified installer',verifying:'Checking SHA-256',saved:'Integrity verified. The installer is ready to save.',failed:'Download stopped. Integrity or network checks failed; do not run a partial file.',current:'This is the latest known build of the public edition. The private edition above requires its own password and device license.',privateCurrent:'This is the current private build. Installation requires the privately provided password and matching device license.',older:'A newer release of the public edition is available. Review the changes below and install the verified download.',unknown:'Build not recognized. Its update status cannot be confirmed.',invalid:'Enter the complete build code shown inside MalGuard.'},
  fa: {loading:'در حال بررسی مشخصات انتشار',ready:'دانلود عمومی در دسترس است؛ رمز لازم نیست.',unavailable:'مشخصات انتشار قابل تأیید نیست. دانلود عمومی غیرفعال است؛ بعداً دوباره امتحان کنید.',receiving:'در حال دریافت فایل نصب',verifying:'در حال بررسی SHA-256',saved:'یکپارچگی تأیید شد. فایل نصب آمادهٔ ذخیره است.',failed:'دانلود متوقف شد. بررسی شبکه یا یکپارچگی ناموفق بود؛ فایل ناقص را اجرا نکنید.',current:'این آخرین بیلد شناخته‌شدهٔ نسخهٔ عمومی است. نسخهٔ خصوصی بالا به رمز و مجوز دستگاه مخصوص خود نیاز دارد.',privateCurrent:'این بیلد فعلی نسخهٔ خصوصی است. نصب به رمز تحویل‌شدهٔ خصوصی و مجوز مطابق با دستگاه نیاز دارد.',older:'نسخهٔ عمومی جدید موجود است. تغییرات زیر را بخوانید و فایل تأییدشده را نصب کنید.',unknown:'بیلد شناخته نشد؛ وضعیت به‌روزرسانی آن قابل تأیید نیست.',invalid:'کد کامل بیلد را از داخل MalGuard وارد کنید.'}
};
let release = null, history = [], state = 'loading', buildState = null, busy = false;
function render() {
  const locale = language();
  element('downloadStatus').textContent = words[locale][state];
  if (buildState) element('buildCheckStatus').textContent = words[locale][buildState];
  if (!release) return;
  for (const [id,value] of [['releaseVersion',release.version],['releaseEngine',release.engineVersion],['releaseBuild',release.build],['releaseHash',release.sha256],['sourceCommit',release.sourceCommit]]) element(id).textContent = value;
  element('releaseSize').textContent = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(release.size) + (locale === 'fa' ? ' بایت' : ' bytes');
  element('releaseChanges').replaceChildren(...release.changes[locale].map(text => {const li=document.createElement('li');li.textContent=text;return li;}));
}
window.addEventListener('malguard-language', render);
element('buildCheckForm').addEventListener('submit', event => {
  event.preventDefault();
  const input = element('buildInput').value.trim();
  buildState = input.toUpperCase() === element('privateBuild').textContent.trim().toUpperCase() ? 'privateCurrent' : release ? checkBuild(input, release, history) : null;
  render();
});
element('downloadButton').addEventListener('click', async () => {
  if (!release || busy) return;
  busy = true;
  element('downloadButton').disabled = true;
  const progress = element('downloadProgress');
  progress.hidden = false; progress.max = release.size; progress.value = 0;
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 180000);
  let url = null;
  try {
    const bytes = new Uint8Array(release.size);
    let received = 0;
    state = 'receiving'; render();
    for (let part=0; part<release.partCount; part++) {
      const response = await fetch(release.serviceUrl, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({part}),credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:controller.signal});
      if (!response.ok || response.headers.get('x-part-index') !== String(part) || response.headers.get('x-file-size') !== String(release.size) || response.headers.get('x-file-sha256') !== release.sha256) {await response.body?.cancel();throw new Error('integrity');}
      const expected = Math.min(release.partBytes, release.size-received);
      const chunk = await readBounded(response, expected);
      bytes.set(chunk,received); received += chunk.length; progress.value = received;
    }
    state='verifying'; render();
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
    if (digest !== release.sha256 || controller.signal.aborted) throw new Error('integrity');
    url=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));
    const link=document.createElement('a');link.href=url;link.download=release.filename;document.body.append(link);link.click();link.remove();
    state='saved';render();
  } catch {controller.abort();state='failed';render();}
  finally {clearTimeout(deadline);if(url)setTimeout(()=>URL.revokeObjectURL(url),60000);progress.hidden=true;busy=false;element('downloadButton').disabled=false;}
});
async function initialize() {
  const controller=new AbortController();const deadline=setTimeout(()=>controller.abort(),15000);
  try {
    const response=await fetch('/release/malguard-public-release.json',{cache:'no-store',credentials:'omit',signal:controller.signal});
    if(!response.ok)throw new Error('metadata');
    release=validateRelease(await readJsonBounded(response,20000));
    const records=await fetch('/release/malguard-release-history.json',{cache:'no-store',credentials:'omit',signal:controller.signal});
    if(records.ok){history=await readJsonBounded(records,100000);if(!Array.isArray(history)||history.length>1000)throw new Error('history');}
    state='ready';element('downloadButton').disabled=false;
  } catch {release=null;state='unavailable';element('downloadButton').disabled=true;}
  finally {clearTimeout(deadline);render();}
}
render();initialize();
