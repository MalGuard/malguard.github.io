// Local-only privacy candidate generator; never upload without an explicit preview/confirm.
const MAX_LOG=2*1024*1024;
const PANIC='[REDACTED]';
const privateBlock=/-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/gi;
const secretField=/(\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd|secret|authorization|client_secret|private_key)\b\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\r\n\s,}]+)/gi;
const authBearer=/\bBearer\s+[A-Za-z0-9_.~-]+/gi;
const jwt=/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const email=/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const ipv4=/\b(?:(?:25[0-5]|2[0-4]\d|1?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|1?\d{1,2})\b/g;
const urlQuery=/(https?:\/\/[^\s?&#]+)(?:\?[^\s#]+)(?:#[^\s]+)?/gi;
const windowsHome=/\b[A-Za-z]:\\Users\\[^\\\r\n]+/gi;
const unixHome=/\/(?:Users|home)\/[^\/\s]+/g;
export const supportPrivacyLimits=Object.freeze({logBytes:MAX_LOG,imageBytes:5*1024*1024,maxImages:3,maxLogs:1});
export function redactLog(input) {
  if(typeof input!=='string'||new TextEncoder().encode(input).byteLength>MAX_LOG)
    throw new TypeError('unsupported_log');
  let changes=0,output=input;
  for(const [pattern,make] of [
    [privateBlock,()=>PANIC],
    [secretField,match=>match.slice(0,match.search(/[:=]/)+1)+PANIC],
    [authBearer,()=> 'Bearer '+PANIC],
    [jwt,()=>PANIC],
    [email,()=> '[REDACTED_EMAIL]'],
    [ipv4,()=> '[REDACTED_IP]'],
    [urlQuery,match=>match.slice(0,match.indexOf('?'))+'?[REDACTED_QUERY]'],
    [windowsHome,()=> '[REDACTED_LOCAL_PATH]'],
    [unixHome,()=> '[REDACTED_LOCAL_PATH]']
  ]){
    output=output.replace(pattern,(...args)=>{changes++;return make(args[0]);});
  }
  // Deliberately do not assume all private information was found.
  return {redacted:output,replacements:changes,guaranteedClean:false};
}
export function validateLogText(input) {
  if(typeof input!=='string'||new TextEncoder().encode(input).byteLength>MAX_LOG) return false;
  if(input.includes('\0') || /[\x01-\x08\x0b\x0c\x0e-\x1f]/.test(input))return false;
  return true;
}
