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
