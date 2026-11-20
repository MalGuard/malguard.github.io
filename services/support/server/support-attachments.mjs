import {createHash} from 'node:crypto';
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
export function validateCompletedFile(bytes,spec){
 if(!Buffer.isBuffer(bytes)||bytes.length!==spec.bytes||
    hash(bytes)!==spec.sha256)throw fail(422,'attachment_checksum_failed');
 if(spec.kind==='image'){
   if(bytes.length<33||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||
      bytes.toString('ascii',12,16)!=='IHDR')
      throw fail(415,'invalid_png');
   const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
   if(width===0||height===0||width*height>16000000)
      throw fail(415,'invalid_image_dimensions');
 } else {
   const text=bytes.toString('utf8');
   if(!Buffer.from(text,'utf8').equals(bytes)||text.includes('\0')||
      /[\x01-\x08\x0b\x0c\x0e-\x1f]/.test(text))
      throw fail(415,'invalid_log');
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
  if(!response.ok)throw fail(503,'attachment_storage_unavailable');
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
