export const localModels={
 local_fast:{id:'local_fast',label:'Fast · Qwen3 0.6B · on device',model:'Qwen3-0.6B-q4f16_1-MLC',revision:'8c14ce481d4c692769976ad52afea453a102df19',downloadMB:352,gpuMB:1404},
 local_medium:{id:'local_medium',label:'Medium · Qwen3 1.7B · on device',model:'Qwen3-1.7B-q4f16_1-MLC',revision:'80b3abcec6c3b3f5355dc0cc99cc4fb578f192bc',downloadMB:985,gpuMB:2037}
};
const binaryRevision='00fe7a40e57e5e8eb9fef87526a4bf28ad5846c0';
export const localAppConfig={useIndexedDBCache:true,model_list:Object.values(localModels).map(m=>({
 model:`https://huggingface.co/mlc-ai/${m.model}/resolve/${m.revision}/`,model_id:m.model,
 model_lib:`https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/${binaryRevision}/web-llm-models/v0_2_86/base/${m.model.replace('-MLC','')}_cs1k-webgpu.wasm`,
 vram_required_MB:m.gpuMB,low_resource_required:true,required_features:['shader-f16'],overrides:{context_window_size:1024}
}))};
export async function localCapability(gpu=globalThis.navigator?.gpu){
 if(!globalThis.isSecureContext||!gpu)return false;
 try{const adapter=await gpu.requestAdapter();return !!adapter?.features.has('shader-f16');}catch{return false;}
}
export function localMessages(message,locale,history=[]){
 const instruction=locale==='fa'?'پاسخ را کوتاه، طبیعی و فقط به فارسی روان بنویس؛ عنوان و فهرست را فقط وقتی لازم است اضافه کن. برای سلام دوستانه جواب بده. هیچ نتیجهٔ بررسی امنیتی یا جست‌وجوی وب جعل نکن.':'Reply concisely in natural English paragraphs; add headings or lists only when useful. Never invent security checks or web searches.';
 // A short context keeps GPU memory bounded. Conversation remains page memory.
 return [{role:'system',content:instruction},...history.slice(-2).map(m=>({role:m.role,content:m.content.slice(0,100)})),{role:'user',content:message}];
}
export function createLocalChat({workerFactory=()=>new Worker('/assets/ai/local-worker.js',{type:'module'}),timeout=300000}={}){
 let worker,pending;
 function stop(){worker?.terminate();worker=undefined;if(pending){clearTimeout(pending.timer);pending.reject(new Error('local_cancelled'));pending=undefined;}}
 function request(payload,onProgress=()=>{},onPhase=()=>{}){
  if(pending)return Promise.reject(new Error('local_busy'));
  if(!worker){worker=workerFactory();worker.onmessage=({data})=>{
   if(!pending)return;
   if(data.phase==='model_started'){pending.onPhase();return;}
   if(data.progress!==undefined){pending.onProgress(Math.max(0,Math.min(100,Number(data.progress)||0)));return;}
   const task=pending;pending=undefined;clearTimeout(task.timer);
   if(data.error)task.reject(new Error('local_failed'));else task.resolve(data.generated||true);
  };worker.onerror=()=>{stop();};}
  return new Promise((resolve,reject)=>{pending={resolve,reject,onProgress,onPhase,timer:setTimeout(()=>stop(),timeout)};worker.postMessage(payload);});
 }
 return {stop,prepare:(model,onProgress)=>{
  if(!Object.hasOwn(localModels,model))return Promise.reject(new Error('invalid_local_model'));
  return request({operation:'prepare',model},onProgress);
 },respond:({model,message,locale,history},onProgress,onPhase)=>{
  if(!Object.hasOwn(localModels,model))return Promise.reject(new Error('invalid_local_model'));
  if(typeof message!=='string'||message.length>1200)return Promise.reject(new Error('local_input_too_long'));
  return request({operation:'chat',model,messages:localMessages(message,locale,history)},onProgress,onPhase);
 },async clear(){stop();try{return await request({operation:'clear'});}finally{stop();}}};
}
