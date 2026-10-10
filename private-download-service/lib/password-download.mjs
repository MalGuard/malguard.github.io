import {createHash, createDecipheriv, hkdfSync, scrypt, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {normalizeCode, PART_BYTES} from './download.mjs';

const MAGIC = Buffer.from('MGDL1\0', 'ascii');
const digest = data => createHash('sha256').update(data).digest('hex');
const deriveScrypt = promisify(scrypt);

export function downloadPassword(code, kdf) {
  if (kdf === undefined) return normalizeCode(code);
  if (kdf !== 'scrypt-v1' || typeof code !== 'string' || code.length < 1 || code.length > 80 ||
      Buffer.byteLength(code, 'utf8') > 160 || /[\u0000-\u001f\u007f]/u.test(code)) return null;
  return code; // Chosen passwords are exact: preserve case, spaces and punctuation.
}

export async function passwordDownloadKey(code, salt, build, kdf) {
  const normalized = downloadPassword(code, kdf);
  if (!normalized || !/^[a-f0-9]{64}$/.test(salt || '') || !/^[A-Za-z0-9._-]{1,100}$/.test(build || '')) {
    throw new Error('invalid password derivation input');
  }
  if (kdf === 'scrypt-v1') {
    const context = Buffer.concat([Buffer.from(salt, 'hex'), Buffer.from('MalGuard site download scrypt v1:' + build)]);
    return deriveScrypt(Buffer.from(normalized, 'utf8'), context, 32,
      {N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024});
  }
  // Retain compatibility with historical uniformly random 160-bit codes.
  return Buffer.from(hkdfSync('sha256', Buffer.from(normalized), Buffer.from(salt, 'hex'),
    Buffer.from('MalGuard site download v1:' + build), 32));
}

function reply(res, status, error) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({error}));
}

async function body(req) {
  const length = req.headers['content-length'];
  if (length !== undefined && (!/^\d{1,4}$/.test(length) || Number(length) > 512)) throw new Error('size');
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > 512) throw new Error('size');
    return typeof req.body === 'string' ? JSON.parse(raw) : req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 512) throw new Error('size');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function createPasswordDownloadHandler({metadata, readSealed, origin}) {
  if (!Number.isSafeInteger(metadata.size) || metadata.size < 1 || metadata.size > 40 * 1024 * 1024 ||
      !/^[a-f0-9]{64}$/.test(metadata.sha256 || '') || !/^[a-f0-9]{64}$/.test(metadata.sealedSha256 || '') ||
      !/^[a-f0-9]{64}$/.test(metadata.passwordSalt || '') ||
      (metadata.passwordKdf !== undefined && metadata.passwordKdf !== 'scrypt-v1') ||
      !/^[A-Za-z0-9._-]{1,100}$/.test(metadata.filename || '') ||
      !/^[A-Za-z0-9._-]{1,100}$/.test(metadata.build || '')) throw new Error('invalid release metadata');
  let sealedCache = null, sealedPromise = null, cache = null, cacheKey = null, active = 0;
  const failures = new Map();
  return async function download(req, res) {
    res.setHeader('Cache-Control', 'no-store, private, max-age=0');
    res.setHeader('Vary', 'Origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.headers.origin !== origin) return reply(res, 403, 'ACCESS_DENIED');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'X-Part-Index, X-File-Size, X-File-SHA256, X-Release-Seal-SHA256');
    res.setHeader('X-Release-Seal-SHA256', metadata.sealedSha256);
    if (req.method === 'OPTIONS') {res.statusCode = 204; res.end(); return;}
    if (req.method !== 'POST') return reply(res, 405, 'POST_REQUIRED');
    if ((req.headers['content-type'] || '').split(';')[0].trim() !== 'application/json') return reply(res, 415, 'JSON_REQUIRED');
    const ip = String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown').slice(0, 100);
    const now = Date.now();
    for (const [key, item] of failures) if (item.until <= now) failures.delete(key);
    if ((failures.get(ip)?.count || 0) >= 8) return reply(res, 429, 'TRY_LATER');
    const deny = () => {
      const entry = failures.get(ip) || {count: 0, until: now + 60_000};
      entry.count++;
      if (failures.size >= 2048 && !failures.has(ip)) failures.delete(failures.keys().next().value);
      failures.set(ip, entry);
      return reply(res, 403, 'ACCESS_DENIED');
    };
    let request;
    try {request = await body(req);} catch {return reply(res, 400, 'INVALID_REQUEST');}
    if (!request || typeof request !== 'object' || Array.isArray(request) ||
        Object.keys(request).sort().join(',') !== 'code,part' || !Number.isInteger(request.part) ||
        request.part < 0 || request.part >= Math.ceil(metadata.size / PART_BYTES)) return reply(res, 400, 'INVALID_REQUEST');
    if (!downloadPassword(request.code, metadata.passwordKdf)) return deny();
    if (active >= 2) return reply(res, 503, 'TRY_LATER');
    active++;
    let plaintext = null;
    try {
      const key = await passwordDownloadKey(request.code, metadata.passwordSalt, metadata.build, metadata.passwordKdf);
      if (!cache || !cacheKey || !timingSafeEqual(key, cacheKey)) {
        if (!sealedCache) {
          if (!sealedPromise) sealedPromise = Promise.resolve().then(readSealed).then(sealed => {
            if (!Buffer.isBuffer(sealed) || sealed.length !== metadata.size + 34 ||
                !sealed.subarray(0, 6).equals(MAGIC) || digest(sealed) !== metadata.sealedSha256) throw new Error('sealed integrity');
            sealedCache = sealed;
          }).finally(() => {sealedPromise = null;});
          await sealedPromise;
        }
        // A concurrent request may have completed authentication during the read.
        // Never clear a buffer already handed to an active response.
        if (!cache || !cacheKey || !timingSafeEqual(key, cacheKey)) {
          const decipher = createDecipheriv('aes-256-gcm', key, sealedCache.subarray(6, 18));
          decipher.setAAD(Buffer.from('MGDL1:' + metadata.build));
          decipher.setAuthTag(sealedCache.subarray(-16));
          plaintext = decipher.update(sealedCache.subarray(18, -16));
          let tail;
          try {tail = decipher.final();} catch {plaintext.fill(0); plaintext = null; return deny();}
          if (tail.length) plaintext = Buffer.concat([plaintext, tail]);
          if (plaintext.length !== metadata.size || digest(plaintext) !== metadata.sha256) throw new Error('installer integrity');
          cache = plaintext; plaintext = null; cacheKey = key;
        }
      }
      const start = request.part * PART_BYTES;
      const part = cache.subarray(start, Math.min(start + PART_BYTES, metadata.size));
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="' + metadata.filename + '.part-' + request.part + '"');
      res.setHeader('Content-Length', String(part.length));
      res.setHeader('X-Part-Index', String(request.part));
      res.setHeader('X-File-Size', String(metadata.size));
      res.setHeader('X-File-SHA256', metadata.sha256);
      res.end(part);
    } catch {
      if (plaintext) plaintext.fill(0);
      return reply(res, 503, 'DOWNLOAD_UNAVAILABLE');
    } finally {active--;}
  };
}
