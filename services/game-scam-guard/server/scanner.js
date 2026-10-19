import { load } from 'cheerio';
import { createHash, randomUUID } from 'node:crypto';
import { fetchPublic, normalizeUrl, cleanUrlInput, resolvePublic, ScanError } from './network.js';
import { renderPreview } from './browser.js';
import { urlhausAuthKey, lookupUrl } from './threat-intel.js';
import { reportTokens } from './report-token.js';
import { inspectSite } from './site-analysis.js';
const riskyTerms = /crack|keygen|cheat|unlimited\s*(coins|gems)|free\s*(coins|gems)|کرک|چیت|سکه\s*نامحدود|جم\s*رایگان/i;
const sessions = new Map();
export const providerStatus = () => ({ urlhaus: Boolean(urlhausAuthKey()) });

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
  if(['ENOTFOUND','EAI_NONAME','ENODATA','dns_timeout'].includes(error.code))return {reason:'domain_not_found',detail:'این دامنه پیدا نشد. املای آدرس را بررسی کنید و دوباره تلاش کنید.'};
  if(['request_timeout','ETIMEDOUT'].includes(error.code))return {reason:'timeout',detail:'سایت در زمان مجاز پاسخ کامل نداد. وضعیت استعلام پایگاه تهدید جداگانه در گزارش آمده است؛ محتوای سایت و صفحه‌های آن قابل تأیید نیستند.'};
  if(error.remoteStatus)return {reason:'http_error',detail:`سایت پاسخ HTTP ${error.remoteStatus} داد؛ محتوای صفحه دریافت نشد.`};
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
  // Direct-download links remain in the bounded link inventory for context, but
  // GameScam Guard does not receive or analyze files.
  const files = [];
  $('script,style,noscript').remove();
  const pageText = clean($('body').text());
  const signals = [];
  if (new URL(baseUrl).protocol === 'http:') signals.push({ level: 'warning', title: 'ارتباط بدون رمزگذاری', detail: 'صفحهٔ نهایی با HTTP دریافت شد. اطلاعات پرداخت یا حساب را در آن وارد نکنید.' });
  if (riskyTerms.test(`${title} ${description} ${$('body').text()}`)) signals.push({ level: 'warning', title: 'ادعاهای نیازمند احتیاط', detail: 'در محتوای صفحه به کرک، چیت یا منابع رایگان بازی اشاره شده است؛ این نشانه به‌تنهایی اثبات کلاهبرداری نیست.' });
  if ($('input[type="password"]').length) signals.push({ level: 'info', title: 'فرم ورود شناسایی شد', detail: 'فرم درخواست رمز در صفحه وجود دارد. هویت رسمی سایت باید جداگانه تأیید شود.' });
  signals.push(...independent.signals);
  if (independent.linkInventory.omitted) signals.push({level:'info',title:'فهرست لینک‌ها کامل نگهداری نشده',detail:`${independent.linkInventory.total} لینک در HTML دیده شد؛ ${independent.linkInventory.omitted} ردیف به علت سقف اندازه یا تعداد در فهرست جزئیات نگهداری نشده است. مقصد لینک‌ها جداگانه باز نشده‌اند.`});
  return { title, description, headings, excerpt: pageText, files: files.slice(0, 128), fileCount: files.length, linkCount: $('a[href]').length, signals, contentType: headers['content-type'] || 'نامشخص',siteAnalysis:{...independent.siteAnalysis,htmlSha256:createHash('sha256').update(bytes).digest('hex'),receivedBytes:bytes.length},linkInventory:independent.linkInventory };
}

export async function scanSite(input,{transport=fetchPublic,lookup=lookupUrl,preview=renderPreview,validate=resolvePublic,pageOptions={},allowThreatContent=false,allowCloudPreview=false,onEvent=()=>{}}={}) {
  const requested = normalizeUrl(input);
  onEvent({phase:'url_validation',message:'Validating the public website address'});
  // Reject private/local addresses before any provider request. A DNS outage is
  // inconclusive, while the guarded page transport still validates every connection.
  let preflightError;
  let validationTimer;
  try { await Promise.race([validate(requested),new Promise((_,reject)=>{validationTimer=setTimeout(()=>reject(new ScanError('پاسخی از نام دامنه دریافت نشد.',422,'dns_timeout')),5000);validationTimer.unref();})]); }
  catch(error) { if(error.status===400)throw error;preflightError=error; }
  finally {clearTimeout(validationTimer);}
  const controller=new AbortController();
  onEvent({phase:'threat_lookup',message:'Checking known URL threat reports'});
  const intelTask=Promise.resolve().then(()=>lookup(requested.href)).catch(()=>({status:'unavailable',message:'استعلام URLhaus انجام نشد؛ امنیت این لینک تأیید نمی‌شود.'})).then(intel=>{onEvent({phase:'threat_lookup_done',message:intel.status==='listed'?'A known threat report was found':'Known URL threat lookup completed'});if(intel.status==='listed'&&!allowThreatContent)controller.abort();return intel;});
  onEvent({phase:'fetch_page',message:'Retrieving the public HTML page through the guarded network'});
  const pageTask=preflightError?Promise.reject(preflightError):fetchSitePage(requested,{transport,signal:controller.signal,...pageOptions});
  const [pageOutcome,intel]=await Promise.all([pageTask.then(value=>({value}),error=>({error})),intelTask]);
  if(pageOutcome.error?.status===400)throw pageOutcome.error;
  const inputAdjusted=cleanUrlInput(input)!==input.trim();
  if(pageOutcome.error) {
    const listed=intel.status==='listed';
    const failure=listed&&!allowThreatContent?{reason:'threat_blocked',detail:'گزارش تهدید دریافت شد؛ دریافت محتوای سایت متوقف شد.'}:pageFailure(pageOutcome.error);
    return rememberSite({id:randomUUID(),url:requested.href,finalUrl:requested.href,domain:requested.hostname,createdAt:new Date().toISOString(),status:listed?'danger':'unavailable',title:'محتوای صفحه دریافت نشد',description:'گزارش حاضر بر پایهٔ بررسی آدرس و پاسخ پایگاه تهدید است؛ داخل سایت مشاهده نشده است.',headings:[],excerpt:'',contentType:'نامشخص',files:[],fileCount:0,linkCount:0,signals:[{level:listed?'danger':'warning',title:listed?'لینک در پایگاه تهدید گزارش شده':'بررسی محتوای سایت کامل نشد',detail:listed?intel.message:failure.detail}],redirects:[],reputation:intel,finalReputation:intel,advanced:false,inputAdjusted,pageFetch:{status:'unavailable',...failure,attempts:pageOutcome.error.attempts||0},preview:{status:'skipped',detail:'بدون دریافت صفحه، پیش‌نمایش ساخته نمی‌شود.'},checks:[{title:'دریافت محتوای سایت',status:'unavailable',detail:failure.detail},{title:'استعلام URLhaus',status:['listed','not_found'].includes(intel.status)?'done':'unavailable',detail:intel.message}],limitations:['محتوای سایت، عنوان آن و لینک‌های عمومی قابل مشاهده نبودند؛ تعداد صفحه‌های پیوندشده نامشخص است.','عدم وجود گزارش در پایگاه تهدید به معنی امن بودن نیست.','بررسی پیشرفته تا دریافت محتوای سایت ممکن نیست.']});
  }
  const page=pageOutcome.value;
  onEvent({phase:'page_received',message:'Public page received; inspecting its visible HTML'});
  const mime = String(page.headers['content-type'] || '').toLowerCase();
  let evidence;
  const isHtml = mime.includes('html') || (!mime && /^\s*<!doctype html|^\s*<html/i.test(page.bytes.toString('utf8',0,100)));
  if (isHtml) evidence = parsePage(page.bytes, page.url, page.headers);
  else {
    evidence = { title: 'Direct file link', description: 'This address leads to a file or non-HTML content. GameScam Guard does not retrieve, hash, analyze, or execute files; use GTA Guard for file analysis.', headings: [], excerpt: '', fileCount: 0, linkCount: 0, signals: [{level:'info',title:'File analysis is handled by GTA Guard',detail:'Only the response headers were observed. The file was not downloaded, hashed, analyzed, or executed.'}], contentType: mime, files: [], fileScanExcluded:true, statusOverride:'unavailable' };
  }
  const finalIntel = page.url !== requested.href ? await lookup(page.url) : intel;
  if ([intel.status, finalIntel.status].includes('listed')) evidence.signals.unshift({ level: 'danger', title: 'لینک در پایگاه تهدید گزارش شده', detail: 'URLhaus برای لینک اولیه یا مقصد نهایی گزارش تهدید دارد. از دانلود و پرداخت خودداری کنید.' });
  if (page.redirects.some(r => new URL(r.from).hostname !== new URL(r.to).hostname)) evidence.signals.push({ level: 'warning', title: 'انتقال به دامنهٔ دیگر', detail: 'لینک به یک دامنهٔ دیگر منتقل شد. آدرس نهایی را پیش از خرید کنترل کنید.' });
  const status = evidence.signals.some(s=>s.level==='danger') ? 'danger' : evidence.statusOverride || (evidence.signals.some(s=>s.level==='warning') ? 'warning' : 'limited');
  if(isHtml && status !== 'danger' && allowCloudPreview)onEvent({phase:'cloud_browser',message:'Rendering an isolated cloud-browser snapshot'});
  const image = isHtml && status !== 'danger' && allowCloudPreview ? await preview(page.url, page.bytes) : {status:'skipped',detail:isHtml ? 'Cloud-browser preview is available after you choose Advanced website scan.' : 'No browser preview is created for a direct file link.'};
  if(image.status==='done')onEvent({phase:'cloud_browser_done',message:'Isolated browser snapshot is ready'});
  else if(isHtml && allowCloudPreview)onEvent({phase:'cloud_browser_unavailable',message:'The isolated browser preview was unavailable; HTML evidence is still shown'});
  const id = randomUUID();
  const result = { id, url: requested.href, finalUrl: page.url, domain: new URL(page.url).hostname, createdAt: new Date().toISOString(), status, ...evidence, preview:image, redirects: page.redirects, reputation: intel, finalReputation: finalIntel, advanced: false,inputAdjusted,pageFetch:{status:'done',attempts:page.attempts},
    checks: [{ title: isHtml ? 'دریافت محتوای سایت' : 'مشاهدهٔ سرآیند لینک مستقیم فایل', status: 'done', detail: isHtml ? `HTTP ${page.status} · ${(page.bytes.length/1024).toFixed(1)} KB` : `HTTP ${page.status} · The file was not retrieved or analyzed in GameScam Guard.` }, { title: 'بررسی ارتباط', status: 'done', detail: new URL(page.url).protocol === 'https:' ? 'HTTPS · اعتبارسنجی گواهی انجام شد' : 'HTTP · بدون رمزگذاری' }, { title: 'بررسی نشانه‌های صفحه', status: 'done', detail: `${evidence.linkCount} لینک در HTML دریافت‌شده بررسی شد` }, { title: 'استعلام URLhaus', status: ['listed','not_found'].includes(intel.status) ? 'done' : 'unavailable', detail: intel.message }],
    limitations: ['این بررسی محتوای عمومی HTML را می‌خواند؛ در پیش‌نمایش مرورگر، جاوااسکریپت، ورود، خرید و دانلود خودکار غیرفعال هستند.', 'عدم مشاهدهٔ تهدید به معنی تأیید اصالت فروشنده یا تضمین امنیت نیست.', 'Direct file links are not retrieved or analyzed here; use GTA Guard for files.'] };
  if (result.siteAnalysis) result.checks.splice(3,0,{title:'تحلیل مستقل محتوای HTML',status:'done',detail:`موتور ${result.siteAnalysis.version} · فرم‌ها، منابع اسکریپت، انتقال HTML و فهرست لینک‌ها بررسی شدند؛ جاوااسکریپت اجرا نشده است.`});
  return rememberSite(result);
}
