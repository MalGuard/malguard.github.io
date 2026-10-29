// Bounded, deterministic scheduling; no model call is needed to choose a tier.
// These are routing hints, not a claim that difficulty can be measured perfectly.
export function planChat(message,history=[]){
 const current=message.trim();
 const prior=history.filter(m=>m.role==='user').slice(-2).map(m=>m.content).join('\n');
 const followup=/^(?:ادامه|بیشتر|چرا|چطور|continue|more|why|how)[؟?.!\s]*$/iu.test(current);
 const context=followup?`${prior}\n${current}`:current;
 const greeting=/^(?:سلام(?:[،,\s]+(?:خوبی|چطوری|چه خبر|حالت چطوره))?|درود|خوبی|چطوری|ممنون|مرسی|خداحافظ|hi|hello|hey|thanks|thank you|how are you)[!؟?.\s]*$/iu.test(current);
 if(greeting)return {tier:'fast',model:'local_fast',needsWeb:false,reason:'brief_conversation'};
 const needsWeb=/سرچ|جست.?جو|تحقیق|منابع|منبع|امروز|جدیدترین|آخرین|قیمت|اخبار|نسخه.?ی? جدید|\b(?:search|research|sources?|citations?|latest|today|current|news|prices?)\b/iu.test(context);
 const expert=/اثبات|استدلال پیچیده|خیلی سخت|چند.?مرحله|تحلیل عمیق|\b(?:prove|proof|very difficult|complex reasoning|deep analysis|multi.?step)\b/iu.test(context)||context.length>2500;
 if(expert)return {tier:'expert',model:'groq_gptoss',needsWeb,reason:'complex_request'};
 if(needsWeb||context.length>600)return {tier:'strong',model:'gemini_flash',needsWeb,reason:needsWeb?'research_request':'extended_request'};
 return {tier:'medium',model:'local_medium',needsWeb:false,reason:'general_request'};
}

// Priority lists are an allowlist; availability comes from the server's catalog.
export const tierModels=Object.freeze({
 fast:['cf_glm','cf_llama3b','cf_qwen3'],
 search:['gemini_flash','cf_qwen3','cf_gemma4'],
 build:['groq_qwen','cf_gptoss120','cf_qwen_coder'],
 coding:['cf_qwen_coder','groq_gptoss','cf_gptoss120'],
 expert:['groq_gptoss','cf_gptoss120','cf_nemotron'],
 medium:['cf_gptoss20','cf_qwen3']
});
export const routedModels=['gemini_flash','groq_qwen','groq_gptoss'];
export const cloudRoutedModels=[...new Set(Object.values(tierModels).flat())];
// Catalog state decides eligibility; only models configured by the backend can run.
export function cloudModelOffered(model){
 return !!model&&typeof model.id==='string'&&model.state==='configured';
}
export function planCloudChat(message,history=[],{models,mode,needsWeb=false}={}){
 const current=String(message||'').trim();
 const followup=/^(?:ادامه|بیشتر|چرا|چطور|continue|more|why|how)[؟?.!\s]*$/iu.test(current);
 const prior=history.filter(m=>m.role==='user').slice(-2).map(m=>m.content).join('\n');
 const context=followup?`${prior}\n${current}`:current;
 const web=needsWeb||/سرچ|جست.?جو|تحقیق|منابع|منبع|امروز|جدیدترین|آخرین|قیمت|اخبار|نسخه.?ی? جدید|\b(?:search|research|sources?|citations?|latest|today|current|news|prices?)\b/iu.test(context);
 const build=mode==='build'||/\b(?:build|create|make|generate)\b[^\n]{0,100}\b(?:ui|html|css|website|webpage|web page|interface|preview)\b|ساخت.{0,30}(?:صفحه|رابط|سایت)/iu.test(context);
 const expert=context.length>1500||/اثبات|استدلال پیچیده|چند.?مرحله|تحلیل عمیق|تحلیل امنیت|\b(?:prove|proof|theorem|complex reasoning|deep analysis|multi.?step|security analysis)\b/iu.test(context);
 const coding=/(?:^|\s)کد(?:\s|$)|```|\b(?:code|coding|debug|implement|algorithm|refactor|programming)\b|کدنویسی|برنامه.?نویسی|دیباگ|الگوریتم|پیاده.?سازی/iu.test(context);
 const brief=current.length<80&&!followup&&(/^(?:سلام|سلان|درود|ممنون|مرسی|خداحافظ|hi|hello|hey|thanks|thank you|how are you|translate|what is|who is|define|ترجمه|معنی|چیست|کیست)(?:[،,\s!؟?.]|$)/iu.test(current)||/^[\d+*/=(). -]+$/u.test(current));
 const tier=web?'search':build?'build':expert?'expert':coding?'coding':brief?'fast':'medium';
 // When no catalog is supplied, use the existing Cloudflare-only defaults.
 const configured=models===undefined?new Set(['cf_qwen3','cf_gptoss20','cf_gptoss120']):new Set(models.filter(m=>m.state==='configured').map(m=>m.id));
 const model=tierModels[tier].find(id=>configured.has(id))||cloudRoutedModels.find(id=>configured.has(id))||null;
 return {tier,model,needsWeb:web,reason:web?'research_request':build?'build_request':expert?'complex_request':coding?'coding_request':brief?'brief_request':'general_request'};
}

