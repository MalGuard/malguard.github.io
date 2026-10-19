import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as scanner from './scanner.js';
import { ScanError } from './network.js';
import {startScanJob,stepScanJob,scanJobReport} from './scan-jobs.js';
import {createEmailAuth} from './email-auth.js';
import {createGoogleAuth} from './google-auth.js';

export function createApp({ scanSite = scanner.scanSite, providerStatus = scanner.providerStatus,startJob=startScanJob,stepJob=stepScanJob,emailAuth=createEmailAuth(),googleAuth=createGoogleAuth(),appOrigin='https://malguard.site/game-scam-guard/' } = {}) {
const app = express();
app.disable('x-powered-by');
if (process.env.VERCEL) app.set('trust proxy', 1);
// Pages hosts the UI; only our explicit first-party origins may call this API.
// No credentials, wildcard origins, arbitrary requested headers or origin reflection.
app.use('/api', (req,res,next)=>{
  res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.vary('Origin');
  const protocol=process.env.VERCEL?'https':process.env.NODE_ENV==='production'?req.protocol:(req.headers['x-forwarded-proto']||req.protocol);
  const ownOrigin=process.env.PUBLIC_ORIGIN||`${protocol}://${req.headers.host}`;
  const allowed=new Set([ownOrigin,'https://malguard.site','https://malguard.github.io']);
  const origin=req.headers.origin;
  if(origin&&!allowed.has(origin))return res.status(403).json({error:'درخواست باید از داخل برنامه ارسال شود.'});
  if(origin){res.set('Access-Control-Allow-Origin',origin);}
  if(req.method==='OPTIONS'){
    const method=req.headers['access-control-request-method'];
    const headers=(req.headers['access-control-request-headers']||'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
    if(!origin||!['GET','POST'].includes(method)||headers.some(h=>h!=='content-type'))return res.status(403).end();
    return res.set({'Access-Control-Allow-Methods':'GET, POST','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'}).status(204).end();
  }
  next();
});
app.use('/api/jobs',express.json({limit:'1600kb'}));
app.use(express.json({ limit: '4kb' }));
app.use('/api', (req, res, next) => {
  res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  // JSON + same-origin POSTs prevent cross-origin scan requests using a visitor's browser.
  // Vercel may supply an already-parsed body; enforce the same limits in that case.
  const limit = req.path.startsWith('/jobs/')?1600*1024:4*1024;
  if (req.body && (Buffer.isBuffer(req.body)?req.body.length:Buffer.byteLength(JSON.stringify(req.body))) > limit) return res.status(413).json({error:'حجم درخواست بیش‌ازحد مجاز است. فقط لینک یا گزارش صادرشده را ارسال کنید.'});
  if (req.method === 'POST' && !req.is('application/json')) return res.status(403).json({ error: 'درخواست باید از داخل برنامه ارسال شود.' });
  next();
});
const rates = new Map(); let activeScans = 0;
const authRates = new Map();
app.use('/api/auth', (req,res,next) => {
  const now=Date.now(),key=req.ip||'unknown',entry=authRates.get(key);
  if(!entry||entry.until<now)authRates.set(key,{count:1,until:now+60*1000});
  else if(++entry.count>30)return res.status(429).json({error:'تعداد درخواست‌های حساب زیاد است؛ یک دقیقه دیگر تلاش کنید.'});
  for(const [ip,item] of authRates)if(item.until<now)authRates.delete(ip);
  next();
});
app.use(['/api/scan','/api/scan/live','/api/jobs'], (req, res, next) => {
  const now = Date.now(); const key = `${req.ip}|${req.originalUrl.startsWith('/api/jobs/')?'job':'normal'}`;
  const rate = rates.get(key);
  if (!rate || rate.until < now) rates.set(key, { count: 1, until: now + 60000 });
  else if (++rate.count > (req.originalUrl.startsWith('/api/jobs/')?40:12)) return res.status(429).json({ error: 'تعداد درخواست‌ها زیاد است. یک دقیقه دیگر تلاش کنید.' });
  for (const [ip, entry] of rates) if (entry.until < now) rates.delete(ip);
  next();
});
const handleScan = operation => async (req,res) => {
  if (activeScans >= 8) return res.status(503).json({ error: 'سرویس مشغول است؛ کمی بعد دوباره تلاش کنید.' });
  activeScans++;
  try {
    const result = await operation(req.body);
    if (!res.destroyed) res.json(result);
  } finally {
    // A closed client connection does not stop downloads, provider queries or rendering.
    // Keep its slot until that work has actually finished, including error paths.
    activeScans--;
  }
};
app.get('/api/health', (req,res)=>res.json({ status: 'ok', providers: {urlhaus:providerStatus().urlhaus}, mode: 'website-link-inspection', maxLinkedPages:128 }));
app.get('/api/account-config',(req,res)=>{
  // This is Clerk's intentionally public browser identifier, never a secret key.
  const key=process.env.GUARD_CLERK_PUBLISHABLE_KEY||'';
  const configured=/^pk_(test|live)_[A-Za-z0-9]+$/.test(key)&&key.length<1024;
  res.json({provider:'clerk',configured,publishableKey:configured?key:null});
});
app.get('/api/auth/status',(req,res)=>res.json({provider:'first-party-email',configured:emailAuth.enabled,...emailAuth.status,google:{...googleAuth.status,configured:emailAuth.enabled&&googleAuth.enabled}}));
app.get('/api/auth/google/start',(req,res,next)=>{try{if(!emailAuth.enabled)throw Object.assign(new Error('Google sign-in is not ready yet.'),{status:503});res.redirect(302,googleAuth.start());}catch(error){next(error);}});
app.get('/api/auth/google/callback',async(req,res)=>{try{const profile=await googleAuth.complete({state:req.query?.state,code:req.query?.code,error:req.query?.error});const result=await emailAuth.googleAccount(profile);const fragment=result.kind==='session'?`guard-session=${encodeURIComponent(result.sessionToken)}`:`guard-google-signup=${encodeURIComponent(result.signupToken)}`;res.redirect(302,`${appOrigin}#${fragment}`);}catch(error){res.redirect(302,`${appOrigin}#guard-auth-error=${encodeURIComponent(error.message||'Google sign-in could not be completed.')}`);}});
app.post('/api/auth/google/complete-signup',async(req,res,next)=>{try{res.json(await emailAuth.completeGoogleSignup({signupToken:req.body?.signupToken,profile:req.body?.profile}));}catch(error){next(error);}});
app.post('/api/auth/availability',async(req,res,next)=>{try{res.json(await emailAuth.availability({emailAddress:req.body?.email,username:req.body?.username}));}catch(error){next(error);}});
app.post('/api/auth/start',async(req,res,next)=>{try{res.json(await emailAuth.start({emailAddress:req.body?.email,name:req.body?.username,profile:req.body?.profile,ip:req.ip}));}catch(error){next(error);}});
app.post('/api/auth/verify',async(req,res,next)=>{try{res.json(await emailAuth.verify({verificationToken:req.body?.verificationToken,code:req.body?.code}));}catch(error){next(error);}});
app.post('/api/auth/password',async(req,res,next)=>{try{res.json(await emailAuth.passwordSignIn({emailAddress:req.body?.email,password:req.body?.password}));}catch(error){next(error);}});
app.post('/api/auth/session',(req,res,next)=>{try{res.json(emailAuth.session({sessionToken:req.body?.sessionToken}));}catch(error){next(error);}});
app.post('/api/scan', handleScan(body=>scanSite(body?.url,{allowThreatContent:body?.mode==='advanced',allowCloudPreview:body?.mode==='advanced'})));
app.post('/api/scan/live',async(req,res,next)=>{
  if(activeScans>=8)return res.status(503).json({error:'سرویس مشغول است؛ کمی بعد دوباره تلاش کنید.'});
  activeScans++;
  const emit=event=>{if(!res.destroyed){if(!res.headersSent)res.type('application/x-ndjson');res.write(JSON.stringify({event})+'\n');}};
  try{const body=req.body||{};const result=await scanSite(body.url,{allowThreatContent:body.mode==='advanced',allowCloudPreview:body.mode==='advanced',onEvent:emit});if(!res.destroyed){if(!res.headersSent)res.type('application/x-ndjson');res.end(JSON.stringify({result})+'\n');}}
  catch(error){if(res.headersSent){if(!res.destroyed)res.end(JSON.stringify({error:error instanceof ScanError?error.message:'بررسی کامل نشد.'})+'\n');}else next(error);}
  finally{activeScans--;}
});
app.post('/api/jobs/start',handleScan(body=>startJob(body)));
app.post('/api/jobs/step',async(req,res,next)=>{
  if(activeScans>=8)return res.status(503).json({error:'سرویس مشغول است؛ کمی بعد دوباره تلاش کنید.'});
  activeScans++;const controller=new AbortController();
  res.on('close',()=>{if(!res.writableEnded)controller.abort();});
  const emit=event=>{if(res.destroyed)return;if(!res.headersSent)res.type('application/x-ndjson');res.write(JSON.stringify({event})+'\n');};
  try{const job=await stepJob(req.body,{onEvent:emit,signal:controller.signal});if(!res.destroyed){if(!res.headersSent)res.type('application/x-ndjson');res.end(JSON.stringify({job,report:job.done?scanJobReport(job):undefined})+'\n');}}
  catch(error){if(res.headersSent){if(!res.destroyed)res.end(JSON.stringify({error:error instanceof ScanError?error.message:'بررسی این دسته کامل نشد؛ از مرحلهٔ قبل ادامه دهید.'})+'\n');}else next(error);}
  finally{activeScans--;}
});
app.use('/api', (error,req,res,next)=> {
  if (Number.isInteger(error.status)&&error.status>=400&&error.status<600) return res.status(error.status).json({error:error.message});
  if (error instanceof ScanError) return res.status(error.status).json({ error: error.message });
  if (error.type === 'entity.too.large') return res.status(413).json({error:'حجم درخواست بیش‌ازحد مجاز است. فقط لینک یا گزارش صادرشده را ارسال کنید.'});
  if (error.type === 'entity.parse.failed') return res.status(400).json({error:'درخواست نامعتبر است.'});
  console.error('Scan request failed:', error.code || error.name);
  res.status(502).json({ error: 'دسترسی به سایت ممکن نشد. آدرس، اتصال یا گواهی سایت را بررسی کنید.' });
});
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
app.use('/api', (req,res)=>res.status(404).json({error:'مسیر درخواست پیدا نشد.'}));
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  app.use(express.static(path.join(root,'dist')));
  app.get('/{*path}', (req,res)=>res.sendFile(path.join(root,'dist/index.html')));
}
return app;
}
export default createApp();
