import {createHash} from 'node:crypto';
import {redactLog,validateLogText} from '../../../assets/support-privacy.mjs';
const MAX_IMAGE=5*1024*1024, MAX_LOG=2*1024*1024;
export const CHUNK_BYTES=512*1024;
const fail=(status,code)=>Object.assign(new Error(code),{status,code});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function validateAttachmentSpec({kind,bytes,partCount,contentType,sha256,name}) {
 if(!['image','log'].includes(kind)||!Number.isSafeInteger(bytes)||bytes<1||
    bytes>(kind==='image'?MAX_IMAGE:MAX_LOG)||!Number.isSafeInteger(partCount)||
    partCount!==Math.ceil(bytes/CHUNK_BYTES)||!/^[a-f0-9]{64}$/.test(sha256||''))
   throw fail(400,'invalid_attachment');
 if((kind==='image'&&contentType!=='image/png')||
    (kind==='log'&&contentType!=='text/plain'))throw fail(400,'unsupported_type');
 if(typeof name!=='string'||name.length<1||name.length>120||/[\/\\\x00-\x1f]/.test(name))
   throw fail(400,'invalid_filename');
 return {kind,bytes,partCount,contentType,sha256,name};
}
const PNG_SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);
const PNG_ALLOWED=new Set(['IHDR','IDAT','IEND','sRGB','gAMA','cHRM','pHYs']);
function crc32(bytes,start,end){
 let crc=0xffffffff;
 for(let i=start;i<end;i++){
  crc^=bytes[i];
  for(let j=0;j<8;j++)crc=(crc>>>1)^(crc&1?0xedb88320:0);
 }
 return (crc^0xffffffff)>>>0;
}
function validatePng(bytes){
 if(bytes.length<45||!bytes.subarray(0,8).equals(PNG_SIGNATURE))
   throw fail(415,'invalid_png');
 let pos=8,seenIHDR=false,seenIDAT=false,seenIEND=false;
 while(pos+12<=bytes.length){
  const len=bytes.readUInt32BE(pos),type=bytes.toString('ascii',pos+4,pos+8);
  if(len>bytes.length-pos-12||!PNG_ALLOWED.has(type))
    throw fail(415,'invalid_png_chunks');
  const data=pos+8,crc=bytes.readUInt32BE(data+len);
  if(crc32(bytes,pos+4,data+len)!==crc)throw fail(415,'invalid_png_crc');
  if(!seenIHDR){
   if(type!=='IHDR'||len!==13)throw fail(415,'invalid_png_header');
   const width=bytes.readUInt32BE(data),height=bytes.readUInt32BE(data+4);
   if(width===0||height===0||width*height>16000000||
      ![8,16].includes(bytes[data+8])||![0,2,4,6].includes(bytes[data+9])||
      bytes[data+10]!==0||bytes[data+11]!==0||bytes[data+12]!==0)
     throw fail(415,'invalid_png_header');
   seenIHDR=true;
  }else if(type==='IHDR')throw fail(415,'invalid_png_chunks');
  if(type==='IDAT')seenIDAT=true;
  if(type==='IEND'){
   if(len!==0||!seenIDAT||data+len+4!==bytes.length)
     throw fail(415,'invalid_png_end');
   seenIEND=true;break;
  }
  pos=data+len+4;
 }
 if(!seenIHDR||!seenIDAT||!seenIEND)throw fail(415,'invalid_png');
}
export function validateCompletedFile(bytes,spec){
 if(!Buffer.isBuffer(bytes)||bytes.length!==spec.bytes||
    hash(bytes)!==spec.sha256)throw fail(422,'attachment_checksum_failed');
 if(spec.kind==='image')validatePng(bytes);
 else {
   const text=bytes.toString('utf8');
   if(!Buffer.from(text,'utf8').equals(bytes)||!validateLogText(text))
     throw fail(415,'invalid_log');
   if(redactLog(text).redacted!==text)
     throw fail(422,'privacy_redaction_required');
 }
 return hash(bytes);
}
const validUrl=value=>{
 try{const u=new URL(String(value||''));return u.protocol==='https:'&&
  /^[a-z0-9-]+\.supabase\.co$/.test(u.hostname)&&u.pathname==='/'&&!u.username&&!u.password?u.origin:null;}
 catch{return null;}
};
export function createAttachmentStorage({url=process.env.SUPABASE_URL,
  key=process.env.SUPABASE_SERVICE_ROLE_KEY,
  bucket=process.env.SUPPORT_ATTACHMENT_BUCKET,
  fetchImpl=fetch}={}){
 const origin=validUrl(url),validBucket=typeof bucket==='string'&&/^[a-z0-9][a-z0-9-_]{2,62}$/.test(bucket);
 const enabled=!!origin&&validBucket&&typeof key==='string'&&key.length>20;
 const request=async(path,{method='GET',body,contentType='application/json'}={})=>{
  if(!enabled)throw fail(503,'attachment_storage_unavailable');
  let response;
  try{response=await fetchImpl(origin+'/storage/v1/'+path,{method,redirect:'error',cache:'no-store',
    headers:{apikey:key,authorization:'Bearer '+key,'content-type':contentType},body,
    signal:AbortSignal.timeout(16000)});}
  catch{throw fail(503,'attachment_storage_unavailable');}
  if(!response.ok && !(method==='DELETE'&&response.status===404))
   throw fail(503,'attachment_storage_unavailable');
  return response;
 };
 const encoded=path=>path.split('/').map(encodeURIComponent).join('/');
 async function privateBucket(){
  const resp=await request('bucket/'+encodeURIComponent(bucket));
  const json=await resp.json().catch(()=>null);
  if(!json||json.public!==false||json.id!==bucket)throw fail(503,'private_bucket_required');
 }
 async function put(path,bytes,type='application/octet-stream'){
  await privateBucket();
  await request('object/'+encodeURIComponent(bucket)+'/'+encoded(path),
    {method:'POST',body:bytes,contentType:type});
 }
 async function read(path,max){
  await privateBucket();
  const resp=await request('object/'+encodeURIComponent(bucket)+'/'+encoded(path));
  if(Number(resp.headers?.get('content-length'))>max)throw fail(413,'attachment_too_large');
  const bytes=Buffer.from(await resp.arrayBuffer());
  if(bytes.length>max)throw fail(413,'attachment_too_large');
  return bytes;
 }
 async function remove(path){
  await privateBucket();
  await request('object/'+encodeURIComponent(bucket)+'/'+encoded(path),{method:'DELETE'});
 }
 return {enabled,privateBucket,put,read,remove};
}
