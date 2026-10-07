import { createHash, createDecipheriv, timingSafeEqual } from 'node:crypto';

const MAX_BODY = 512;
export const PART_BYTES = 3 * 1024 * 1024;
const MAGIC = Buffer.from('MGDL1\0', 'ascii');

export function normalizeCode(value) {
  if (typeof value !== 'string' || value.length > 96) return null;
  const code = value.replace(/[ -]/g, '').toUpperCase();
  return /^MG[A-Z2-7]{32}$/.test(code) ? code : null;
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function reply(res, status, error) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error }));
}

async function readBody(req) {
  const length = req.headers['content-length'];
  if (length !== undefined && (!/^\d{1,4}$/.test(length) || Number(length) > MAX_BODY)) {
    throw new Error('body limit');
  }
  // Vercel may already have parsed JSON. Validate size and schema again.
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > MAX_BODY) throw new Error('body limit');
    return typeof req.body === 'string' ? JSON.parse(raw) : req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('body limit');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function createDownloadHandler({ metadata, readSealed, getSecrets, origin, publicAccess = false }) {
  if (typeof publicAccess !== 'boolean') throw new Error('invalid download policy');
  if (!Number.isSafeInteger(metadata.size) || metadata.size < 1 || metadata.size > 40 * 1024 * 1024 ||
      !/^[a-f0-9]{64}$/.test(metadata.sha256) || !/^[a-f0-9]{64}$/.test(metadata.sealedSha256) ||
      !/^[A-Za-z0-9._-]{1,100}$/.test(metadata.filename) ||
      !/^[A-Za-z0-9._-]{1,100}$/.test(metadata.build)) throw new Error('invalid release metadata');
  const failures = new Map();
  let cache = null;
  let cachedKey = null;
  let activeReads = 0;
  return async function download(req, res) {
    res.setHeader('Cache-Control', 'no-store, private, max-age=0');
    res.setHeader('Vary', 'Origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const requestOrigin = req.headers.origin;
    if (requestOrigin !== origin) return reply(res, 403, 'ACCESS_DENIED');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'X-Part-Index, X-File-Size, X-File-SHA256');
    if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
    if (req.method !== 'POST') return reply(res, 405, 'POST_REQUIRED');
    if ((req.headers['content-type'] || '').split(';')[0].trim() !== 'application/json') {
      return reply(res, 415, 'JSON_REQUIRED');
    }
    const secrets = getSecrets();
    if (!/^[a-f0-9]{64}$/.test(secrets.key || '') || (!publicAccess && !/^[a-f0-9]{64}$/.test(secrets.codeHash || ''))) {
      return reply(res, 503, 'DOWNLOAD_UNAVAILABLE');
    }
    // The hosting proxy supplies this header. This bounded limiter is local to
    // an instance; the 160-bit random code is the brute-force security boundary.
    const ip = String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown').slice(0,100);
    const now = Date.now();
    for (const [key, item] of failures) if (item.until <= now) failures.delete(key);
    if ((failures.get(ip)?.count || 0) >= 8) return reply(res, 429, 'TRY_LATER');
    let body;
    try { body = await readBody(req); } catch { return reply(res, 400, 'INVALID_REQUEST'); }
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).sort().join(',') !== (publicAccess ? 'part' : 'code,part') || !Number.isInteger(body.part) ||
        body.part < 0 || body.part >= Math.ceil(metadata.size / PART_BYTES)) {
      return reply(res, 400, 'INVALID_REQUEST');
    }
    const code = normalizeCode(body.code);
    const actual = createHash('sha256').update(code || 'invalid').digest();
    if (!publicAccess && (!code || !timingSafeEqual(actual, Buffer.from(secrets.codeHash, 'hex')))) {
      const entry = failures.get(ip) || { count: 0, until: now + 60_000 };
      entry.count += 1;
      if (failures.size >= 2048 && !failures.has(ip)) failures.delete(failures.keys().next().value);
      failures.set(ip, entry);
      return reply(res, 403, 'ACCESS_DENIED');
    }
    if (activeReads >= 2) return reply(res, 503, 'TRY_LATER');
    activeReads += 1;
    try {
      if (!cache || cachedKey !== secrets.key) {
        const sealed = await readSealed();
        if (!Buffer.isBuffer(sealed) || sealed.length !== metadata.size + 34 ||
            !sealed.subarray(0, 6).equals(MAGIC) || digest(sealed) !== metadata.sealedSha256) {
          throw new Error('sealed integrity');
        }
        const decipher = createDecipheriv('aes-256-gcm', Buffer.from(secrets.key, 'hex'), sealed.subarray(6,18));
        decipher.setAAD(Buffer.from('MGDL1:' + metadata.build));
        decipher.setAuthTag(sealed.subarray(-16));
        const plaintext = Buffer.concat([decipher.update(sealed.subarray(18,-16)), decipher.final()]);
        if (plaintext.length !== metadata.size || digest(plaintext) !== metadata.sha256) {
          plaintext.fill(0);
          throw new Error('installer integrity');
        }
        cache = plaintext;
        cachedKey = secrets.key;
      }
      const start = body.part * PART_BYTES;
      const part = cache.subarray(start, Math.min(start + PART_BYTES, metadata.size));
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="' + metadata.filename + '.part-' + body.part + '"');
      res.setHeader('Content-Length', String(part.length));
      res.setHeader('X-Part-Index', String(body.part));
      res.setHeader('X-File-Size', String(metadata.size));
      res.setHeader('X-File-SHA256', metadata.sha256);
      res.end(part);
    } catch {
      return reply(res, 503, 'DOWNLOAD_UNAVAILABLE');
    } finally { activeReads -= 1; }
  };
}
