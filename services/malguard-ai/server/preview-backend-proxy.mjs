// Preview-only same-origin proxy to the malware-ai Preview backend.
// The bypass secret stays on the server and is never written to logs or responses.
export const PREVIEW_BACKEND_ORIGIN='https://malware-ai-git-web-pro-p0-mcazarderakhsh-4187.vercel.app';
export const PREVIEW_BYPASS_ENV='MALWARE_AI_PREVIEW_BYPASS';

export const ALLOWED_ROUTES=Object.freeze({
  'public-models':Object.freeze({method:'GET',path:'/api/public-models'}),
  'public-model-chat':Object.freeze({method:'POST',path:'/api/public-model-chat'}),
  'account-usage':Object.freeze({method:'GET',path:'/api/account-usage'}),
  'public-media':Object.freeze({method:'POST',path:'/api/public-media'})
});

const SAFE_RESPONSE_HEADERS=['content-type','cache-control','retry-after','x-ratelimit-remaining-requests','x-ratelimit-remaining-tokens'];
const MAX_BODY=150000;

export function isPreviewEnv(env=process.env){
  return env?.VERCEL_ENV==='preview';
}

export function resolveRoute(req={}){
  const url=new URL(req.url||'/','http://preview.local');
  let key=String(url.searchParams.get('path')||'').trim();
  if(!key){
    const match=url.pathname.match(/^\/api\/(public-models|public-model-chat|account-usage|public-media)\/?$/);
    if(match)key=match[1];
  }
  const route=ALLOWED_ROUTES[key];
  if(!route)return null;
  const method=String(req.method||'GET').toUpperCase();
  if(method==='OPTIONS')return {key,route,method:'OPTIONS'};
  if(method!==route.method)return null;
  return {key,route,method};
}

function readBody(req){
  if(req.method!=='POST')return undefined;
  if(req.body==null)return undefined;
  if(Buffer.isBuffer(req.body))return req.body.length>MAX_BODY?undefined:req.body;
  if(typeof req.body==='string')return Buffer.byteLength(req.body)>MAX_BODY?undefined:req.body;
  try{
    const json=JSON.stringify(req.body);
    if(Buffer.byteLength(json)>MAX_BODY)return undefined;
    return json;
  }catch{
    return undefined;
  }
}

function requestHeaders(req,bypass){
  const headers={
    'X-Vercel-Protection-Bypass':bypass,
    Accept:String(req.headers?.accept||'application/json')
  };
  const authorization=req.headers?.authorization;
  if(typeof authorization==='string'&&authorization)headers.Authorization=authorization;
  if(req.method==='POST')headers['Content-Type']=String(req.headers?.['content-type']||'application/json');
  return headers;
}

function sendJson(res,status,payload){
  if(typeof res.status==='function')res.status(status);
  else res.statusCode=status;
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(typeof res.json==='function')return res.json(payload);
  res.end(JSON.stringify(payload));
}

function copySafeHeaders(from,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  for(const name of SAFE_RESPONSE_HEADERS){
    const value=from.headers?.get?.(name);
    if(value)res.setHeader(name,value);
  }
}

async function pipeBody(upstream,res){
  if(!upstream.body){
    const buffer=Buffer.from(await upstream.arrayBuffer());
    if(typeof res.end==='function')res.end(buffer);
    return;
  }
  const reader=upstream.body.getReader();
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      res.write(Buffer.from(value));
    }
  }finally{
    res.end();
  }
}

export async function handlePreviewBackendProxy(req,res,{env=process.env,fetchImpl=fetch}={}){
  if(!isPreviewEnv(env))return sendJson(res,404,{error:'not_found'});
  const resolved=resolveRoute(req);
  if(!resolved)return sendJson(res,404,{error:'not_found'});
  if(resolved.method==='OPTIONS'){
    if(typeof res.status==='function')res.status(204);
    else res.statusCode=204;
    res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
    res.setHeader('Cache-Control','no-store');
    return res.end();
  }
  const bypass=env[PREVIEW_BYPASS_ENV];
  if(typeof bypass!=='string'||bypass.length<16)return sendJson(res,503,{error:'preview_proxy_unconfigured'});
  const body=resolved.method==='POST'?readBody(req):undefined;
  if(resolved.method==='POST'&&body===undefined&&req.body!=null)return sendJson(res,413,{error:'request_too_large'});
  let upstream;
  try{
    upstream=await fetchImpl(`${PREVIEW_BACKEND_ORIGIN}${resolved.route.path}`,{
      method:resolved.method,
      headers:requestHeaders(req,bypass),
      body,
      redirect:'manual'
    });
  }catch{
    return sendJson(res,502,{error:'preview_proxy_unavailable'});
  }
  if(typeof res.status==='function')res.status(upstream.status);
  else res.statusCode=upstream.status;
  copySafeHeaders(upstream,res);
  return pipeBody(upstream,res);
}
