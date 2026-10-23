import {parseRequest,InputError,report} from './contracts.js';
import {createGtaGuard} from './adapters/gta-guard.js';
import {createGameScamGuard} from './adapters/game-scam-guard.js';
import {createMalwareBazaar} from './adapters/malwarebazaar.js';
import {createUrlhaus} from './adapters/urlhaus.js';
import {aiWeb} from './adapters/ai-web.js';
import {modelAdapter} from './model.js';
import {replyLanguage} from './language.js';
export function createOrchestrator(adapters = {gta_guard:createGtaGuard(),game_scam_guard:createGameScamGuard(),malwarebazaar:createMalwareBazaar(),urlhaus:createUrlhaus(),ai_web:aiWeb},model=modelAdapter) {
  const status = () => ({model:model.status(), tools:Object.fromEntries(Object.entries(adapters).map(([id,a])=>[id,a.status()])),modes:['chat','worker'],history:'client_memory',streaming:'ndjson_events',retention:'no_application_storage'});
  async function execute(tool,input,consent,onEvent){
    const adapter=adapters[tool];
    if(!adapter)return report(tool,'insufficient',{reason:'tool_unavailable'});
    onEvent({phase:'tool_started',tool});
    const controller=new AbortController();let timer,operation;
    try{
      operation=adapter.run(input,{signal:controller.signal,consent});
      const result=await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('timeout'));},35000);})]);
      onEvent({phase:'tool_finished',tool,outcome:result.outcome});return result;
    }catch{
      onEvent({phase:'tool_finished',tool,outcome:'error'});return report(tool,'error',{reason:'service_failed',limitations:['The service failed; no safety conclusion is available.']});
    }finally{clearTimeout(timer);controller.abort();if(operation)await operation.catch(()=>{});}
  }
  async function run(body,onEvent=()=>{}){
    const request=parseRequest(body),{input,consent,locale,mode,history}=request;
    await refresh();
    const searchIntent=mode==='chat'&&/جست.?جو|سرچ|\b(?:search|look up|latest)\b/iu.test(request.message);
    const tool=request.tool!=='auto'?request.tool:input.file?'gta_guard':input.sha256?'malwarebazaar':input.url?'game_scam_guard':searchIntent?'ai_web':null;
    const wrap=extra=>({locale,mode,model:model.status(),...extra});
    if(!tool){
      if(mode==='worker'){
        const greeting=/^(سلام|درود|چطوری|خوبی|hi|hello|hey)[!؟?.\s]*$/iu.test(request.message.trim());
        return wrap({result:null,message:locale==='fa'?(greeting?'سلام! فایل یا لینک را بفرست تا بررسی کنم.':'این حالت برای بررسی فایل، هش و سایت است. برای گفت‌وگوی عادی یا سؤال فنی، حالت چت را انتخاب کن.'):(greeting?'Hi! Send a file or URL for inspection.':'This mode inspects files, hashes and websites. Switch to Chat for general or technical questions.')});
      }
      if(model.status().state!=='disabled'&&request.message.trim()){
        if(!consent.modelShare)throw new InputError('model_consent_required',403);
        onEvent({phase:'model_started',tool:'chat'});
        try{return wrap({result:null,generated:await model.respond(request.message,replyLanguage(request.message,locale,history),history,request.model)});}catch{return wrap({result:null,error:'model_unavailable'});}
      }
      return wrap({result:null,message:locale==='fa'?'اتصال مدل هنوز در سرور تنظیم نشده است؛ بررسی فایل و سایت در دسترس است.':'The server model connection is not configured yet. File and URL inspection remain available.'});
    }
    if(input.file&&tool!=='gta_guard')throw new InputError('file_only_gta_guard');
    if(tool==='ai_web'&&!Object.keys(input).length&&request.message.trim())input.query=request.message.trim().slice(0,500);
    if(input.file&&!consent.fileUpload)throw new InputError('file_consent_required',403);
    if(tool==='game_scam_guard'&&input.url&&!consent.websiteFetch)throw new InputError('website_consent_required',403);
    if(['malwarebazaar','urlhaus','ai_web'].includes(tool)&&Object.keys(input).length&&!consent.remoteLookup&&adapters[tool]?.status().state!=='disabled')throw new InputError('lookup_consent_required',403);
    if(request.tool!=='auto'||tool==='ai_web')return wrap({result:await execute(tool,input,consent,onEvent)});
    const results=[];
    if(input.file){
      const primary=await execute('gta_guard',input,consent,onEvent);results.push(primary);
      if(consent.remoteLookup&&primary.metadata?.sha256){
        const sha256=primary.metadata.sha256;
        results.push(...await Promise.all([execute('malwarebazaar',{sha256},consent,onEvent),execute('ai_web',{query:sha256},consent,onEvent)]));
      }
    }else{
      const plans=input.url?[['game_scam_guard',input],...(consent.remoteLookup?[['urlhaus',input],['ai_web',{query:input.url}]]:[])]:[['malwarebazaar',input],...(consent.remoteLookup?[['ai_web',{query:input.sha256}]]:[])];
      results.push(...await Promise.all(plans.map(([id,data])=>execute(id,data,id==='game_scam_guard'?{...consent,remoteLookup:false}:consent,onEvent))));
    }
    return wrap({result:results[0],results,message:locale==='fa'?'بررسی‌ها انجام شد؛ نتیجه و محدودیت هر منبع جداگانه آمده است. نبود گزارش، تضمین امنیت نیست.':'Checks finished. Each source has its own evidence and limits. An absent report does not guarantee safety.'});
  }
  async function refresh(){await Promise.all([model.refresh?.(),...Object.values(adapters).map(a=>a.refresh?.())]);}
  return {status,run,refresh};
}
