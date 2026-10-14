import originalClient from './vendor/malwarebazaar-client.cjs';
import { fetchPublic } from './network.js';

const { MalwareBazaarClient } = originalClient;

// Reuse the user's existing GTA Guard integration and credential variable name.
const configuredKey = name => process.env[name]?.trim() || undefined;
export const abuseAuthKey = () => configuredKey('ABUSECH_AUTH_KEY') || configuredKey('MALGUARD_ABUSECH_AUTH_KEY');
export const malwareBazaarAuthKey = () => configuredKey('MALWAREBAZAAR_AUTH_KEY') || abuseAuthKey();
// abuse.ch documents one personal Auth-Key for all its Community APIs.
// Explicit server configuration can reuse the already valid key without copying its value.
export const urlhausAuthKey = () => configuredKey('URLHAUS_AUTH_KEY_SOURCE') === 'malwarebazaar'
  ? configuredKey('MALWAREBAZAAR_AUTH_KEY') : abuseAuthKey();

export function createBazaarClient(options = {}) {
  return new MalwareBazaarClient({
    authKeyProvider: async () => malwareBazaarAuthKey(),
    timeoutMs: 8000,
    maxResponseBytes: 256 * 1024,
    fetchImpl: async (url, request) => {
      try {
      const response = await fetchPublic(url, {
        method: request.method, headers: request.headers, body: request.body,
        limit: 256 * 1024, timeout: 7000, totalTimeout: 10000, noRedirect: true,
        signal: request.signal,
      });
      return { ok: response.status >= 200 && response.status < 300, status: response.status, text: async () => response.bytes.toString('utf8') };
      } catch (error) {
        if ([401,403].includes(error.remoteStatus)) return {ok:false,status:error.remoteStatus,text:async()=>''};
        throw error;
      }
    },
    ...options,
  });
}

export function mapBazaarResult(result) {
  if (result.status === 'known_malicious') return {
    status: 'listed', message: 'هش فایل در MalwareBazaar به‌عنوان بدافزار گزارش شده است.',
    signature: result.signature || 'malware', fileType: result.fileType, tags: result.tags,
    firstSeen: result.firstSeen, lastSeen: result.lastSeen,
  };
  if (result.status === 'not_found') return { status: 'not_found', message: 'گزارش شناخته‌شده‌ای برای این هش یافت نشد؛ این به معنی امن بودن نیست.' };
  if (result.status === 'not_configured') return { status: 'unconfigured', message: 'کلید دسترسی MalwareBazaar تنظیم نشده است.' };
  if (result.status === 'auth_error' || ['http_401','http_403'].includes(result.reason)) return { status: 'auth_error', message: 'MalwareBazaar دسترسی این استعلام را نپذیرفت؛ کلید یا مجوز حساب را بررسی کنید.', reason:result.reason };
  return { status: 'unavailable', message: 'نتیجهٔ قابل اتکایی از MalwareBazaar دریافت نشد؛ امنیت فایل تأیید نمی‌شود.', reason: result.reason || result.status };
}

export async function lookupUrl(value, {authKeyProvider = urlhausAuthKey, transport = fetchPublic} = {}) {
  const authKey = authKeyProvider();
  if (!authKey) return {status:'unconfigured',message:'کلید دسترسی URLhaus تنظیم نشده است.'};
  const authError = reason => ({status:'auth_error',message:'URLhaus دسترسی این استعلام را نپذیرفت؛ کلید یا مجوز حساب را بررسی کنید.',reason});
  try {
    const body = new URLSearchParams({url:value}).toString();
    const response = await transport('https://urlhaus-api.abuse.ch/v1/url/',{
      method:'POST',noRedirect:true,limit:1024*1024,
      headers:{'Auth-Key':authKey,'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body)},body,
    });
    if ([401,403].includes(response.status)) return authError(`http_${response.status}`);
    if (response.status < 200 || response.status >= 300) return {status:'unavailable',message:'URLhaus پاسخ قابل استفاده‌ای نداد؛ استعلام امنیت انجام نشد.'};
    const data = JSON.parse(response.bytes.toString('utf8'));
    if (['no_api_key','invalid_api_key','unknown_auth_key','unauthorized'].includes(data.query_status)) return authError(data.query_status);
    if (data.query_status === 'no_results') return {status:'not_found',message:'گزارش شناخته‌شده‌ای یافت نشد؛ این به معنی امن بودن نیست.'};
    if (data.query_status === 'ok' && typeof data.url === 'string' && new URL(data.url).href === new URL(value).href) return {
      status:'listed',message:'در پایگاه تهدید گزارش شده است.',signature:String(data.threat || 'malware').slice(0,200),
    };
    return {status:'unavailable',message:'URLhaus نتیجهٔ قابل استفاده‌ای برای این لینک برنگرداند.'};
  } catch (error) {
    if ([401,403].includes(error.remoteStatus)) return authError(`http_${error.remoteStatus}`);
    return {status:'unavailable',message:'استعلام URLhaus انجام نشد؛ امنیت این لینک تأیید نمی‌شود.'};
  }
}

export async function lookupFileHash(hash) {
  return mapBazaarResult(await createBazaarClient().lookupSha256(hash));
}
