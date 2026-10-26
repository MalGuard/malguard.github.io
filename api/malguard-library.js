let library;
const origins=new Set(['https://malguard.site','https://malguard.github.io']);
const limits=new Map();
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Origin');
 const origin=req.headers.origin;if(!origins.has(origin))return res.status(403).json({error:'origin_denied'});
 res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'method_denied'});
 const token=/^Bearer (\S+)$/.exec(req.headers.authorization||'')?.[1];if(!token||token.length>16000)return res.status(401).json({error:'sign_in_required'});
 const {createHash}=await import('node:crypto');const id=createHash('sha256').update(token).digest('hex'),now=Date.now();for(const [k,v]of limits)if(v.until<now)limits.delete(k);
 const entry=limits.get(id)||{count:0,until:now+60000};if(++entry.count>30||limits.size>10000){res.setHeader('Retry-After','60');return res.status(429).json({error:'rate_limited'});}limits.set(id,entry);
 try{
  let value;if(req.method==='POST'){if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).json({error:'json_required'});if(Number(req.headers['content-length'])>262144)return res.status(413).json({error:'too_large'});value=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!value)return res.status(400).json({error:'invalid_library'});}
  library??=(await import('../services/game-scam-guard/server/ai-library.js')).createLibrary();return res.status(200).json(await library(token,value));
 }catch(error){const status=[400,401,413,429].includes(error.status)?error.status:503;return res.status(status).json({error:status===401?'sign_in_required':'library_unavailable'});}
};
