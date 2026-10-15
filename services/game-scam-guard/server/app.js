import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as scanner from './scanner.js';
import { ScanError } from './network.js';
import {startScanJob,stepScanJob,scanJobReport} from './scan-jobs.js';
import {readUpload,scanUploadedFile,MAX_UPLOAD_BYTES} from './uploads.js';
import {cloudExecutionStatus} from './cloud-execution.js';

export function createApp({ scanSite = scanner.scanSite, scanFiles = scanner.scanFiles, providerStatus = scanner.providerStatus,startJob=startScanJob,stepJob=stepScanJob,uploadScan=scanUploadedFile } = {}) {
const app = express();
app.disable('x-powered-by');
if (process.env.VERCEL) app.set('trust proxy', 1);
app.use('/api/upload',express.json({limit:'4200kb'}));
app.use('/api/jobs',express.json({limit:'1600kb'}));
app.use('/api/advanced', express.json({ limit: '800kb' }));
app.use(express.json({ limit: '4kb' }));
app.use('/api', (req, res, next) => {
  res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  // JSON + same-origin POSTs prevent cross-origin scan requests using a visitor's browser.
  const protocol = process.env.VERCEL ? 'https' : process.env.NODE_ENV === 'production' ? req.protocol : (req.headers['x-forwarded-proto'] || req.protocol);
  const expectedOrigin = process.env.PUBLIC_ORIGIN || `${protocol}://${req.headers.host}`;
  // Vercel may supply an already-parsed body; enforce the same limits in that case.
  const upload=req.path==='/upload';
  const limit = req.path.startsWith('/jobs/')?1600*1024:req.path === '/advanced' ? 800*1024 :upload?4*1024*1024+8192:4*1024;
  if (req.body && (Buffer.isBuffer(req.body)?req.body.length:Buffer.byteLength(JSON.stringify(req.body))) > limit) return res.status(413).json({error:'حجم درخواست بیش‌ازحد مجاز است. فقط لینک یا گزارش صادرشده را ارسال کنید.'});
  if (req.method === 'POST' && (!(upload?(req.is('multipart/form-data')||req.is('application/json')):req.is('application/json')) || (req.headers.origin && req.headers.origin !== expectedOrigin))) return res.status(403).json({ error: 'درخواست باید از داخل برنامه ارسال شود.' });
  next();
});
const rates = new Map(); let activeScans = 0;
app.use(['/api/scan', '/api/advanced','/api/jobs','/api/upload'], (req, res, next) => {
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
app.get('/api/health', (req,res)=>res.json({ status: 'ok', providers: providerStatus(), mode: 'independent-html-and-file', maxFileSize: 12 * 1024 * 1024, maxFiles:128,maxUploadSize:MAX_UPLOAD_BYTES,cloudExecution:cloudExecutionStatus() }));
app.post('/api/scan', handleScan(body=>scanSite(body?.url,{allowThreatContent:['advanced','ultra'].includes(body?.mode)})));
app.post('/api/advanced', handleScan(body=>scanFiles(body?.id, body?.token)));
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
app.post('/api/upload',async(req,res,next)=>{
  if(activeScans>=8)return res.status(503).json({error:'سرویس مشغول است؛ کمی بعد دوباره تلاش کنید.'});
  activeScans++;try{const upload=await readUpload(req);const report=await uploadScan(upload);if(!res.destroyed)res.json(report);}catch(error){next(error);}finally{activeScans--;}
});
app.use('/api', (error,req,res,next)=> {
  if (error instanceof ScanError) return res.status(error.status).json({ error: error.message });
  if (error.type === 'entity.too.large') return res.status(413).json({error:req.path.startsWith('/upload')?'حجم درخواست فایل بیش‌ازحد مجاز است؛ سقف فایل آپلودی ۳ مگابایت است.':'حجم درخواست بیش‌ازحد مجاز است. فقط لینک یا گزارش صادرشده را ارسال کنید.'});
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
