import {domainToUnicode} from 'node:url';
import ipaddr from 'ipaddr.js';
import {analyzerCatalog,ANALYSIS_VERSION} from '../shared/analyzer-catalog.js';
import {documentBase} from './site-analysis.js';
import {brandIdentitySignals} from '../shared/brand-identity.js';
import {scriptFacts} from './script-facts.js';

const endpoint=url=>url.origin+url.pathname; // Deliberately excludes query tokens and field values.
const web=(value,base)=>{try{const url=new URL(value,base);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url:null;}catch{return null;}};
const ruleModules={sensitive_form_unreadable:'form-destinations',sensitive_form_http:'form-destinations',sensitive_form_external:'form-destinations',sensitive_form_get:'form-methods',active_mixed_content:'script-transport',encoded_dynamic_code:'script-obfuscation',html_external_redirect:'html-redirects',link_destination_mismatch:'link-mismatch'};
const ruleMessages={
 sensitive_form_unreadable:['A sensitive form has no inspectable web destination.','فرم حساس مقصد وب قابل‌بررسی ندارد.'],
 sensitive_form_http:['A password or payment form uses an unencrypted page or destination.','صفحه یا مقصد فرم رمز یا پرداخت، بدون رمزگذاری است.'],
 sensitive_form_external:['A sensitive form sends to another origin. Verify that destination before entering data.','فرم حساس به مبدأ دیگری ارسال می‌شود. پیش از واردکردن اطلاعات، هویت مقصد را بررسی کنید.'],
 sensitive_form_get:['A sensitive form can expose its values in the URL using GET.','روش ارسال فرم حساس می‌تواند داده‌ها را در نشانی قرار دهد.'],
 active_mixed_content:['An HTTPS page references an unencrypted executable script.','صفحهٔ رمزگذاری‌شده به اسکریپت بدون رمزگذاری ارجاع داده است.'],
 encoded_dynamic_code:['Inline code combines decoding and dynamic evaluation; this is a heuristic, not proof of malware.','کد داخلی هم رمزگشایی و هم اجرای پویا دارد؛ این الگو به‌تنهایی اثبات بدافزار نیست.'],
 html_external_redirect:['A meta refresh points to another origin. The destination was not followed by this check.','انتقال خودکار صفحه به مبدأ دیگری اشاره می‌کند؛ این بررسی مقصد را باز نکرده است.'],
 link_destination_mismatch:['An explicit displayed URL has a different hostname from its actual link.','دامنهٔ نشانی نوشته‌شده روی لینک با دامنهٔ مقصد واقعی متفاوت است.']
};

export function analyzeWebsite($,pageUrl,baseSignals=[]){
 const page=new URL(pageUrl),base=documentBase($,pageUrl),signals=[],found=new Map();
 const shellInstructions=/(?:win(?:dows)?\s*\+\s*r|run\s+(?:dialog|command)|powershell|ویندوز\s*\+\s*r)/i.test($('body').text());
 const omittedForms=Math.max(0,$('form').length-256),omittedFrames=Math.max(0,$('iframe,frame').length-256),omittedPlugins=Math.max(0,$('object,embed').length-256);
 const add=(module,rule,en,fa,{level='warning',evidence=[]}={})=>{
   if(found.has(rule))return;found.set(rule,module);
   const catalog=analyzerCatalog.find(item=>item.id===module);
   signals.push({module,rule,level,title:catalog.name.fa,detail:fa,evidence:evidence.slice(0,5).map(value=>String(value).slice(0,240)),localized:{en:{title:catalog.name.en,detail:en},fa:{title:catalog.name.fa,detail:fa}}});
 };
 for(const signal of baseSignals){const module=ruleModules[signal.rule];if(!module)continue;const [en,fa]=ruleMessages[signal.rule];const urls=(signal.detail.match(/https?:\/\/[^\s،؛]+/g)||[]).map(value=>web(value,page.href)).filter(Boolean).map(endpoint);add(module,signal.rule,en,fa,{level:signal.level,evidence:urls});const retained=signals.at(-1);if(retained?.rule===signal.rule){retained.title=signal.title;retained.detail=signal.detail;}}
 const host=page.hostname.replace(/^\[|\]$/g,'');
 const unicode=domainToUnicode(host);
 const scripts=[/\p{Script=Latin}/u,/\p{Script=Cyrillic}/u,/\p{Script=Greek}/u];
 if(unicode.split('.').some(label=>scripts.filter(pattern=>pattern.test(label)).length>1))add('url-identity','mixed_script_host','The hostname mixes look-alike writing systems. Confirm the exact destination.','نام دامنه، خط‌های نوشتاری شبیه به هم را ترکیب کرده است. مقصد دقیق را بررسی کنید.',{evidence:[host,unicode]});
 if(ipaddr.isValid(host))add('url-identity','ip_literal_host','The address uses a numeric IP instead of a named website; ownership needs separate verification.','نشانی به‌جای نام وب‌سایت از آی‌پی عددی استفاده می‌کند؛ مالکیت باید جداگانه بررسی شود.',{level:'info',evidence:[host]});
 for(const signal of brandIdentitySignals(pageUrl))signals.push(signal);
 $('form').slice(0,256).each((_,el)=>{
   const form=$(el),action=form.attr('action'),target=web(action||page.href,action?base:page.href);
   const code=form.find('input').toArray().some(input=>/one-time-code/i.test($(input).attr('autocomplete')||'')||/^(?:otp|one.?time.?code|verification.?code|2fa|mfa)$/i.test($(input).attr('name')||''));
   const wallet=form.find('input,textarea').toArray().some(input=>/^(?:seed(?:[_-]?phrase)?|mnemonic|recovery[_-]?phrase|private[_-]?key)$/i.test($(input).attr('name')||''));
   const payment=form.find('input[autocomplete^="cc-"]').length>0;
   if(code&&(!target||target.origin!==page.origin||target.protocol==='http:'||String(form.attr('method')||'get').toLowerCase()!=='post'))add('verification-codes','code_form_boundary','A verification-code form has an external, unencrypted, unreadable or GET destination. No code was entered.','فرم کد تأیید مقصد بیرونی، بدون رمزگذاری، نامشخص یا روش ارسال گت دارد. هیچ کدی وارد نشده است.',{evidence:target?[endpoint(target)]:[]});
   if(wallet)add('wallet-secrets','wallet_secret_form','A form requests a wallet recovery phrase or private key. Do not share wallet secrets with an unverified website.','فرم، عبارت بازیابی یا کلید خصوصی کیف پول را درخواست می‌کند. اطلاعات محرمانهٔ کیف پول را در سایت تأییدنشده وارد نکنید.');
   if(payment&&(page.protocol==='http:'||target?.protocol==='http:'))add('payment-boundary','unencrypted_payment','Payment fields use unencrypted transport. No payment data was collected or submitted.','ارتباط فیلدهای پرداخت بدون رمزگذاری است. هیچ دادهٔ پرداختی خوانده یا ارسال نشده است.',{evidence:target?[endpoint(target)]:[]});
 });
 const scriptsText=[];let scannedScriptBytes=0,omittedScripts=0;
 $('script').each((_,el)=>{
   const node=$(el),type=String(node.attr('type')||'').split(';')[0].trim().toLowerCase();
   if(type&&!['module','text/javascript','application/javascript','text/ecmascript','application/ecmascript'].includes(type))return;
   if(node.attr('src')){
     const target=web(node.attr('src'),base);
     if(target&&target.origin!==page.origin&&!node.attr('integrity'))add('resource-integrity','external_script_without_integrity','An external script has no integrity metadata. This is common and is recorded as context, not a threat verdict.','اسکریپت بیرونی اطلاعات یکپارچگی ندارد. این وضعیت رایج است و به‌عنوان اطلاعات زمینه‌ای ثبت می‌شود.',{level:'info',evidence:[endpoint(target)]});
     if(target&&/(?:^|\.)(?:coinhive\.com|coin-hive\.com|cryptoloot\.pro)$/.test(target.hostname))add('web-mining','known_mining_script','A script references a known browser-mining service. The script was not fetched or executed.','اسکریپت به سرویس شناخته‌شدهٔ استخراج در مرورگر اشاره دارد؛ منبع دریافت یا اجرا نشده است.',{evidence:[endpoint(target)]});
     return;
   }
   const source=node.html()||'';
   if(!source.trim())return;
   if(scriptsText.length>=256||scannedScriptBytes+source.length>512*1024){omittedScripts++;return;}
   scannedScriptBytes+=source.length;const facts=scriptFacts(source);if(facts.status!=='done')omittedScripts++;scriptsText.push(facts);
 });
 for(const facts of scriptsText){
   const urls=facts.requests.slice(0,128).map(value=>web(value,page.href)).filter(Boolean);
   const external=urls.filter(url=>url.origin!==page.origin);
   if(facts.strings.some(value=>/password/i.test(value))&&facts.valueRead&&external.length)add('credential-network','credential_external_request','Inline code combines a password-value read with an external network endpoint. This pattern needs review; no code ran.','کد داخلی هم خواندن مقدار رمز و هم مقصد شبکهٔ بیرونی دارد. این الگو نیازمند بررسی است؛ کدی اجرا نشده است.',{evidence:external.map(endpoint)});
   if(shellInstructions&&facts.calls.some(name=>/(?:^|\.)(?:clipboard\.writeText|execCommand)$/.test(name))&&facts.strings.some(value=>/(?:powershell|mshta|cmd\.exe|curl\s+.+\|\s*(?:sh|bash)|iex\s*\()/i.test(value)))add('clipboard-traps','clipboard_shell_trap','A copy action is paired with shell-execution instructions, a pattern used in ClickFix attacks. Do not run copied commands.','عمل کپی همراه با راهنمای اجرای دستور دیده شد؛ این الگو در حملات کلیک‌فیکس استفاده می‌شود. دستور کپی‌شده را اجرا نکنید.');
   for(const value of facts.navigation){const target=web(value,page.href);if(target&&target.origin!==page.origin)add('script-navigation','external_script_redirect','Inline code names another origin as a navigation target. It was not followed.','کد داخلی، مبدأ دیگری را مقصد انتقال معرفی می‌کند. این انتقال دنبال نشده است.',{evidence:[endpoint(target)]});}
   if(facts.calls.includes('navigator.serviceWorker.register'))add('service-workers','service_worker_registration','Service-worker registration is present. This is a normal PWA capability and is not a malware finding.','ثبت سرویس‌ورکر وجود دارد. این قابلیت عادی برنامهٔ وب است و یافتهٔ بدافزار محسوب نمی‌شود.',{level:'info'});
   if(facts.calls.some(name=>/(?:^|\.)WebSocket$/.test(name))&&facts.strings.some(value=>/stratum\+tcp:\/\//i.test(value)))add('web-mining','mining_protocol_pattern','Inline code creates a mining-protocol socket. The code was not executed.','کد داخلی سوکت با پروتکل استخراج می‌سازد. کد اجرا نشده است.');
 }
 $('iframe,frame').slice(0,256).each((_,el)=>{
   const node=$(el),src=node.attr('src')||'';
   const target=web(src,base);
   if(/^\s*(?:javascript:|data:text\/html)/i.test(src)||/<(?:script|form|iframe|object)\b/i.test(node.attr('srcdoc')||''))add('encoded-documents','active_embedded_document','An embedded frame uses an active inline HTML or script document. It was not opened or executed.','قاب جاسازی‌شده از سند فعال صفحه یا اسکریپت استفاده می‌کند. محتوا باز یا اجرا نشده است.');
   if(target&&target.origin!==page.origin&&/(?:login|signin|sign-in|verify)/i.test(target.pathname))add('frame-boundaries','external_login_frame','A sign-in or verification frame points to another origin. Verify its ownership before entering credentials.','قاب ورود یا تأیید به مبدأ دیگری اشاره دارد. پیش از واردکردن اطلاعات، مالکیت آن را بررسی کنید.',{evidence:[endpoint(target)]});
 });
 $('object,embed').slice(0,256).each((_,el)=>{const node=$(el);if(/application\/(?:x-msdownload|x-shockwave-flash|x-java-applet)/i.test(node.attr('type')||'')||/^(?:clsid:)/i.test(node.attr('classid')||''))add('embedded-plugins','active_legacy_plugin','The page embeds a legacy executable plugin or ActiveX object. No plugin or payload was loaded.','صفحه افزونهٔ اجرایی قدیمی یا شیء اکتیوایکس دارد. هیچ افزونه یا محموله‌ای بارگذاری نشده است.');});
 const modules=analyzerCatalog.map(catalog=>{
   const findings=signals.filter(signal=>signal.module===catalog.id),warning=findings.some(item=>item.level==='warning');
   const incomplete=omittedScripts>0&&['script-obfuscation','credential-network','clipboard-traps','script-navigation','service-workers','web-mining'].includes(catalog.id)
    ||omittedForms>0&&['verification-codes','wallet-secrets','payment-boundary'].includes(catalog.id)
    ||omittedFrames>0&&['frame-boundaries','encoded-documents'].includes(catalog.id)
    ||omittedPlugins>0&&catalog.id==='embedded-plugins';
   return {id:catalog.id,status:warning?'finding':incomplete?'incomplete':'inspected',findings:findings.length,coverage:incomplete?'limited':'complete'};
 });
 return {version:ANALYSIS_VERSION,modules,signals,limits:{inlineScriptBytes:scannedScriptBytes,omittedScripts,omittedForms,omittedFrames,omittedPlugins,javaScriptExecuted:false,externalScriptsFetched:false}};
}
