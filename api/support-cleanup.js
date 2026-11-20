// Vercel Cron entry: only a configured, authenticated scheduler may erase data.
const {timingSafeEqual}=require('node:crypto');
const fail=(res,status,code)=>{res.statusCode=status;res.setHeader('cache-control','no-store');res.setHeader('content-type','application/json');res.end(JSON.stringify({error:code}));};
module.exports=async function handler(req,res){
  const secret=process.env.CRON_SECRET;
  if(req.method!=='GET')return fail(res,405,'method_not_allowed');
  if(process.env.SUPPORT_API_ENABLED!=='true'||process.env.SUPPORT_ATTACHMENTS_ENABLED!=='true'||
     typeof secret!=='string'||secret.length<32)return fail(res,503,'cleanup_unavailable');
  const actual=String(req.headers?.authorization||'');
  const expected='Bearer '+secret;
  const a=Buffer.from(actual),b=Buffer.from(expected);
  if(a.length!==b.length||!timingSafeEqual(a,b))return fail(res,401,'unauthorized');
  try{
    const {createUploadService}=await import('../services/support/server/support-upload.mjs');
    const upload=createUploadService();
    if(!upload.available)return fail(res,503,'cleanup_unavailable');
    const stats=await upload.cleanup();
    res.statusCode=stats.failed>0?503:200;
    res.setHeader('cache-control','no-store');
    res.setHeader('content-type','application/json');
    return res.end(JSON.stringify({ok:stats.failed===0,...stats}));
  }catch{return fail(res,503,'cleanup_failed');}
};