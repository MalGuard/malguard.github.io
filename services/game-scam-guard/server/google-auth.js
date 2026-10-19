import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

const AUTHORIZE='https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN='https://oauth2.googleapis.com/token';
const USERINFO='https://openidconnect.googleapis.com/v1/userinfo';
const TTL=10*60*1000;
const failure=(status,message)=>Object.assign(new Error(message),{status});
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const decode=value=>JSON.parse(Buffer.from(value,'base64url').toString('utf8'));
const validRedirect=value=>{try{const url=new URL(String(value||''));return url.protocol==='https:'&&url.hostname==='game-scam-guard-connected.vercel.app'?url.toString():null;}catch{return null;}};

export function createGoogleAuth({clientId=process.env.GOOGLE_OAUTH_CLIENT_ID,clientSecret=process.env.GOOGLE_OAUTH_CLIENT_SECRET,redirectUri=process.env.GOOGLE_OAUTH_REDIRECT_URI||'https://game-scam-guard-connected.vercel.app/api/game-scam-guard/auth/google/callback',fetchImpl=fetch,now=()=>Date.now()}={}){
  const enabled=typeof clientId==='string'&&clientId.endsWith('.apps.googleusercontent.com')&&typeof clientSecret==='string'&&clientSecret.length>20&&!!validRedirect(redirectUri);
  const sign=value=>createHmac('sha256',clientSecret).update(value).digest('base64url');
  const state=payload=>{const body=encode(payload);return `${body}.${sign(body)}`;};
  const open=value=>{try{const [body,signature]=String(value||'').split('.');if(!body||!signature)return null;const expected=Buffer.from(sign(body)),actual=Buffer.from(signature);if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return null;const payload=decode(body);return payload?.type==='google-state'&&payload.expiresAt>=now()&&typeof payload.nonce==='string'?payload:null;}catch{return null;}};
  function start(){if(!enabled)throw failure(503,'Google sign-in is not configured yet.');const url=new URL(AUTHORIZE);url.search=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:'code',scope:'openid email profile',state:state({type:'google-state',nonce:randomBytes(18).toString('base64url'),expiresAt:now()+TTL}),prompt:'select_account'}).toString();return url.toString();}
  async function complete({state:rawState,code,error}){if(!enabled)throw failure(503,'Google sign-in is not configured yet.');if(error)throw failure(400,'Google sign-in was cancelled or denied.');if(!open(rawState)||typeof code!=='string'||code.length<12||code.length>4096)throw failure(400,'Google sign-in request is invalid or expired.');const token=await fetchImpl(TOKEN,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri,grant_type:'authorization_code'}).toString()});const body=await token.json().catch(()=>null);if(!token.ok||typeof body?.access_token!=='string')throw failure(502,'Google could not complete sign-in. Please try again.');const response=await fetchImpl(USERINFO,{headers:{authorization:`Bearer ${body.access_token}`}});const profile=await response.json().catch(()=>null);const email=typeof profile?.email==='string'?profile.email.trim().toLowerCase():'';if(!response.ok||profile?.email_verified!==true||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw failure(401,'Google did not provide a verified email address.');return {email,firstName:typeof profile.given_name==='string'?profile.given_name.trim():'',lastName:typeof profile.family_name==='string'?profile.family_name.trim():''};}
  return {enabled,status:{configured:enabled,hasClientId:typeof clientId==='string'&&clientId.endsWith('.apps.googleusercontent.com'),hasClientSecret:typeof clientSecret==='string'&&clientSecret.length>20},start,complete};
}
