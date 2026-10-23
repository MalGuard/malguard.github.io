import {parseRequest,InputError,report} from './contracts.js';
import {createGtaGuard} from './adapters/gta-guard.js';
import {createGameScamGuard} from './adapters/game-scam-guard.js';
import {createMalwareBazaar} from './adapters/malwarebazaar.js';
import {createUrlhaus} from './adapters/urlhaus.js';
import {aiWeb} from './adapters/ai-web.js';
import {modelAdapter} from './model.js';
export function createOrchestrator(adapters = {gta_guard:createGtaGuard(),game_scam_guard:createGameScamGuard(),malwarebazaar:createMalwareBazaar(),urlhaus:createUrlhaus(),ai_web:aiWeb},model=modelAdapter) {
  const status = () => ({model:model.status(), tools:Object.fromEntries(Object.entries(adapters).map(([id,a])=>[id,a.status()])),history:'off',streaming:'ndjson_events',retention:'no_application_storage'});
  async function run(body,onEvent=()=>{}) {
    const request = parseRequest(body);
    const {input,consent,locale} = request;
    const tool = request.tool !== 'auto' ? request.tool : input.file?'gta_guard':input.sha256?'malwarebazaar':input.url?'game_scam_guard':null;
    if (!tool) {
      if(model.status().state!=='disabled'&&request.message.trim()){
        if(!consent.modelShare)throw new InputError('model_consent_required',403);
        try{return {locale,model:status().model,result:null,generated:await model.respond(request.message,locale)};}catch{return {locale,model:status().model,result:null,error:'model_unavailable'};}
      }
      return {locale,model:status().model,result:null,message:locale==='fa'?'یک فایل، هش SHA-256 یا لینک وارد کنید، یا ابزار را انتخاب کنید. مدل گفت‌وگوی مولد متصل نیست.':'Enter a file, SHA-256 or URL, or select a tool. A generative chat model is not connected.'};
    }
    if(tool==='ai_web'&&!Object.keys(input).length&&request.message.trim())input.query=request.message.trim().slice(0,500);
    const adapter=adapters[tool];
    if (adapter.status().state !== 'disabled') {
      if (input.file && !consent.fileUpload) throw new InputError('file_consent_required',403);
      if (tool === 'game_scam_guard' && input.url && !consent.websiteFetch) throw new InputError('website_consent_required',403);
      if (['malwarebazaar','urlhaus','ai_web'].includes(tool) && Object.keys(input).length && !consent.remoteLookup) throw new InputError('lookup_consent_required',403);
    }
    if(input.file&&tool!=='gta_guard')throw new InputError('file_only_gta_guard');
    onEvent({phase:'tool_started',tool});
    const controller = new AbortController();
    let timer,operation;
    try {
      operation=adapter.run(input,{signal:controller.signal,consent});
      const result = await Promise.race([
        operation,
        new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('tool_timeout'));},35000);})
      ]);
      onEvent({phase:'tool_finished',tool,outcome:result.outcome});
      return {locale,model:status().model,result};
    } catch {
      onEvent({phase:'tool_finished',tool,outcome:'error'});
      return {locale,model:status().model,result:report(tool,'error',{reason:'service_failed',limitations:['The service failed or exceeded its time budget. No safety conclusion is available.']})};
    } finally {
      clearTimeout(timer);controller.abort();
      // Keep the caller's concurrency slot until bounded transport/Worker work
      // has settled, even after a deadline or closed client connection.
      if(operation)await operation.catch(()=>{});
    }
  }
  return {status,run};
}
