// Opt-in media client. Provider keys and media quota enforcement stay on Vercel.
import {modelsApiRoot} from './api-root.mjs';
const ROOT=modelsApiRoot();
export const MEDIA_LIMIT_BYTES=1024*1024;
export function mediaFromCatalog(models){
 const m=models?.mediaCapabilities;
 return Object.freeze({analyze:m?.analyze===true,generate:m?.generate===true});
}
export async function toMediaPayload(file){
 if(!(file instanceof Blob)||file.size<1||file.size>MEDIA_LIMIT_BYTES||
   !['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('invalid_image');
 const result=await new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onerror=()=>reject(new Error('invalid_image'));
  reader.onload=()=>resolve(reader.result);
  reader.readAsDataURL(file);
 });
 if(typeof result!=='string'||!result.includes(',')||!/^data:image\/(png|jpeg|webp);base64,/.test(result))
  throw new Error('invalid_image');
 return {mime:file.type,base64:result.split(',',2)[1]};
}
export async function callMedia({action,prompt,image,sessionToken,signal,fetchImpl=fetch}){
 if(!['analyze','generate'].includes(action)||typeof prompt!=='string'||!prompt.trim()||
   prompt.length>(action==='generate'?1200:2000))throw new Error('invalid_request');
 if(action==='analyze'&&(!image||typeof image.base64!=='string'||!['image/png','image/jpeg','image/webp'].includes(image.mime)))throw new Error('invalid_image');
 if(action==='generate'&&image!==undefined)throw new Error('invalid_request');
 if(typeof sessionToken!=='string'||sessionToken.length<12)throw new Error('sign_in_required');
 const body={action,prompt:prompt.trim(),...(image?{image}:{}),consent:{modelShare:true,mediaShare:true}};
 let response;
 try{
  response=await fetchImpl(ROOT+'/api/public-media',{
   method:'POST',mode:'cors',cache:'no-store',credentials:'omit',signal,
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+sessionToken},
   body:JSON.stringify(body)
  });
 }catch(error){if(error?.name==='AbortError')throw error;throw new Error('network_error');}
 let data;try{data=await response.json();}catch{throw new Error('media_provider_unavailable');}
 if(!response.ok)throw new Error(typeof data?.error==='string'?data.error:'media_provider_unavailable');
 if(data?.action!==action||typeof data.provider!=='string'||typeof data.model!=='string')throw new Error('media_provider_unavailable');
 if(action==='analyze'){
  if(typeof data.text!=='string'||!data.text.trim())throw new Error('media_provider_unavailable');
  return {action,provider:data.provider,model:data.model,text:data.text.slice(0,8000),disclaimer:String(data.disclaimer||'').slice(0,300)};
 }
 if(data.mime!=='image/jpeg'||typeof data.image!=='string'||!/^\/9[A-Za-z0-9+/=]+$/.test(data.image)||data.image.length>2900000)
  throw new Error('media_provider_unavailable');
 return {action,provider:data.provider,model:data.model,mime:data.mime,image:data.image};
}
