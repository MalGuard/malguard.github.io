// Independent inspection of received HTML. This module never connects to a URL,
// executes JavaScript, submits forms, or collects entered field values.
export const SITE_ENGINE_VERSION = '1.1.0';
export const FILE_LINK = /\.(exe|msi|apk|xapk|zip|rar|7z|dmg|pkg|iso|dll|asi|bat|cmd|ps1|scr|jar|deb|tar|gz|pdf|js|mjs|cjs|py|sh|elf|lua)(?:$|[?#])/i;
const short = (text, limit = 180) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, limit);

export function documentBase($, pageUrl) {
  try {
    const base = new URL($('base[href]').first().attr('href') || pageUrl, pageUrl);
    return ['http:', 'https:'].includes(base.protocol) ? base.href : pageUrl;
  } catch { return pageUrl; }
}

const endpoint = url => `${url.origin}${url.pathname}`; // No query, fragment, or credentials in form evidence.
const webTarget = (value, base) => {
  try {
    const url = new URL(value, base);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch { return null; }
};

export function inspectSite($, pageUrl) {
  const page = new URL(pageUrl);
  const base = documentBase($, pageUrl);
  const signals = [];
  const emitted = new Set();
  const add = (rule, title, detail, level = 'warning') => {
    if (emitted.has(rule)) return;
    emitted.add(rule); signals.push({rule, level, title, detail});
  };
  let sensitiveForms = 0;
  $('form').each((index, element) => {
    const form = $(element);
    const sensitive = form.find('input').toArray().some(input => {
      const node = $(input);
      return String(node.attr('type')).toLowerCase() === 'password'
        || /^cc-/.test(node.attr('autocomplete') || '')
        || /^(?:card[_-]?number|credit[_-]?card|cvv|cvc)$/i.test(node.attr('name') || '');
    });
    if (!sensitive) return;
    sensitiveForms++;
    // A missing/empty form action posts to the document URL, not its <base>.
    const action = form.attr('action');
    const actions = [action ? {value:action, base} : {value:page.href, base:page.href}];
    form.find('[formaction]').each((_, button) => {
      const value = $(button).attr('formaction');
      actions.push({value:value || page.href, base:value ? base : page.href, method:$(button).attr('formmethod')});
    });
    for (const candidate of actions) {
      const target = webTarget(candidate.value, candidate.base);
      if (!target) {
        add('sensitive_form_unreadable', 'مقصد فرم حساس قابل بررسی نیست', `فرم ${index + 1} فیلد رمز یا پرداخت دارد، اما مقصد آن یک آدرس وب قابل بررسی نیست. هیچ داده‌ای ارسال نشده است.`);
        continue;
      }
      if (page.protocol === 'http:' || target.protocol === 'http:') {
        add('sensitive_form_http', 'فرم حساس با ارتباط بدون رمزگذاری', `فرم ${index + 1} فیلد رمز یا پرداخت دارد؛ صفحه یا مقصد ارسال از HTTP استفاده می‌کند. مقصد مشاهده‌شده: ${endpoint(target)}. فرم ارسال نشده است.`);
      }
      if (target.origin !== page.origin) {
        add('sensitive_form_external', 'فرم حساس اطلاعات را به مبدأ دیگری می‌فرستد', `مقصد فرم ${index + 1}: ${endpoint(target)}. این تفاوت مبدأ به‌تنهایی اثبات سرقت اطلاعات نیست؛ هویت مقصد باید تأیید شود. هیچ اطلاعاتی ارسال نشده است.`);
      }
      const method = String(candidate.method || form.attr('method') || 'get').toLowerCase();
      if (!['post','dialog'].includes(method)) {
        add('sensitive_form_get', 'فرم حساس از روش GET استفاده می‌کند', `فرم ${index + 1} فیلد رمز یا پرداخت دارد و روش ارسال آن GET است؛ اطلاعات ممکن است وارد آدرس و تاریخچه شود. مقدار فیلدها خوانده یا ارسال نشده است.`);
      }
    }
  });

  let externalScripts = 0;
  let inlineScripts = 0;
  let nonExecutableScripts = 0;
  $('script').each((index, element) => {
    const script = $(element);
    const type = String(script.attr('type') || '').split(';')[0].trim().toLowerCase();
    if (type && !['module','text/javascript','application/javascript','text/ecmascript','application/ecmascript'].includes(type)) {
      nonExecutableScripts++; return;
    }
    if (script.attr('src')) {
      const target = webTarget(script.attr('src'), base);
      if (target && target.origin !== page.origin) externalScripts++;
      if (page.protocol === 'https:' && target?.protocol === 'http:') {
        add('active_mixed_content', 'اسکریپت HTTP در صفحهٔ HTTPS', `نشانی اسکریپت ${index + 1}: ${endpoint(target)}. مرورگر ممکن است آن را مسدود کند؛ صفحهٔ HTTPS به‌تنهایی اعتبار این منبع را تضمین نمی‌کند. اسکریپت دریافت یا اجرا نشده است.`);
      }
    } else {
      inlineScripts++;
      const source = script.html() || '';
      const decoder = /\b(?:atob|unescape|fromCharCode)\s*\(/.exec(source);
      const executor = /\b(?:eval|Function)\s*\(/.exec(source);
      if (decoder && executor) {
        add('encoded_dynamic_code', 'رمزگشایی و اجرای پویای کد در اسکریپت', `در اسکریپت داخلی ${index + 1} نشانه‌های ${short(decoder[0],40)} و ${short(executor[0],40)} دیده شد. این الگو در کد سالم هم ممکن است وجود داشته باشد و اثبات بدافزار نیست؛ کد اجرا نشده است.`);
      }
    }
  });

  let refreshCount = 0;
  $('meta[http-equiv]').each((_, element) => {
    const node = $(element);
    if (String(node.attr('http-equiv')).toLowerCase() !== 'refresh') return;
    const match = /(?:^|;)\s*url\s*=\s*['"]?([^'"]+)['"]?\s*$/i.exec(node.attr('content') || '');
    const target = match && webTarget(match[1].trim(), base);
    if (!target) return;
    refreshCount++;
    if (target.origin !== page.origin) {
      add('html_external_redirect', 'انتقال خودکار HTML به مبدأ دیگر', `مقصد نوشته‌شده در meta refresh: ${endpoint(target)}. این انتقال در بررسی HTML دنبال نشده است.`);
    }
  });

  const links = [];
  const seen = new Map();
  let totalLinks = 0; let bytes = 0; let omitted = 0; let deceptiveLinks=0;
  $('a[href]').each((_, element) => {
    const node = $(element);
    const position = ++totalLinks;
    const target = webTarget(node.attr('href'), base);
    if (target) target.hash = '';
    // Compare only explicit URL labels. Brand names alone are not evidence of impersonation.
    const label=short(node.text(),200);
    if(target&&/^https?:\/\/[^\s]+$/i.test(label)){
      const advertised=webTarget(label,page.href);
      if(advertised&&advertised.hostname.replace(/^www\./,'')!==target.hostname.replace(/^www\./,'')){
        deceptiveLinks++;
        add('link_destination_mismatch','Displayed link destination does not match',`A link displays ${advertised.hostname} but points to ${target.hostname}. It may be a tracking redirect or a deceptive link; neither destination was opened by this check.`);
      }
    }
    const url = target?.href;
    const duplicateOf = url ? seen.get(url) : undefined;
    if (url && !duplicateOf) seen.set(url, position);
    const item = {position, label:short(node.text(),90), status:'unscanned', kind:target && (FILE_LINK.test(target.pathname) || node.attr('download') !== undefined) ? 'file' : 'page'};
    if (url && url.length <= 2048) item.url = url;
    else {item.kind='unsupported';item.reason=url ? 'آدرس بیش از سقف مجاز است.' : 'مقصد یک لینک وب قابل بررسی نیست.';}
    if (duplicateOf) item.duplicateOf = duplicateOf;
    const size = Buffer.byteLength(JSON.stringify(item));
    if (links.length >= 128 || bytes + size > 24 * 1024) {omitted++;return;}
    links.push(item);bytes += size;
  });

  return {
    signals,
    siteAnalysis:{engine:'GameScam Guard HTML',version:SITE_ENGINE_VERSION,status:'done',scope:'received-html',rulesChecked:7,
      sensitiveForms,externalScripts,inlineScripts,nonExecutableScripts,refreshCount,deceptiveLinks,javaScriptExecuted:false,fileContentsRead:false},
    linkInventory:{total:totalLinks,retained:links.length,omitted,links,status:'discovered-only'},
    base,
  };
}
