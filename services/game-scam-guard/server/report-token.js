import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { ScanError } from './network.js';

const localSecret = randomBytes(32).toString('hex');
const expired = () => new ScanError('گزارش منقضی یا نامعتبر است. لینک سایت را دوباره بررسی کنید.', 404);

// The encrypted capability carries only server-observed evidence, never client-supplied URLs.
// A shared server secret lets a different Vercel instance continue the same report.
export function createReportTokens({secret, now = Date.now,maxBytes=128*1024} = {}) {
  const key = () => {
    const value = secret ?? process.env.GUARD_REPORT_SECRET ?? (process.env.VERCEL ? '' : localSecret);
    if (typeof value !== 'string' || value.length < 32) throw new ScanError('تنظیمات نگهداری گزارش روی سرور کامل نیست.', 503);
    return createHash('sha256').update(value).digest();
  };
  return {
    issue(report) {
      const snapshot = {...report, preview: report.preview ? {status:report.preview.status,detail:report.preview.detail} : undefined};
      delete snapshot.scanToken;
      const bytes = Buffer.from(JSON.stringify({report:snapshot,expires:now()+30*60*1000}));
      if (bytes.length > maxBytes) throw new ScanError('شواهد این صفحه برای نگهداری گزارش بیش‌ازحد بزرگ است.');
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key(), iv);
      const encrypted = Buffer.concat([cipher.update(deflateRawSync(bytes)),cipher.final()]);
      return 'r1.'+Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');
    },
    read(token, id) {
      const sharedKey = key();
      try {
        if (typeof token !== 'string' || token.length > Math.ceil(maxBytes*4/3)+4096 || !/^r1\.[\w-]+$/.test(token)) throw expired();
        const bytes = Buffer.from(token.slice(3),'base64url');
        if (bytes.length < 29) throw expired();
        const decipher = createDecipheriv('aes-256-gcm',sharedKey,bytes.subarray(0,12));
        decipher.setAuthTag(bytes.subarray(12,28));
        const packed = Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]);
        const payload = JSON.parse(inflateRawSync(packed,{maxOutputLength:maxBytes}).toString('utf8'));
        if (!Number.isFinite(payload.expires) || payload.expires <= now() || payload.report?.id !== id || !Array.isArray(payload.report.files)) throw expired();
        return {result:{...payload.report,scanToken:token},expires:payload.expires,running:false};
      } catch { throw expired(); }
    },
  };
}

export const reportTokens = createReportTokens({maxBytes:512*1024});
