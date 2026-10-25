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

export const routedModels=['gemini_flash','groq_gptoss'];

// Remote Auto never schedules an on-device download or a different provider.
export const cloudRoutedModels=['cf_qwen3','cf_gptoss20','cf_gptoss120'];
export function planCloudChat(message,history=[]){
 const current=message.trim(),base=planChat(current,history);
 if(base.tier==='fast')return {...base,model:'cf_qwen3'};
 const followup=/^(?:ادامه|بیشتر|چرا|چطور|continue|more|why|how)[؟?.!\s]*$/iu.test(current);
 const context=followup?history.filter(m=>m.role==='user').slice(-2).map(m=>m.content).join('\n')+'\n'+current:current;
 const complex=/(?:^|\s)کد(?:\s|$)/u.test(context)||base.tier==='expert'||context.length>600||/```|\b(?:code|coding|debug|implement|algorithm|refactor)\b|کدنویسی|برنامه.?نویسی|دیباگ|الگوریتم|پیاده.?سازی/iu.test(context);
 if(complex)return {...base,tier:'expert',model:'cf_gptoss120',reason:'complex_request'};
 if(!base.needsWeb&&!followup&&context.length<=80&&!/\b(?:explain|why|how|compare|analy[sz]e)\b|توضیح|چرا|چطور|مقایسه|تحلیل/iu.test(context))return {...base,tier:'fast',model:'cf_qwen3',reason:'brief_request'};
 if(!base.needsWeb&&context.length<=100&&/^(?:what is|who is|define|translate|meaning of|معنی|ترجمه|چیست|کیست)(?:\s|$)/iu.test(context))return {...base,tier:'fast',model:'cf_qwen3',reason:'brief_request'};
 return {...base,tier:base.needsWeb?'strong':'medium',model:'cf_gptoss20'};
}
