import express from 'express';
import {retryDetails} from '../../../ai/service-errors.mjs';
import {randomUUID} from 'node:crypto';
import {createOrchestrator} from './orchestrator.js';
import {InputError,MAX_BODY_BYTES} from './contracts.js';
import {createTelemetry} from './telemetry.js';

export function createApp({orchestrator=createOrchestrator(),enabled=process.env.MALGUARD_AI_ENABLED!=='false',publicOrigin=process.env.MALGUARD_AI_PUBLIC_ORIGIN,now=Date.now,log=entry=>console.info(JSON.stringify(entry))}={}) {
  const app=express(),rates=new Map();let active=0;
  const telemetry=createTelemetry({now,sink:log});app.locals.telemetry=telemetry;
  app.disable('x-powered-by');
  app.use((req,res,next)=>{
    const requestId=randomUUID(),startedAt=now();let recorded=false;
    res.locals.requestId=requestId;res.set({'X-Request-ID':requestId,'Access-Control-Expose-Headers':'X-Request-ID'});
    const completed=statusCode=>{if(recorded)return;recorded=true;const errors={400:'invalid_request',403:'origin_denied',404:'not_found',413:'request_too_large',415:'json_required',429:'rate_limited',503:'service_busy'};telemetry.record({requestId,endpoint:req.path,statusCode,errorCode:res.locals.errorCode||(statusCode>=400?(errors[statusCode]||'request_failed'):undefined),model:req.body?.model,provider:res.locals.provider,durationMs:now()-startedAt});};
    res.once('finish',()=>completed(res.statusCode));res.once('close',()=>{if(!res.writableFinished)completed(499);});next();
  });
  const allowed=new Set(['https://malguard.site','https://malguard.github.io','https://game-scam-guard-connected.vercel.app','https://api.malguard.site']);
  if(publicOrigin)allowed.add(new URL(publicOrigin).origin);
  if(process.env.NODE_ENV!=='production'){allowed.add('http://127.0.0.1:8787');allowed.add('http://localhost:8787');}
  app.use((req,res,next)=>{
    res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.vary('Origin');
    const origin=req.headers.origin;
    if(origin&&!allowed.has(origin))return res.status(403).json({error:'origin_denied'});
    if(origin)res.set('Access-Control-Allow-Origin',origin);
    if(req.method==='OPTIONS'){
      const headers=String(req.headers['access-control-request-headers']||'').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);
      if(!origin||!['GET','POST'].includes(req.headers['access-control-request-method'])||headers.some(h=>h!=='content-type'))return res.status(403).end();
      return res.set({'Access-Control-Allow-Methods':'GET, POST','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'}).status(204).end();
    }
    // Never trust caller-supplied X-Forwarded-For. Behind a proxy the socket
    // bucket is intentionally conservative; edge-wide quotas are a launch gate.
    const time=now();for(const [key,entry]of rates)if(entry.until<=time)rates.delete(key);
    const key=req.socket.remoteAddress||'shared';let entry=rates.get(key);
    if(!entry){if(rates.size>=2000)return res.status(429).json({error:'rate_limited'});entry={count:0,posts:0,until:time+60000};rates.set(key,entry);}
    if(++entry.count>60||(req.method==='POST'&&++entry.posts>10)){const timing=retryDetails(String(Math.ceil((entry.until-time)/1000)),time);res.set('Retry-After',String(timing.retryAfterSeconds));return res.status(429).json({error:'rate_limited',...timing});}
    if(req.method==='POST'&&!req.is('application/json'))return res.status(415).json({error:'json_required'});
    const length=Number(req.headers['content-length']);
    if(length>MAX_BODY_BYTES)return res.status(413).json({error:'request_too_large'});
    // Vercel may provide a parsed body; do not rely only on express.json.
    if(req.body!==undefined){try{if(Buffer.byteLength(JSON.stringify(req.body))>MAX_BODY_BYTES)return res.status(413).json({error:'request_too_large'});}catch{return res.status(400).json({error:'invalid_request'});}}
    next();
  });
  app.use(express.json({limit:MAX_BODY_BYTES,strict:true}));
  app.get('/status',async(req,res)=>{
    await orchestrator.refresh?.();
    const status=orchestrator.status();
    if(!enabled)for(const tool of Object.values(status.tools))Object.assign(tool,{state:'disabled',reason:'service_disabled'});
    res.json({enabled,...status});
  });
  app.post('/chat',async(req,res,next)=>{
    if(!enabled){res.locals.errorCode='service_disabled';return res.status(503).json({error:'service_disabled'});}
    if(active>=2)return res.status(503).json({error:'service_busy'});
    active++;let started=false;
    // Validation and consent complete before the first stream event.
    const stream=req.headers.accept==='application/x-ndjson';
    const emit=event=>{if(!stream||res.destroyed)return;if(!started){res.type('application/x-ndjson');res.flushHeaders();started=true;}res.write(JSON.stringify({event})+'\n');};
    try {
      const result=await orchestrator.run(req.body,emit);
      res.locals.provider=result.generated?.provider;
      if(result.error)res.locals.errorCode=result.error;else if(result.result?.outcome==='error')res.locals.errorCode='request_failed';
      if(!res.destroyed){if(stream){if(!started)res.type('application/x-ndjson');res.end(JSON.stringify({result})+'\n');}else res.json(result);}
    } catch(error){next(error);} finally{active--;}
  });
  app.use((error,req,res,next)=>{
    const code=error instanceof InputError?error.code:error.type==='entity.too.large'?'request_too_large':error.type==='entity.parse.failed'?'invalid_json':'request_failed';
    const status=error instanceof InputError?error.status:error.type==='entity.too.large'?413:error.type==='entity.parse.failed'?400:500;
    res.locals.errorCode=code;
    if(res.headersSent){if(!res.destroyed)res.end(JSON.stringify({error:code})+'\n');return;}
    res.status(status).json({error:code});
  });
  app.use((req,res)=>res.status(404).json({error:'not_found'}));
  return app;
}
export default createApp();
