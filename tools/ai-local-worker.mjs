import {CreateMLCEngine,deleteModelAllInfoInCache} from '@mlc-ai/web-llm';
import {localModels,localAppConfig} from '../ai/local-models.mjs';
let engine,loaded,busy=false;
self.onmessage=async({data})=>{
 if(busy)return;
 busy=true;
 try{
  if(data.operation==='clear'){
   await engine?.unload();engine=undefined;loaded=undefined;
   for(const m of Object.values(localModels))await deleteModelAllInfoInCache(m.model,localAppConfig);
   self.postMessage({cleared:true});return;
  }
  const m=localModels[data.model];
  if(!m||!['chat','prepare'].includes(data.operation)||data.operation==='chat'&&(!Array.isArray(data.messages)||data.messages.length>4))throw new Error('invalid_request');
  if(loaded!==m.model){
   await engine?.unload();engine=undefined;loaded=undefined;
   engine=await CreateMLCEngine(m.model,{appConfig:localAppConfig,logLevel:'SILENT',initProgressCallback:p=>self.postMessage({progress:Math.round(p.progress*100)})});
   loaded=m.model;
  }
  if(data.operation==='prepare'){self.postMessage({prepared:true});return;}
  self.postMessage({phase:'model_started'});
  const result=await engine.chat.completions.create({messages:data.messages,max_tokens:256,temperature:0.5,extra_body:{enable_thinking:false}});
  const choice=result.choices?.[0];
  if(choice?.finish_reason!=='stop'||typeof choice.message?.content!=='string'||!choice.message.content.trim())throw new Error('incomplete_response');
  self.postMessage({generated:{text:choice.message.content,provider:'on_device',model:m.model,selectedModel:data.model,checkedAt:new Date().toISOString(),securityAnalysis:false}});
 }catch{try{await engine?.unload();}catch{}engine=undefined;loaded=undefined;self.postMessage({error:'local_failed'});}finally{busy=false;}
};
