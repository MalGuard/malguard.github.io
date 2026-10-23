import {normalizeUrl, publicAddress} from '../../game-scam-guard/server/network.js';
import {isIP} from 'node:net';

export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_BODY_BYTES = 1450000;
export const TOOLS = ['gta_guard', 'game_scam_guard', 'ai_web', 'malwarebazaar', 'urlhaus'];
export const MODELS = ['llama70b','llama8b','gemini_flash','groq_qwen'];
export class InputError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
const object = v => v && typeof v === 'object' && !Array.isArray(v);
export function publicUrl(value) {
  let url;
  try { url = normalizeUrl(value); } catch { throw new InputError('invalid_url'); }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || !host.includes('.') && !isIP(host) || /\.(localhost|local|internal|test|invalid|onion)$/i.test(host) || isIP(host) && !publicAddress(host)) throw new InputError('private_url');
  return url.href;
}
export function parseRequest(body) {
  if (!object(body) || Object.keys(body).some(k => !['message','locale','tool','input','consent','mode','history','model'].includes(k))) throw new InputError('invalid_request');
  const {message = '', locale = 'fa', tool = 'auto', input = {}, consent = {},mode='chat',history=[],model='llama70b'} = body;
  if(!MODELS.includes(model))throw new InputError('invalid_model');
  if(!['chat','worker'].includes(mode)||!Array.isArray(history)||history.length>12||history.some(m=>!object(m)||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>2000||Object.keys(m).some(k=>!['role','content'].includes(k)))||history.reduce((n,m)=>n+m.content.length,0)>12000)throw new InputError('invalid_history_or_mode');
  if (typeof message !== 'string' || message.length > 4000 || !['fa','en'].includes(locale) || !['auto',...TOOLS].includes(tool) || !object(input) || !object(consent)) throw new InputError('invalid_request');
  if (Object.keys(input).some(k => !['url','sha256','file','query'].includes(k)) || Object.keys(consent).some(k => !['fileUpload','websiteFetch','remoteLookup','modelShare'].includes(k)) || Object.values(consent).some(v => typeof v !== 'boolean')) throw new InputError('invalid_request');
  if (Object.keys(input).length > 1) throw new InputError('one_input_only');
  const clean = {};
  if(input.query!==undefined){if(typeof input.query!=='string'||!input.query.trim()||input.query.length>500)throw new InputError('invalid_query');clean.query=input.query.trim();}
  if (input.url !== undefined) clean.url = publicUrl(input.url);
  if (input.sha256 !== undefined) {
    if (typeof input.sha256 !== 'string' || !/^[a-f\d]{64}$/i.test(input.sha256)) throw new InputError('invalid_sha256');
    clean.sha256 = input.sha256.toLowerCase();
  }
  if (input.file !== undefined) {
    const file = input.file;
    if (!object(file) || Object.keys(file).some(k => !['name','base64'].includes(k)) || typeof file.name !== 'string' || !file.name.length || file.name.length > 180 || /[\x00-\x1f/\\]/.test(file.name) || typeof file.base64 !== 'string' || file.base64.length > Math.ceil(MAX_FILE_BYTES / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.base64)) throw new InputError('invalid_file');
    const bytes = Buffer.from(file.base64, 'base64');
    if (!bytes.length || bytes.length > MAX_FILE_BYTES || bytes.toString('base64') !== file.base64) throw new InputError('invalid_file');
    clean.file = {name: file.name, bytes};
  }
  // Only exact, bounded URL/hash tokens are recognized; user prose is never code.
  if (!Object.keys(clean).length) {
    const hash = message.match(/(?:^|\s)([a-f\d]{64})(?=$|\s)/i)?.[1];
    const url = message.match(/https?:\/\/[^\s<>"']+/i)?.[0];
    if (hash) clean.sha256 = hash.toLowerCase();
    else if (url) clean.url = publicUrl(url);
  }
  return {message, locale, tool, input: clean, consent,mode,history,model};
}
export const text = (v, max = 500) => typeof v === 'string' ? v.replace(/[\x00-\x08\x0b-\x1f\u202a-\u202e\u2066-\u2069]/g, '').slice(0,max) : '';
export const LIMIT = 'Only the stated checks were performed. No finding or absent threat report guarantees safety. No sample was executed.';
export const SOURCE_URLS={gta_guard:'https://github.com/MalGuard/malguard.github.io/tree/main/services/game-scam-guard/server',game_scam_guard:'https://github.com/MalGuard/malguard.github.io/tree/main/services/game-scam-guard/server',malwarebazaar:'https://bazaar.abuse.ch/api/',urlhaus:'https://urlhaus.abuse.ch/api/',ai_web:'https://docs.tavily.com/documentation/api-reference/endpoint/search'};
export function report(tool, outcome, {evidence = [], sources = [], limitations = [], metadata = {}, reason} = {}) {
  const checkedAt = new Date().toISOString();
  if(!sources.length)sources=[{name:tool,url:SOURCE_URLS[tool],status:outcome==='error'?'error':'not_checked'}];
  return {tool, outcome, checkedAt, evidence, sources: sources.map(s => ({...s, checkedAt: s.checkedAt || checkedAt})), limitations: [...limitations, LIMIT], metadata, ...(reason ? {reason} : {})};
}
