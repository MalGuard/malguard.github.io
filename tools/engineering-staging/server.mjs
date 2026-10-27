import express from 'express';
import {createSupportResponder} from './support.mjs';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomBytes,timingSafeEqual,randomUUID} from 'node:crypto';
import {createLocalLab} from './lab.mjs';
import {createRepairAnalyzer,safeDebugReport} from './repair.mjs';
import {createTelemetry} from '../../services/malguard-ai/server/telemetry.js';

export async function startLocalStaging({port=8788,lab,analyzer,support,connectModel=false}={}){
 if(!Number.isInteger(port)||port<0||port>65535)throw Error('invalid_local_port');
 support??=createSupportResponder({enabled:connectModel});
 lab??=await createLocalLab();analyzer??=createRepairAnalyzer({enabled:connectModel});
 const app=express(),session=randomBytes(32).toString('hex'),reportSession=randomBytes(32).toString('hex'),telemetry=createTelemetry({capacity:100,sink:()=>{},env:{NODE_ENV:'test'}});let origin,rateStart=Date.now(),rate=0;
 app.disable('x-powered-by');
 app.use((req,res,next)=>{
  res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
  if(!origin||req.headers.host!==new URL(origin).host||req.headers.origin&&req.headers.origin!==origin)return res.status(403).json({error:'local_origin_required'});
  if(req.path.startsWith('/api/')){
   const expected=req.path==='/api/support'?reportSession:session,token=req.headers['x-staging-session'];if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)||!timingSafeEqual(Buffer.from(token),Buffer.from(expected)))return res.status(401).json({error:'staging_session_required'});
   if(req.method==='POST'&&(req.headers.origin!==origin||!req.is('application/json')))return res.status(403).json({error:'local_json_required'});
   if(Date.now()-rateStart>=60000){rateStart=Date.now();rate=0;}if(++rate>60)return res.set('Retry-After','60').status(429).json({error:'rate_limited'});
   const id=randomUUID(),started=Date.now();res.set('X-Request-ID',id);res.once('finish',()=>telemetry.record({requestId:id,endpoint:req.path==='/api/status'?'/status':req.path==='/api/sample'?'/chat':'unmatched',statusCode:res.statusCode,errorCode:res.locals.errorCode,durationMs:Date.now()-started}));
  }
  next();
 });
 app.use(express.json({limit:'16kb',strict:true}));
 app.get('/',async(req,res,next)=>{try{const html=await readFile(new URL('./ui/index.html',import.meta.url),'utf8');res.type('html').send(html.replace('__STAGING_SESSION__',session));}catch(error){next(error);}});
 app.get('/report',async(req,res,next)=>{try{const html=await readFile(new URL('./ui/report.html',import.meta.url),'utf8');res.type('html').send(html.replace('__REPORT_SESSION__',reportSession));}catch(error){next(error);}});
 app.post('/api/support',async(req,res,next)=>{try{res.json(await support.submit(req.body));}catch(error){next(error);}});
 app.use(express.static(fileURLToPath(new URL('./ui/',import.meta.url)),{index:false,dotfiles:'deny'}));
 app.get('/api/status',(_req,res)=>res.json({mode:'synthetic_local_staging',database:'embedded_postgresql',storage:'simulated_supabase_storage',telemetry:telemetry.health(),repair:analyzer.status()}));
 app.get('/api/events',(req,res)=>res.json({events:telemetry.snapshot(typeof req.query.requestId==='string'?req.query.requestId:undefined)}));
 app.get('/api/report',(req,res)=>res.json(safeDebugReport(telemetry.snapshot(typeof req.query.requestId==='string'?req.query.requestId:undefined))));
 app.post('/api/sample',(_req,res)=>{res.locals.errorCode='provider_timeout';res.status(503).json({error:'provider_timeout',synthetic:true});});
 app.post('/api/lab',async(_req,res,next)=>{try{res.json(await lab.runChecks());}catch(error){next(error);}});
 app.post('/api/analyze',async(req,res,next)=>{try{if(Object.keys(req.body||{}).some(key=>key!=='requestId'))return res.status(400).json({error:'invalid_request'});res.json(await analyzer.analyze(telemetry.snapshot(req.body?.requestId)));}catch(error){next(error);}});
 app.use((error,req,res,next)=>{const status=error.type==='entity.too.large'?413:error.type==='entity.parse.failed'?400:[400,409,429,503].includes(error.status)?error.status:500;res.locals.errorCode='request_failed';res.status(status).json({error:status===413?'request_too_large':status===400?'invalid_request':'staging_operation_failed'});});
 app.use((_req,res)=>res.status(404).json({error:'not_found'}));
 const server=app.listen(port,'127.0.0.1');try{await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});}catch(error){await lab.close();throw error;}
 origin=`http://127.0.0.1:${server.address().port}`;
 return {url:origin,close:async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await lab.close();}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2),portArg=args.find(x=>x.startsWith('--port='));
 startLocalStaging({port:portArg?Number(portArg.slice(7)):8788,connectModel:args.includes('--connect-model')}).then(service=>{console.info(JSON.stringify({url:service.url,mode:'synthetic_local_staging',productionAccess:false}));let closing=false;const close=()=>{if(closing)return;closing=true;service.close().then(()=>process.exit(0));};process.on('SIGINT',close);process.on('SIGTERM',close);}).catch(()=>{console.error('Local staging could not start. Check the port and dev-only PostgreSQL dependency.');process.exitCode=1;});
}
