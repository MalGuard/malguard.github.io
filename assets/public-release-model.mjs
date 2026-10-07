export const SERVICE_URL = 'https://malguard-private-download.vercel.app/api/download';
export const MAX_FILE_BYTES = 40 * 1024 * 1024;
export const PART_BYTES = 3 * 1024 * 1024;
const version = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const build = /^MG-\d{1,3}\.\d{1,3}\.\d{1,3}-(?:IEXPRESS-|GUI-)?WIN64-[a-f0-9]{12}$/;
const hash = /^[a-f0-9]{64}$/;
export function validateRelease(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      data.schemaVersion !== '1.0.0' || data.platform !== 'windows-x64' ||
      data.status !== 'public-download-ready' || data.serviceUrl !== SERVICE_URL ||
      data.filename !== 'MalGuard-Setup-x64.exe' || !version.test(data.version || '') ||
      !version.test(data.engineVersion || '') || !build.test(data.build || '') ||
      !/^[a-f0-9]{40}$/.test(data.sourceCommit || '') ||
      data.build !== `MG-${data.version}-WIN64-${data.sourceCommit?.slice(0,12)}` ||
      !Number.isSafeInteger(data.size) || data.size < 1 || data.size > MAX_FILE_BYTES ||
      !hash.test(data.sha256 || '') || data.partBytes !== PART_BYTES ||
      data.partCount !== Math.ceil(data.size / PART_BYTES) ||
      !data.changes || !['en','fa'].every(language => Array.isArray(data.changes[language]) &&
        data.changes[language].length > 0 && data.changes[language].length <= 20 &&
        data.changes[language].every(line => typeof line === 'string' && line.length > 0 && line.length <= 500))) {
    throw new Error('metadata');
  }
  return Object.freeze({...data, changes: Object.freeze({en: Object.freeze([...data.changes.en]), fa: Object.freeze([...data.changes.fa])})});
}
export function checkBuild(input, latest, history) {
  if (typeof input !== 'string' || input.length > 100) return 'invalid';
  const normalized = input.trim();
  if (!build.test(normalized)) return 'invalid';
  if (normalized === latest.build) return 'current';
  if (!Array.isArray(history) || history.length > 1000) throw new Error('history');
  return history.some(item => item && item.build === normalized && item.supersededBy === latest.build) ? 'older' : 'unknown';
}
export async function readBounded(response, expected) {
  if (!response.body || !Number.isSafeInteger(expected) || expected < 1 || expected > PART_BYTES) throw new Error('integrity');
  const reader = response.body.getReader();
  const bytes = new Uint8Array(expected);
  let position = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array) || position + value.length > expected) throw new Error('integrity');
      bytes.set(value, position);
      position += value.length;
    }
    if (position !== expected) throw new Error('integrity');
    return bytes;
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
}
export async function readJsonBounded(response, limit) {
  if (!response.body || !Number.isSafeInteger(limit) || limit < 1 || limit > 100000) throw new Error('metadata');
  const reader=response.body.getReader(), bytes=new Uint8Array(limit);
  let position=0;
  try {
    while (true) {
      const {done,value}=await reader.read();
      if(done)break;
      if(!(value instanceof Uint8Array)||position+value.length>limit)throw new Error('metadata');
      bytes.set(value,position);position+=value.length;
    }
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,position)));
  } catch(error) {await reader.cancel().catch(()=>{});throw error;}
  finally {reader.releaseLock();}
}
