// Conservative UI guard for Ollama downloads. Browser APIs cannot report reliable
// free disk space, total RAM or GPU VRAM, so users provide these values locally.
// These recommendations are screening rules, not a hardware benchmark or guarantee.
const MEMORY_TARGET_GB=Object.freeze({
 native_qwen8:10,
 native_qwen32:28,
 native_gpt20:16,
 native_gpt120:80,
 native_qwen235:160,
 native_deepseek671:440
});
export function detectDevice({userAgent='',platform='',maxTouchPoints=0,mobileHint}={}){
 const ua=String(userAgent),os=String(platform);
 const mobile=mobileHint===true||/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua)||
   (/Macintosh/i.test(ua)&&Number(maxTouchPoints)>1);
 if(mobile)return {kind:'mobile'};
 if(/Windows|Macintosh|Mac OS X|Linux|CrOS/i.test(ua)||/Win|Mac|Linux|Chrome OS/i.test(os))return {kind:'desktop'};
 return {kind:'unknown'};
}
const positive=value=>value===''||value===null||value===undefined?null:
 (Number.isFinite(Number(value))&&Number(value)>0&&Number(value)<=100000?Number(value):null);
export function assessDesktopModel(model,device,{ramGB,freeDiskGB,gpuGB}={}){
 if(!model||!Number.isFinite(model.downloadGB)||model.downloadGB<=0)return {status:'blocked',reason:'invalid_model'};
 const diskRequiredGB=Math.ceil(model.downloadGB*1.1+2);
 const memoryTargetGB=MEMORY_TARGET_GB[model.id]||Math.ceil(model.downloadGB+4);
 const base={diskRequiredGB,memoryTargetGB};
 if(device?.kind==='mobile')return {...base,status:'blocked',reason:'mobile'};
 if(device?.kind!=='desktop')return {...base,status:'unknown',reason:'device_unknown'};
 const disk=positive(freeDiskGB),ram=positive(ramGB),gpu=positive(gpuGB);
 if(disk===null||ram===null)return {...base,status:'unknown',reason:'specs_required'};
 if(disk<diskRequiredGB)return {...base,status:'blocked',reason:'disk'};
 // GPU VRAM can substitute for host RAM for fully GPU-resident inference.
 // Mixed CPU/GPU configurations may also work; do not claim absolute incompatibility.
 if(Math.max(ram,gpu||0)<memoryTargetGB)return {...base,status:'blocked',reason:'memory_recommendation'};
 return {...base,status:'eligible',reason:'estimated_only'};
}
