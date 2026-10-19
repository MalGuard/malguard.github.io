// Same-origin private preview API. Vercel Deployment Protection remains the
// access boundary; no shared-link token or provider key belongs in the client.
const endpoints=new Set(['health','account-config','auth/status','auth/google/start','auth/google/callback','auth/google/complete-signup','auth/start','auth/verify','auth/password','auth/session','scan','scan/live','jobs/start','jobs/step']);
module.exports=async function handler(req,res){
  const endpoint=req.query?.endpoint;
  if(typeof endpoint!=='string'||!endpoints.has(endpoint)){
    res.setHeader('Cache-Control','no-store');
    return res.status(404).json({error:'مسیر درخواست پیدا نشد.'});
  }
  req.url=`/api/${endpoint}`;
  req.originalUrl=req.url;
  const {default:app}=await import('../services/game-scam-guard/server/app.js');
  return app(req,res);
};
