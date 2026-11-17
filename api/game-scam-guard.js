// Same-origin private preview API. Vercel Deployment Protection remains the
// access boundary; no shared-link token or provider key belongs in the client.
const endpoints=new Set(['health','self-test','account-config','auth/status','auth/availability','auth/start','auth/verify','auth/password','auth/session','scan','scan/live','jobs/start','jobs/step']);
const authEndpoints=new Set(['auth/status','auth/availability','auth/start','auth/verify','auth/password','auth/session']);
const productionAuthBase='https://game-scam-guard-connected.vercel.app/api/game-scam-guard';

async function proxyProductionAuth(req,res,endpoint){
  const method=endpoint==='auth/status'?'GET':'POST';
  if(req.method!==method){
    res.setHeader('Allow',method);
    return res.status(405).json({error:'روش درخواست پشتیبانی نمی‌شود.'});
  }
  let body;
  if(method==='POST'){
    if(!req.is('application/json'))return res.status(415).json({error:'درخواست باید JSON باشد.'});
    body=Buffer.isBuffer(req.body)?req.body.toString('utf8'):JSON.stringify(req.body??{});
    if(Buffer.byteLength(body)>4096)return res.status(413).json({error:'حجم درخواست بیش‌ازحد مجاز است.'});
  }
  try{
    const upstream=await fetch(`${productionAuthBase}/${endpoint}`,{
      method,
      headers:method==='POST'?{'Accept':'application/json','Content-Type':'application/json'}:{'Accept':'application/json'},
      body,
      signal:AbortSignal.timeout(15000),
      redirect:'error'
    });
    const raw=await upstream.text();
    if(raw.length>65536)throw new Error('upstream_response_too_large');
    let data;
    try{data=JSON.parse(raw);}catch{throw new Error('invalid_upstream_response');}
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    return res.status(upstream.status).json(data);
  }catch{
    res.setHeader('Cache-Control','no-store');
    return res.status(502).json({error:'سرویس حساب موقتاً در دسترس نیست؛ دوباره تلاش کنید.'});
  }
}

module.exports=async function handler(req,res){
  const endpoint=req.query?.endpoint;
  if(typeof endpoint!=='string'||!endpoints.has(endpoint)){
    res.setHeader('Cache-Control','no-store');
    return res.status(404).json({error:'مسیر درخواست پیدا نشد.'});
  }
  if(authEndpoints.has(endpoint))return proxyProductionAuth(req,res,endpoint);
  req.url=`/api/${endpoint}`;
  req.originalUrl=req.url;
  const {default:app}=await import('../services/game-scam-guard/server/app.js');
  return app(req,res);
};
