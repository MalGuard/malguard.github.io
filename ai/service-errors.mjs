// Only fixed codes and validated timing cross the provider boundary. Never
// forward upstream messages, URLs, account identifiers or credential details.
const codes=new Set(['all_providers_cooling_down','quota_exhausted','sign_in_required','account_unavailable','quota_unconfigured','quota_unavailable','rate_limited','provider_rate_limited','provider_quota_exhausted','provider_billing_required','provider_auth_failed','provider_unavailable','provider_timeout','model_unavailable','model_not_configured','routing_not_configured','search_not_configured','search_no_sources','search_consent_required','model_consent_required','lookup_consent_required','file_consent_required','website_consent_required','service_busy','service_disabled','request_too_large','invalid_request','invalid_json','json_required','origin_denied','network_error','request_failed','local_execution_required','invalid_model','invalid_message','invalid_history','invalid_consent','invalid_operation','invalid_query','method_not_allowed','workspace_required','isolated_execution_consent_required']);
export class ServiceError extends Error {
 constructor(code,status=502,details={}){super(code);this.code=code;this.status=status;Object.assign(this,details);}
}
export function retryDetails(value,now=Date.now()){
 if(typeof value!=='string'||!value.trim()||value.length>100)return {};
 const raw=value.trim();
 const seconds=/^\d+(?:\.\d+)?$/.test(raw)?Math.ceil(Number(raw)):null;
 const stamp=seconds===null?Date.parse(raw):now+seconds*1000;
 // Bound untrusted times to one year; invalid/past dates mean unknown.
 if(!Number.isFinite(stamp)||stamp<now||stamp>now+366*86400000)return {};
 return {retryAfterSeconds:Math.ceil((stamp-now)/1000),retryAt:new Date(stamp).toISOString()};
}
export function publicFailure(error,fallback='provider_unavailable'){
 const code=error?.code||error?.error;
 const result={error:codes.has(code)?code:fallback};
 if(typeof error?.retryAt==='string'&&/^\d{4}-\d\d-\d\dT/.test(error.retryAt)&&Number.isFinite(Date.parse(error.retryAt))){
  result.retryAt=new Date(error.retryAt).toISOString();
  if(Number.isInteger(error.retryAfterSeconds)&&error.retryAfterSeconds>=0&&error.retryAfterSeconds<=366*86400)result.retryAfterSeconds=error.retryAfterSeconds;
 }
 return result;
}
export function httpFailure(status,headers,body,now=Date.now()){
 let code=status===429?'provider_rate_limited':status===402?'provider_billing_required':[401,403].includes(status)?'provider_auth_failed':'provider_unavailable';
 const upstreamCode=body?.error?.code||body?.error?.type||body?.code;
 if([402,429].includes(status)&&['insufficient_quota','quota_exceeded','daily_limit_exceeded','billing_hard_limit_reached'].includes(upstreamCode))code='provider_quota_exhausted';
 const retryAfter=typeof headers?.get==='function'?headers.get('retry-after'):headers?.['retry-after'];
 let timing=retryDetails(retryAfter,now);
 if(!timing.retryAt&&[429,503].includes(status)){
  const info=body?.error?.details?.find?.(d=>d?.['@type']==='type.googleapis.com/google.rpc.RetryInfo');
  if(typeof info?.retryDelay==='string'&&/^\d+(?:\.\d+)?s$/.test(info.retryDelay))timing=retryDetails(info.retryDelay.slice(0,-1),now);
 }
 return new ServiceError(code,[402,429].includes(status)?429:[401,403].includes(status)?503:502,timing);
}
