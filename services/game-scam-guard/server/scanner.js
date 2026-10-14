import { load } from 'cheerio';
import { createHash, randomUUID } from 'node:crypto';
import { fetchPublic, normalizeUrl, cleanUrlInput, resolvePublic, ScanError } from './network.js';
import { renderPreview } from './browser.js';
import { urlhausAuthKey, malwareBazaarAuthKey, lookupFileHash, lookupUrl } from './threat-intel.js';
import { reportTokens } from './report-token.js';
import { inspectSite, FILE_LINK } from './site-analysis.js';
import {analyzeArtifact} from './artifact-analysis.js';
import {receivedFilename} from './received-filename.js';

const FILE_EXT = FILE_LINK;
const riskyTerms = /crack|keygen|cheat|unlimited\s*(coins|gems)|free\s*(coins|gems)|کرک|چیت|سکه\s*نامحدود|جم\s*رایگان/i;
const sessions = new Map();
export const providerStatus = () => ({ urlhaus: Boolean(urlhausAuthKey()), malwarebazaar: Boolean(malwareBazaarAuthKey()) });

const reputation = (type, value) => type === 'hash' ? lookupFileHash(value) : lookupUrl(value);

// Retry only transient page failures, once, within a single overall budget.
export async function fetchSitePage(url,{transport=fetchPublic,signal,totalTimeout=22000,timeout=11000,now=Date.now}={}) {
  const deadline=now()+totalTimeout;
  for(let attempt=1;attempt<=2;attempt++) {
    const remaining=deadline-now();
    if(remaining<=0) throw new ScanError('زمان دریافت پاسخ تمام شد؛ دوباره تلاش کنید.',422,'request_timeout');
    try {
      const page=await transport(url,{htmlOnly:true,signal,totalTimeout:remaining,timeout:Math.min(timeout,remaining)});
      return {...page,attempts:attempt};
    } catch(error) {
      error.attempts=attempt;
      const retryable=['request_timeout','dns_timeout','ETIMEDOUT','ECONNRESET','EAI_AGAIN'].includes(error.code)||[408,500,502,503,504].includes(error.remoteStatus);
      if(!retryable||attempt===2||signal?.aborted||now()>=deadline) throw error;
    }
  }
}

function pageFailure(error) {
  if(['request_timeout','dns_timeout','ETIMEDOUT'].includes(error.code))return {reason:'timeout',detail:'سایت در زمان مجاز پاسخ کامل نداد. وضعیت استعلام پایگاه تهدید جداگانه در گزارش آمده است؛ محتوای سایت و فایل‌های آن قابل تأیید نیستند.'};
  if(error.remoteStatus)return {reason:'http_error',detail:`سایت پاسخ HTTP ${error.remoteStatus} داد؛ محتوای صفحه و فایل‌ها دریافت نشدند.`};
  if(/CERT|TLS|SSL/.test(error.code||''))return {reason:'tls_error',detail:'اتصال دارای گواهی قابل تأیید نبود. کنترل گواهی غیرفعال نشده و محتوای سایت دریافت نشده است.'};
  return {reason:'network_error',detail:'دریافت محتوای سایت از سرور ممکن نشد؛ این به‌تنهایی امن یا خطرناک بودن سایت را ثابت نمی‌کند.'};
}

function rememberSite(result) {
  result.scanToken=reportTokens.issue(result);
  sessions.set(result.id,{result,expires:Date.now()+30*60*1000,running:false});
  for(const [key,value]of sessions)if(value.expires<Date.now())sessions.delete(key);
  if(sessions.size>200)sessions.delete(sessions.keys().next().value);
  return result;
}

export function parsePage(bytes, baseUrl, headers = {}) {
  const $ = load(bytes.toString('utf8'));
  const independent = inspectSite($, baseUrl);
  const clean = v => v.replace(/\s+/g, ' ').trim().slice(0, 240);
  const title = clean($('title').first().text()) || 'بدون عنوان';
  const description = clean($('meta[name="description"]').attr('content') || '');
  const headings = $('h1,h2').map((_, el) => clean($(el).text())).get().filter(Boolean).slice(0, 5);
  const files = []; const seen = new Set();
  $('a[href]').each((_, el) => {
    const a = $(el); let url;
    try { url = new URL(a.attr('href'), independent.base); } catch { return; }
    if (!['http:', 'https:'].includes(url.protocol) || url.href.length > 2048 || seen.has(url.href)) return;
    if (FILE_EXT.test(url.pathname) || a.attr('download') !== undefined) {
      seen.add(url.href);
      const extension = url.pathname.match(/\.([a-z0-9]{1,6})$/i)?.[1]?.toUpperCase() || 'FILE';
      let name; try { name = decodeURIComponent(url.pathname.split('/').pop()); } catch { name = url.pathname.split('/').pop(); }
      files.push({ id: randomUUID(), name: (name || clean(a.text()) || 'فایل').slice(0, 180), url: url.href, label: clean(a.text()), extension, external: url.origin !== new URL(baseUrl).origin, status: 'unscanned' });
    }
  });
  $('script,style,noscript').remove();
  const pageText = clean($('body').text());
  const signals = [];
  if (new URL(baseUrl).protocol === 'http:') signals.push({ level: 'warning', title: 'ارتباط بدون رمزگذاری', detail: 'صفحهٔ نهایی با HTTP دریافت شد. اطلاعات پرداخت یا حساب را در آن وارد نکنید.' });
  if (riskyTerms.test(`${title} ${description} ${$('body').text()}`)) signals.push({ level: 'warning', title: 'ادعاهای نیازمند احتیاط', detail: 'در محتوای صفحه به کرک، چیت یا منابع رایگان بازی اشاره شده است؛ این نشانه به‌تنهایی اثبات کلاهبرداری نیست.' });
  if ($('input[type="password"]').length) signals.push({ level: 'info', title: 'فرم ورود شناسایی شد', detail: 'فرم درخواست رمز در صفحه وجود دارد. هویت رسمی سایت باید جداگانه تأیید شود.' });
  if (files.length) signals.push({ code: 'file_discovery', level: 'info', title: `${files.length} لینک فایل پیدا شد`, detail: 'محتوای این فایل‌ها در بررسی اولیه دریافت نشده است.' });
  signals.push(...independent.signals);
  if (files.length > 128) signals.push({level:'info',title:'پوشش محدود فهرست فایل‌ها',detail:`${files.length} مقصد فایل شناسایی شد؛ ۱۲۸ مورد در فهرست بررسی فایل نگه داشته شده است. همهٔ فایل‌ها بررسی نشده‌اند.`});
  if (independent.linkInventory.omitted) signals.push({level:'info',title:'فهرست لینک‌ها کامل نگهداری نشده',detail:`${independent.linkInventory.total} لینک در HTML دیده شد؛ ${independent.linkInventory.omitted} ردیف به علت سقف اندازه یا تعداد در فهرست جزئیات نگهداری نشده است. مقصد لینک‌ها جداگانه باز نشده‌اند.`});
  return { title, description, headings, excerpt: pageText, files: files.slice(0, 128), fileCount: files.length, linkCount: $('a[href]').length, signals, contentType: headers['content-type'] || 'نامشخص',siteAnalysis:{...independent.siteAnalysis,htmlSha256:createHash('sha256').update(bytes).digest('hex'),receivedBytes:bytes.length},linkInventory:independent.linkInventory };
}

export async function scanSite(input,{transport=fetchPublic,lookup=lookupUrl,preview=renderPreview,validate=resolvePublic,pageOptions={},allowThreatContent=false}={}) {
  const requested = normalizeUrl(input);
  // Reject private/local addresses before any provider request. A DNS outage is
  // inconclusive, while the guarded page transport still validates every connection.
  let preflightError;
  let validationTimer;
  try { await Promise.race([validate(requested),new Promise((_,reject)=>{validationTimer=setTimeout(()=>reject(new ScanError('پاسخی از نام دامنه دریافت نشد.',422,'dns_timeout')),5000);validationTimer.unref();})]); }
  catch(error) { if(error.status===400)throw error;preflightError=error; }
  finally {clearTimeout(validationTimer);}
  const controller=new AbortController();
  const intelTask=Promise.resolve().then(()=>lookup(requested.href)).catch(()=>({status:'unavailable',message:'استعلام URLhaus انجام نشد؛ امنیت این لینک تأیید نمی‌شود.'})).then(intel=>{if(intel.status==='listed'&&!allowThreatContent)controller.abort();return intel;});
  const pageTask=preflightError?Promise.reject(preflightError):fetchSitePage(requested,{transport,signal:controller.signal,...pageOptions});
  const [pageOutcome,intel]=await Promise.all([pageTask.then(value=>({value}),error=>({error})),intelTask]);
  if(pageOutcome.error?.status===400)throw pageOutcome.error;
  const inputAdjusted=cleanUrlInput(input)!==input.trim();
  if(pageOutcome.error) {
    const listed=intel.status==='listed';
    const failure=listed&&!allowThreatContent?{reason:'threat_blocked',detail:'گزارش تهدید دریافت شد؛ دریافت محتوا متوقف شده و بررسی فایل مجاز نیست.'}:pageFailure(pageOutcome.error);
    return rememberSite({id:randomUUID(),url:requested.href,finalUrl:requested.href,domain:requested.hostname,createdAt:new Date().toISOString(),status:listed?'danger':'unavailable',title:'محتوای صفحه دریافت نشد',description:'گزارش حاضر بر پایهٔ بررسی آدرس و پاسخ پایگاه تهدید است؛ داخل سایت مشاهده نشده است.',headings:[],excerpt:'',contentType:'نامشخص',files:[],fileCount:0,linkCount:0,signals:[{level:listed?'danger':'warning',title:listed?'لینک در پایگاه تهدید گزارش شده':'بررسی محتوای سایت کامل نشد',detail:listed?intel.message:failure.detail}],redirects:[],reputation:intel,finalReputation:intel,advanced:false,inputAdjusted,pageFetch:{status:'unavailable',...failure,attempts:pageOutcome.error.attempts||0},preview:{status:'skipped',detail:'بدون دریافت صفحه، پیش‌نمایش ساخته نمی‌شود.'},checks:[{title:'دریافت محتوای سایت',status:'unavailable',detail:failure.detail},{title:'استعلام URLhaus',status:['listed','not_found'].includes(intel.status)?'done':'unavailable',detail:intel.message}],limitations:['محتوای سایت، عنوان آن و لینک‌های فایل قابل مشاهده نبودند؛ تعداد فایل‌ها و امنیت آن‌ها نامشخص است.','عدم وجود گزارش در پایگاه تهدید به معنی امن بودن نیست.','بررسی پیشرفته تا دریافت محتوای سایت ممکن نیست.']});
  }
  const page=pageOutcome.value;
  const mime = String(page.headers['content-type'] || '').toLowerCase();
  let evidence;
  const isHtml = mime.includes('html') || (!mime && /^\s*<!doctype html|^\s*<html/i.test(page.bytes.toString('utf8',0,100)));
  if (isHtml) evidence = parsePage(page.bytes, page.url, page.headers);
  else {
    const name = receivedFilename(page);
    evidence = { title: name, description: 'این لینک مستقیماً به یک فایل یا محتوای غیر HTML اشاره می‌کند.', headings: [], excerpt: '', fileCount: 1, linkCount: 0, signals: [], contentType: mime, files: [{ id: randomUUID(), name, url: page.url, label: name, extension: name.split('.').pop().toUpperCase(), external: false, status: 'unscanned' }] };
  }
  const finalIntel = page.url !== requested.href ? await lookup(page.url) : intel;
  if ([intel.status, finalIntel.status].includes('listed')) evidence.signals.unshift({ level: 'danger', title: 'لینک در پایگاه تهدید گزارش شده', detail: 'URLhaus برای لینک اولیه یا مقصد نهایی گزارش تهدید دارد. از دانلود و پرداخت خودداری کنید.' });
  if (page.redirects.some(r => new URL(r.from).hostname !== new URL(r.to).hostname)) evidence.signals.push({ level: 'warning', title: 'انتقال به دامنهٔ دیگر', detail: 'لینک به یک دامنهٔ دیگر منتقل شد. آدرس نهایی را پیش از خرید کنترل کنید.' });
  const status = evidence.signals.some(s=>s.level==='danger') ? 'danger' : evidence.signals.some(s=>s.level==='warning') ? 'warning' : 'limited';
  const image = isHtml && status !== 'danger' ? await preview(page.url, page.bytes) : {status:'skipped',detail:'برای لینک مستقیم فایل یا لینک دارای گزارش تهدید، پیش‌نمایش ساخته نمی‌شود.'};
  const id = randomUUID();
  const result = { id, url: requested.href, finalUrl: page.url, domain: new URL(page.url).hostname, createdAt: new Date().toISOString(), status, ...evidence, preview:image, redirects: page.redirects, reputation: intel, finalReputation: finalIntel, advanced: false,inputAdjusted,pageFetch:{status:'done',attempts:page.attempts},
    checks: [{ title: isHtml ? 'دریافت محتوای سایت' : 'دریافت سرآیند لینک فایل', status: 'done', detail: isHtml ? `HTTP ${page.status} · ${(page.bytes.length/1024).toFixed(1)} KB` : `HTTP ${page.status} · محتوای فایل تا تأیید شما بررسی نمی‌شود` }, { title: 'بررسی ارتباط', status: 'done', detail: new URL(page.url).protocol === 'https:' ? 'HTTPS · اعتبارسنجی گواهی انجام شد' : 'HTTP · بدون رمزگذاری' }, { title: 'بررسی نشانه‌های صفحه', status: 'done', detail: `${evidence.linkCount} لینک و ${evidence.fileCount} لینک فایل` }, { title: 'استعلام URLhaus', status: ['listed','not_found'].includes(intel.status) ? 'done' : 'unavailable', detail: intel.message }],
    limitations: ['این بررسی محتوای عمومی HTML را می‌خواند؛ در پیش‌نمایش مرورگر، جاوااسکریپت، ورود، خرید و دانلود خودکار غیرفعال هستند.', 'عدم مشاهدهٔ تهدید به معنی تأیید اصالت فروشنده یا تضمین امنیت نیست.', 'فقط لینک‌های فایل قابل مشاهده در همین صفحه شناسایی می‌شوند.'] };
  if (result.siteAnalysis) result.checks.splice(3,0,{title:'تحلیل مستقل محتوای HTML',status:'done',detail:`موتور ${result.siteAnalysis.version} · فرم‌ها، منابع اسکریپت، انتقال HTML و فهرست لینک‌ها بررسی شدند؛ جاوااسکریپت اجرا نشده است.`});
  return rememberSite(result);
}

export function identifyFile(bytes) {
  if (bytes.subarray(0,2).toString() === 'MZ') return 'PE / Windows executable';
  if (bytes.subarray(0,4).equals(Buffer.from([0x7f,0x45,0x4c,0x46]))) return 'ELF executable';
  if (bytes.subarray(0,4).equals(Buffer.from([0x50,0x4b,0x03,0x04]))) return 'ZIP / APK archive';
  if (bytes.subarray(0,4).toString() === 'Rar!') return 'RAR archive';
  if (bytes.subarray(0,4).toString() === '%PDF') return 'PDF document';
  if (/^\s*<!doctype html|^\s*<html/i.test(bytes.toString('utf8',0,200))) return 'HTML page';
  return 'Unknown binary / text';
}

export async function scanFiles(id, token) {
  const restored = token ? reportTokens.read(token,id) : null;
  const session = sessions.get(id) || restored;
  if (!session || session.expires < Date.now()) throw new ScanError('گزارش منقضی شده است. لینک سایت را دوباره بررسی کنید.', 404);
  if (session.running) throw new ScanError('بررسی پیشرفتهٔ این گزارش در حال اجراست.', 409);
  if (session.result.advanced) return session.result;
  if (session.result.status === 'danger') throw new ScanError('لینک دارای گزارش تهدید است؛ بررسی فایل برای این گزارش متوقف شده است.');
  if(session.result.pageFetch?.status==='unavailable')throw new ScanError('ابتدا باید محتوای سایت دریافت شود؛ هنوز هیچ لینک فایلی برای بررسی شناسایی نشده است.',409);
  sessions.set(id,session);
  session.running = true;
  try {
    const results = [];
    for (const [index, file] of session.result.files.entries()) {
      if (index >= 5) { results.push({ ...file, status: 'skipped', detail: 'سقف بررسی پیشرفته ۵ فایل در هر گزارش است.' }); continue; }
      try {
        const response = await fetchPublic(file.url, { limit: 12 * 1024 * 1024, totalTimeout: 20000, timeout: 10000 });
        const hash = createHash('sha256').update(response.bytes).digest('hex');
        const format = identifyFile(response.bytes);
        const name=receivedFilename(response,file.name);
        const artifact=await analyzeArtifact(response.bytes,name);
        const intel = await reputation('hash', hash);
        const executable = /executable/.test(format) || /^(APK|XAPK|BAT|CMD|PS1|SCR|DLL|JAR)$/i.test(file.extension);
        const mismatch = format === 'HTML page';
        results.push({ ...file,name,extension:name.split('.').pop().slice(0,6).toUpperCase(), status: intel.status === 'listed' ? 'danger' : mismatch || executable || artifact.findings.length ? 'warning' : artifact.status==='complete'?'limited':'unavailable', size: response.bytes.length, sha256: hash, format,artifact, reputation: intel, detail: intel.status === 'listed' ? `گزارش بدافزار: ${intel.signature}` : mismatch ? 'مقصد یک صفحهٔ HTML است؛ فایل مورد انتظار دریافت نشد.' : artifact.details.join(' ') });
      } catch (error) { results.push({ ...file, status: 'unavailable', detail: error instanceof ScanError ? error.message : 'دریافت فایل ممکن نشد؛ امنیت آن قابل ارزیابی نیست.' }); }
    }
    session.result = { ...session.result, files: results, advanced: true, advancedAt: new Date().toISOString(), status: results.some(f=>f.status==='danger') ? 'danger' : session.result.status==='warning' || results.some(f=>f.status==='warning') ? 'warning' : 'limited' };
    return session.result;
  } finally { session.running = false; }
}
