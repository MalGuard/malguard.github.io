const crypto=require('node:crypto');
module.exports=async(req,res)=>{
res.setHeader('Cache-Control','no-store');
res.setHeader('Access-Control-Allow-Origin','https://malguard.github.io');
res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers','Content-Type');
if(req.method==='OPTIONS')return res.status(204).end();
if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
const secret=process.env.GSG_PREVIEW_PASSWORD;
if(!secret)return res.status(503).json({error:'PASSWORD_NOT_CONFIGURED'});
const body=req.body||{};
if(typeof body.password!=='string'||typeof body.url!=='string')return res.status(400).json({error:'INVALID_INPUT'});
const a=crypto.createHash('sha256').update(body.password).digest(),b=crypto.createHash('sha256').update(secret).digest();
if(!crypto.timingSafeEqual(a,b))return res.status(403).json({error:'INVALID_PASSWORD'});
if(body.url.length>2048)return res.status(400).json({error:'URL_TOO_LONG'});
let url;try{url=new URL(body.url)}catch{return res.status(400).json({error:'INVALID_URL'})}
if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return res.status(400).json({error:'UNSUPPORTED_URL'});
const host=url.hostname.toLowerCase();const flags=[];
if(/free[-_.]?(robux|vbucks)|free[-_.]?gta[-_.]?money|verify[-_.]?account/i.test(url.href))flags.push('Suspicious gaming promotion or account verification wording');
if(/(?:steam|epicgames|rockstar|roblox)/.test(host)&&!/(^|\.)(steampowered\.com|steamcommunity\.com|epicgames\.com|rockstargames\.com|roblox\.com)$/.test(host))flags.push('Possible gaming brand impersonation');
let listed=null;
try{const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),3500);try{const feed=await fetch('https://openphish.com/feed.txt',{signal:controller.signal});if(feed.ok){const length=Number(feed.headers.get('content-length')||0);if(length<5000000){const data=await feed.text();if(data.length<5000000)listed=data.split(/\r?\n/).includes(url.href)}}}finally{clearTimeout(timeout)}}catch{}
return res.status(200).json({verdict:listed===true?'listed_phishing':flags.length?'suspicious':'unknown',openphish:listed===null?'unavailable':listed?'listed':'not_listed',urlhaus:'not_configured',flags,notice:'No match is not proof of safety. Passive checks only; destination not fetched.',checkedAt:new Date().toISOString()});
};