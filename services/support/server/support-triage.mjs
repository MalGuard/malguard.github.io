// MalGuard Support: deterministic, local-to-server triage (no model and no repo access).
// Ticket content is untrusted data; never treat it as a command or authorization.
const MAX_CHARS=6000;
const signals={
  version:/(?:\bv\s?\d+\.\d+|\bversion\s*[:#]?\s*\d|\bbuild\s*[:#]?\s*\d|\bنسخه\s*[:：]?\s*[۰-۹0-9])/i,
  platform:/(?:windows\s*(?:10|11)?|android|ios|ipad(?:os)?|macos|linux|ویندوز|اندروید|آیفون|آیپد|لینوکس|مک)/i,
  steps:/(?:\bsteps?\b|reproduc|\bfirst\b.*\bthen\b|مراحل|بازتولید|اول.*بعد|وقتی.*(?:می|کرد))/i,
  expected:/(?:expected|should\s+(?:be|show|open)|انتظار|باید\s|قرار\s+بود)/i,
  actual:/(?:actual|instead|observed|\berror\b|\bfail|crash|خطا|ارور|نشد|کار\s+نمی|کرش)/i
};
const rules=[
 {id:'account',detect:/(?:login|sign.?in|password reset|forgot password|session expired|ورود|لاگین|حساب کاربری|رمز عبور)/i},
 {id:'network',detect:/(?:network|timeout|connection|offline|fetch failed|cors|503|502|504|اتصال|اینترنت|شبکه|تایم.?اوت|دسترسی)/i},
 {id:'scan',detect:/(?:scan|scanner|false positive|detection|malware|mod|اسکن|اسکنر|شناسایی|تشخیص|بدافزار|فایل)/i},
 {id:'install',detect:/(?:install|update|apk|download|version mismatch|نصب|دانلود|بروزرسانی|به.?روزرسانی|آپدیت)/i}
];
const security=/(?:vulnerabilit|security bug|exploit|data breach|account takeover|token leak|secret leaked|sql injection|xss|csrf|آسیب.?پذیری|نشت اطلاعات|لو رفتن توکن|دسترسی غیرمجاز|باگ امنیتی)/i;
const results={
 fa:{
  missing:{version:'نسخه دقیق برنامه',platform:'سیستم‌عامل و نسخه آن',steps:'مراحل تکرار خطا',expected:'رفتار موردانتظار',actual:'رفتار واقعی و پیام خطا'},
  generic:['بررسی کن مشکل در آخرین نسخه قابل‌تکرار هست یا نه.','متن دقیق خطا رو بدون رمز، توکن یا اطلاعات خصوصی یادداشت کن.'],
  account:['وضعیت ورود و پیام خطای نمایشی رو بررسی کن؛ رمز و کد تأیید نفرست.','اگر حساب قفل شده، از مسیر رسمی بازیابی حساب استفاده کن.'],
  network:['اتصال اینترنت و زمان وقوع خطا رو بدون غیرفعال‌کردن تنظیمات امنیتی بررسی کن.','اگر سرویس موقتاً قطع شده، زمان و کد پاسخ رو ثبت کن.'],
  scan:['نسخه اسکنر، نوع فایل و نتیجه نمایش‌داده‌شده رو ثبت کن.','فایل اجرایی یا بدافزار رو در تیکت عادی بارگذاری نکن.'],
  install:['نسخه نصب‌شده و نسخه‌ای که انتظار داشتی رو بررسی کن.','فقط از صفحه دانلود رسمی MalGuard استفاده کن.'],
  securityNotice:'این گزارش ممکنه امنیتی باشه. جزئیات حساس رو در تیکت عادی نفرست؛ از گزارش امنیتی خصوصی استفاده کن.',
  genericQuestion:'چه کاری انجام دادی و دقیقاً چه خطایی دیدی؟'
 },
 en:{
  missing:{version:'exact app version',platform:'operating system and version',steps:'steps to reproduce',expected:'expected behavior',actual:'observed behavior and exact error'},
  generic:['Check whether this happens again on the latest verified release.','Record the exact error without sharing passwords, tokens, or private data.'],
  account:['Check the visible sign-in error; never send your password or verification code.','Use the official account-recovery route if your account is locked.'],
  network:['Check connectivity and note when the error occurred; do not disable security controls.','Record the response code and time if a service appears temporarily unavailable.'],
  scan:['Record the scanner version, file type and displayed verdict.','Do not upload executables or malware in normal tickets.'],
  install:['Record the installed version and the version you expected.','Use only the official MalGuard download page.'],
  securityNotice:'This may be a security vulnerability. Do not include sensitive details in a normal ticket; use the private security-report route.',
  genericQuestion:'What action led to the problem, and what exact error did you see?'
 }
};
export function triageSupportCase({ticketKind='bug',text='',locale='fa'}={}) {
  if(!['bug','false-positive','feedback'].includes(ticketKind) ||
    typeof text!=='string'||!text.trim()||text.length>MAX_CHARS)
    throw Object.assign(new Error('invalid_triage_input'),{status:400});
  const lang=locale==='en'?'en':'fa',words=results[lang];
  const flags=Object.fromEntries(Object.entries(signals).map(([name,re])=>[name,re.test(text)]));
  const detected=rules.find(rule=>rule.detect.test(text))?.id||'generic';
  const category=ticketKind==='false-positive'?'scan':detected;
  const securityRisk=security.test(text);
  const missing=Object.entries(flags).filter(([,found])=>!found).map(([key])=>words.missing[key]);
  const hints=(words[category]||words.generic).slice(0,2);
  return {
    category,priority:securityRisk?'manual_security_review':'standard',
    needsPrivateSecurityRoute:securityRisk,
    missingDetails:missing.slice(0,5),
    safeChecks:securityRisk?[]:hints,
    suggestedFollowUp:missing[0]?(lang==='fa'?'لطفاً این مورد رو هم مشخص کن: ':'Please also provide: ')+missing[0]:
      words.genericQuestion,
    notice:securityRisk?words.securityNotice:null,
    actionTaken:'none',
    source:'deterministic-server-rule',
    modelUsed:false,
    confidence:'not_a_diagnosis'
  };
}
