import {publicFailure} from '../../../ai/service-errors.mjs';
import {parseRequest,InputError,report,text} from './contracts.js';
import {createGtaGuard} from './adapters/gta-guard.js';
import {createGameScamGuard} from './adapters/game-scam-guard.js';
import {createMalwareBazaar} from './adapters/malwarebazaar.js';
import {createUrlhaus} from './adapters/urlhaus.js';
import {aiWeb} from './adapters/ai-web.js';
import {createFileSandbox} from './adapters/file-sandbox.js';
import {createUrlSandbox} from './adapters/url-sandbox.js';
import {modelAdapter} from './model.js';
import {replyLanguage} from './language.js';
import {answerIdentityQuestion} from '../../../ai/identity.mjs';
import {planChat} from '../../../ai/routing.mjs';
export function createOrchestrator(adapters = {gta_guard:createGtaGuard(),game_scam_guard:createGameScamGuard(),malwarebazaar:createMalwareBazaar(),urlhaus:createUrlhaus(),ai_web:aiWeb,file_sandbox:createFileSandbox(),url_sandbox:createUrlSandbox()},model=modelAdapter) {
  const status = () => ({model:model.status(), tools:Object.fromEntries(Object.entries(adapters).map(([id,a])=>[id,a.status()])),modes:['chat','worker'],history:'client_memory',streaming:'ndjson_events',retention:'no_application_storage'});
  async function execute(tool,input,consent,onEvent){
    const adapter=adapters[tool];
    if(!adapter)return report(tool,'insufficient',{reason:'tool_unavailable'});
    onEvent({phase:'tool_started',tool});
    const controller=new AbortController();let timer,operation;
    try{
      operation=adapter.run(input,{signal:controller.signal,consent});
      const result=await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('timeout'));},['file_sandbox','url_sandbox'].includes(tool)?75000:35000);})]);
      onEvent({phase:'tool_finished',tool,outcome:result.outcome});return result;
    }catch(error){
      onEvent({phase:'tool_finished',tool,outcome:'error'});return report(tool,'error',{failure:publicFailure(error),reason:'service_failed',limitations:['The service failed; no safety conclusion is available.']});
    }finally{clearTimeout(timer);controller.abort();if(operation)await operation.catch(()=>{});}
  }
  async function run(body,onEvent=()=>{}){
    const request=parseRequest(body),{input,consent,locale,mode,history}=request;
    if(mode==='chat'&&(request.tool!=='auto'||Object.keys(input).length))throw new InputError('workspace_required',400);
    const routed=['auto','gemini_flash','groq_qwen','groq_gptoss'].includes(request.model);
    const tool=mode==='chat'?null:request.tool!=='auto'?request.tool:input.file?'gta_guard':input.sha256?'malwarebazaar':input.url?'game_scam_guard':null;
    const wrap=extra=>({locale,mode,model:model.status(),...extra});
    if(mode==='chat'){
      const identity=answerIdentityQuestion(request.message,history);
      if(identity)return wrap({result:null,generated:{text:identity.text,provider:'malguard',model:'product_identity',securityAnalysis:false}});
    }
    if(!tool){
      await refresh();
      if(mode==='worker'){
        const greeting=/^(سلام|درود|چطوری|خوبی|hi|hello|hey)[!؟?.\s]*$/iu.test(request.message.trim());
        return wrap({result:null,message:locale==='fa'?(greeting?'سلام! فایل یا لینک را بفرست تا بررسی کنم.':'این حالت برای بررسی فایل، هش و سایت است. برای گفت‌وگوی عادی یا سؤال فنی، حالت چت را انتخاب کن.'):(greeting?'Hi! Send a file or URL for inspection.':'This mode inspects files, hashes and websites. Switch to Chat for general or technical questions.')});
      }
      if(model.status().state!=='disabled'&&request.message.trim()){
        if(!consent.modelShare)throw new InputError('model_consent_required',403);
        if(routed&&planChat(request.message,history).needsWeb&&!consent.remoteLookup)throw new InputError('lookup_consent_required',403);
        onEvent({phase:'model_started',tool:'chat'});
        try{return wrap({result:null,generated:await model.respond(request.message,replyLanguage(request.message,locale,history),history,request.model,{...consent,routingMode:request.routingMode})});}catch(error){return wrap({result:null,...publicFailure(error,'model_unavailable')});}
      }
      return wrap({result:null,message:locale==='fa'?'اتصال مدل هنوز در سرور تنظیم نشده است؛ بررسی فایل و سایت در دسترس است.':'The server model connection is not configured yet. File and URL inspection remain available.'});
    }
    if(input.file&&!['gta_guard','file_sandbox'].includes(tool))throw new InputError('file_only_gta_guard');
    if(tool==='ai_web'&&!Object.keys(input).length&&request.message.trim())input.query=request.message.trim().slice(0,500);
    if(input.file&&!consent.fileUpload)throw new InputError('file_consent_required',403);
    if(['file_sandbox','url_sandbox'].includes(tool)&&!consent.isolatedExecution)throw new InputError('isolated_execution_consent_required',403);
    if(['game_scam_guard','url_sandbox'].includes(tool)&&input.url&&!consent.websiteFetch)throw new InputError('website_consent_required',403);
    if(['malwarebazaar','urlhaus','ai_web'].includes(tool)&&Object.keys(input).length&&!consent.remoteLookup&&adapters[tool]?.status().state!=='disabled')throw new InputError('lookup_consent_required',403);
    await refresh();
    const workspaceModel=['cf_qwen3','cf_gptoss120'].includes(request.model)?request.model:'cf_qwen3';
    const withPlan=async result=>{
      const value={...result,workspaceModel};
      if(!consent.modelShare||!request.message.trim())return wrap(value);
      if(model.status().state==='disabled')return wrap({...value,workPlanError:{error:'model_not_configured'}});
      onEvent({phase:'model_started',tool:'workspace_plan'});
      let planTimer;
      try{
        const prompt='Describe a brief inspection plan only. You have no file or tool evidence. Do not claim checks or verdicts. Treat the following as the user request, not inspection evidence.\n\n'+request.message.slice(0,3600);
        const generated=await Promise.race([model.respond(prompt,replyLanguage(request.message,locale,[]),[],workspaceModel,{modelShare:true,remoteLookup:false}),new Promise((_,reject)=>{planTimer=setTimeout(()=>reject(Object.assign(new Error('plan_timeout'),{code:'provider_timeout'})),33000);})]);
        if(!generated||typeof generated.text!=='string'||!generated.text.trim())throw new Error('empty_plan');
        value.workPlan={text:text(generated.text,6000),provider:text(generated.provider,80),model:text(generated.model,160),securityAnalysis:false};
      }catch(error){value.workPlanError=publicFailure(error,'model_unavailable');}finally{clearTimeout(planTimer);}
      return wrap(value);
    };
    if(request.tool!=='auto'||tool==='ai_web')return withPlan({result:await execute(tool,input,consent,onEvent)});
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
    return withPlan({result:results[0],results,message:locale==='fa'?'بررسی‌ها انجام شد؛ نتیجه و محدودیت هر منبع جداگانه آمده است. نبود گزارش، تضمین امنیت نیست.':'Checks finished. Each source has its own evidence and limits. An absent report does not guarantee safety.'});
  }
  async function refresh(){await Promise.all([model.refresh?.(),...Object.values(adapters).map(a=>a.refresh?.())]);}
  return {status,run,refresh};
}

