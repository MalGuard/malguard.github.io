import {runCloudBehavior} from './cloud-execution.js';

// Provider failure is not a negative database match. Receiving bytes and
// executing them have separate consents; old clients only authorize analysis.
export async function routeFile(bytes,{name,artifact,intel,behaviorConsent=false,cloudBudget=1,onEvent=()=>{}},{behavior=runCloudBehavior}={}){
  const skip=(code,reason)=>({routing:{code,fallback:true,detail:reason},behavior:{status:'unavailable',executed:false,attempted:false,reason}});
  if(intel.status==='listed')return skip('known_threat','هش در پایگاه تهدید ثبت شده است؛ اجرای خودکار انجام نشد. شواهد ایستا و پاسخ پایگاه حفظ شده‌اند.');
  if(intel.status!=='not_found')return skip('lookup_unavailable','استعلام پایگاه کامل نشد؛ این وضعیت «فایل ناشناخته» محسوب نمی‌شود. تحلیل مستقل ایستا انجام شد.');
  if(behaviorConsent!==true)return skip('consent_required','هش در پایگاه یافت نشد؛ رضایت اجرای ابری داده نشده است. تحلیل چندلایهٔ ایستا انجام شد و فایل اجرا نشد.');
  if(cloudBudget<=0)return skip('cloud_budget','سقف دو تلاش ابری در این صف رسید؛ این مورد با تحلیل چندلایهٔ ایستا بررسی شد و اجرا نشد.');
  onEvent({phase:'cloud_execution',message:'فایل در پایگاه یافت نشد؛ کنترل سندباکس و ثبت رفتار محدود'});
  let evidence;
  try{evidence=await behavior(bytes,{name,format:artifact.format});}
  catch{evidence={status:'unavailable',executed:false,attempted:true,reason:'سندباکس پاسخ معتبر نداد؛ تحلیل مستقل ایستا حفظ شد و اجرای میزبان انجام نشد.'};}
  const completed=evidence.executed===true&&evidence.status==='done'&&evidence.teardownConfirmed===true;
  return {routing:{code:completed?'cloud_observed':'static_fallback',fallback:!completed,detail:completed?'رفتار در سندباکس مشاهده و محیط متوقف شد؛ شواهد ایستا نیز موجود است.':'سندباکس کامل یا سازگار نبود؛ نتیجهٔ تحلیل چندلایهٔ ایستا و محدودیت اجرا گزارش می‌شود.'},behavior:evidence};
}
