import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

export class ScanError extends Error {
  constructor(message, status = 422, code) { super(message); this.status = status; if (code) this.code = code; }
}

export function publicAddress(address) {
  try {
    let ip = ipaddr.parse(address);
    if (ip.kind() === 'ipv6' && ip.isIPv4MappedAddress()) ip = ip.toIPv4Address();
    return ip.range() === 'unicast';
  } catch { return false; }
}

export const cleanUrlInput = value => value.replace(/^[\s\u200B\uFEFF\uFFFC]+|[\s\u200B\uFEFF\uFFFC]+$/g, '');

export function normalizeUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || !value.trim()) throw new ScanError('یک آدرس سایت معتبر وارد کنید.', 400);
  // Clipboard attachments can leave a trailing object-replacement character (OBJ).
  // Only remove literal edge artifacts; encoded path characters retain their meaning.
  const cleaned = cleanUrlInput(value);
  let url;
  try { url = new URL(/^[a-z][a-z\d+.-]*:/i.test(cleaned) ? cleaned : `https://${cleaned}`); }
  catch { throw new ScanError('آدرس واردشده معتبر نیست.', 400); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new ScanError('فقط لینک‌های HTTP و HTTPS قابل بررسی هستند.', 400);
  if (url.username || url.password) throw new ScanError('لینک دارای نام کاربری یا رمز عبور قابل بررسی نیست.', 400);
  if (url.port && !['80', '443'].includes(url.port)) throw new ScanError('بررسی فقط روی پورت‌های عمومی وب انجام می‌شود.', 400);
  url.hash = '';
  return url;
}

const dnsCache = new Map();

async function resolveDomain(host, options) {
  // Managed proxy environments may have slow/unavailable UDP DNS. Use HTTPS DNS
  // through the same proxy, with a fixed public resolver IP and verified TLS.
  if (!process.env.HTTPS_PROXY && !process.env.https_proxy) return dns.lookup(host, options);
  const cached = dnsCache.get(host);
  if (cached && cached.expires > Date.now()) return cached.answers;
  const responses = await Promise.all(['A','AAAA'].map(async type => {
    const url = new URL('https://cloudflare-dns.com/dns-query');
    url.searchParams.set('name',host); url.searchParams.set('type',type);
    const response = await requestPinned(url, {address:'1.1.1.1',family:4}, {limit:64*1024,timeout:4000,headers:{Accept:'application/dns-json'}});
    if (response.status !== 200) throw new ScanError('سرویس نام دامنه پاسخ قابل استفاده‌ای نداد.');
    const data = JSON.parse(response.bytes.toString());
    if (data.Status !== 0) return [];
    return (data.Answer || []).filter(a=>[1,28].includes(a.type)).map(a=>({address:a.data,family:a.type===1?4:6}));
  }));
  const answers = responses.flat();
  dnsCache.set(host,{answers,expires:Date.now()+60000});
  if(dnsCache.size>300) dnsCache.delete(dnsCache.keys().next().value);
  return answers;
}

export async function resolvePublic(url, resolver = resolveDomain) {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || /\.(localhost|local|internal|test|invalid)$/i.test(host)) throw new ScanError('آدرس‌های محلی و شبکهٔ خصوصی قابل بررسی نیستند.', 400);
  const answers = ipaddr.isValid(host) ? [{ address: host, family: ipaddr.parse(host).kind() === 'ipv4' ? 4 : 6 }] : await resolver(host, { all: true });
  if (!answers.length || answers.some(a => !publicAddress(a.address))) throw new ScanError('این آدرس به شبکهٔ خصوصی یا غیرعمومی اشاره می‌کند.', 400);
  return answers.find(a => a.family === 4) || answers[0];
}

// Resolve, validate and pin each target IP before connecting, including every redirect.
// Proxy requests also use the pinned IP, keeping DNS rebinding out of the request path.
function requestPinned(url, address, { limit, method = 'GET', headers = {}, body, timeout = 12000, htmlOnly = false,htmlLimit, signal }) {
  return new Promise((resolve, reject) => {
    const secure = url.protocol === 'https:';
    const proxy = secure ? (process.env.HTTPS_PROXY || process.env.https_proxy) : (process.env.HTTP_PROXY || process.env.http_proxy);
    const agent = proxy ? (secure ? new HttpsProxyAgent(proxy) : new HttpProxyAgent(proxy)) : undefined;
    const options = {
      protocol: url.protocol, hostname: address.address, family: address.family,
      port: url.port || (secure ? 443 : 80), path: url.pathname + url.search,
      method, agent, servername: url.hostname.replace(/^\[|\]$/g, ''),
      headers: { Host: url.host, 'User-Agent': 'GameScamGuard/1.0 (passive link inspection)', 'Accept-Encoding': 'identity', ...headers },
      rejectUnauthorized: true,
    };
    let settled = false,receivedBytes=0;
    const finish = (err, result) => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); agent?.destroy(); if(err){err.bytesRead=receivedBytes;reject(err);}else resolve(result); };
    const req = (secure ? https : http).request(options, res => {
      const redirect = [301,302,303,307,308].includes(res.statusCode) && res.headers.location;
      if (redirect) { res.destroy(); finish(null, { status: res.statusCode, headers: res.headers, bytes: Buffer.alloc(0) }); return; }
      if (htmlOnly && res.headers['content-type'] && !String(res.headers['content-type']).toLowerCase().includes('html')) {
        res.destroy(); finish(null, { status: res.statusCode, headers: res.headers, bytes: Buffer.alloc(0) }); return;
      }
      if(htmlLimit&&String(res.headers['content-type']||'').toLowerCase().includes('html'))limit=Math.min(limit,htmlLimit);
      if (Number(res.headers['content-length']) > limit) { res.destroy(); finish(new ScanError('حجم محتوا از سقف مجاز بررسی بیشتر است.')); return; }
      const chunks = []; let size = 0;
      res.on('data', chunk => { size += chunk.length;receivedBytes=size; if (size > limit) { res.destroy(); finish(new ScanError('حجم محتوا از سقف مجاز بررسی بیشتر است.')); } else chunks.push(chunk); });
      res.on('end', () => finish(null, { status: res.statusCode, headers: res.headers, bytes: Buffer.concat(chunks) }));
      res.on('error', err => finish(err));
    });
    const timer = setTimeout(() => { req.destroy(); finish(new ScanError('زمان دریافت پاسخ تمام شد؛ دوباره تلاش کنید.',422,'request_timeout')); }, timeout);
    const abort = () => { req.destroy(); finish(new DOMException('Request aborted','AbortError')); };
    signal?.addEventListener('abort', abort, {once:true});
    req.on('error', err => finish(err));
    if (signal?.aborted) { abort(); return; }
    if (body) req.write(body);
    req.end();
  });
}

export async function fetchPublic(input, options = {}) {
  let url = normalizeUrl(input instanceof URL ? input.href : input);
  const redirects = [];
  const deadline = Date.now() + (options.totalTimeout || 25000);
  for (let i = 0; i <= 4; i++) {
    if (options.signal?.aborted) throw new DOMException('Request aborted','AbortError');
    if (Date.now() >= deadline) throw new ScanError('زمان بررسی این لینک تمام شد.',422,'request_timeout');
    const address = await Promise.race([resolvePublic(url), new Promise((_, reject) => { const t = setTimeout(() => reject(new ScanError('پاسخی از نام دامنه دریافت نشد.',422,'dns_timeout')), 5000); t.unref(); })]);
    const response = await requestPinned(url, address, { limit: options.limit || 2 * 1024 * 1024, ...options, timeout: Math.min(options.timeout || 12000, deadline - Date.now()) });
    if ([301,302,303,307,308].includes(response.status) && response.headers.location) {
      if (options.noRedirect) throw new ScanError('پایگاه تهدید به آدرس دیگری منتقل شد؛ استعلام متوقف شد.');
      redirects.push({ from: url.href, to: new URL(response.headers.location, url).href, status: response.status });
      url = normalizeUrl(new URL(response.headers.location, url).href);
      continue;
    }
    if (response.status < 200 || response.status >= 300) {
      const error = new ScanError(`سایت پاسخ HTTP ${response.status} داد؛ محتوای آن قابل بررسی نبود.`);
      error.remoteStatus = response.status;
      error.bytesRead=response.bytes.length;
      throw error;
    }
    return { ...response, url: url.href, redirects };
  }
  throw new ScanError('تعداد انتقال‌های لینک بیش از حد مجاز است.');
}
