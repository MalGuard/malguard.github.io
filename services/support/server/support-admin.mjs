// Separate step-up authentication for owner-only operations.
// A MalGuard account session alone never grants global support/admin access.
// No token, secret, or OTP is ever logged or persisted in plaintext.
import {createHmac,randomInt,randomBytes,timingSafeEqual} from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ADMIN_TTL=15*60*1000;
const fail=(status,code)=>Object.assign(new Error(code),{status,code});
const normalize=value=>typeof value==='string'?value.trim().toLowerCase():'';
const trustedEmail=value=>normalize(value).length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalize(value));
export function createSupportAdmin({
 email=process.env.SUPPORT_ADMIN_EMAIL,
 secret=process.env.SUPPORT_ADMIN_SECRET,
 store,
 mailer,
 now=()=>Date.now()
}={}){
 const adminEmail=normalize(email);
 const enabled=trustedEmail(adminEmail)&&typeof secret==='string'&&secret.length>=32&&
   !!store?.enabled&&!!mailer?.enabled;
 function hmac(value) {
  if(!enabled)throw fail(503,'support_admin_unavailable');
  return createHmac('sha256',secret).update(value).digest();
 }
 function requireAccount(actor){
  if(!enabled)throw fail(503,'support_admin_unavailable');
  if(actor?.verified!==true||actor.method!=='account'||actor.email!==adminEmail||
     !UUID.test(actor.accountId||''))throw fail(403,'forbidden');
 }
 async function requestCode(actor){
  requireAccount(actor);
  const code=String(randomInt(0,100000000)).padStart(8,'0');
  const codeHash=hmac('admin-code:'+adminEmail+':'+code).toString('hex');
  const challengeId=await store.issueAdminChallenge(adminEmail,codeHash);
  if(!UUID.test(challengeId||''))throw fail(503,'support_admin_unavailable');
  await mailer.sendAdminCode({email:adminEmail,code});
  return {challengeId,expiresInSeconds:600};
 }
 async function verifyCode(actor,challengeId,code){
  requireAccount(actor);
  if(!UUID.test(challengeId||'')||typeof code!=='string'||!/^[0-9]{8}$/.test(code))
   throw fail(401,'invalid_admin_challenge');
  const hash=hmac('admin-code:'+adminEmail+':'+code).toString('hex');
  if(await store.redeemAdminChallenge(challengeId,adminEmail,hash)!==true)
   throw fail(401,'invalid_admin_challenge');
  const issued=now();
  const claims={v:1,email:adminEmail,accountId:actor.accountId,iat:issued,
   exp:issued+ADMIN_TTL,nonce:randomBytes(16).toString('base64url')};
  const payload=Buffer.from(JSON.stringify(claims)).toString('base64url');
  const unsigned='mgadm1.'+payload;
  return {accessToken:unsigned+'.'+hmac(unsigned).toString('base64url'),
    expiresAt:new Date(claims.exp).toISOString()};
 }
 function actorFromToken(token){
  if(!enabled)throw fail(503,'support_admin_unavailable');
  if(typeof token!=='string'||token.length>1300)throw fail(401,'unauthorized');
  const parts=token.split('.');
  if(parts.length!==3||parts[0]!=='mgadm1'||!/^[A-Za-z0-9_-]+$/.test(parts[1])||
    !/^[A-Za-z0-9_-]{43}$/.test(parts[2]))throw fail(401,'unauthorized');
  const signature=Buffer.from(parts[2],'base64url'),expected=hmac('mgadm1.'+parts[1]);
  if(signature.length!==expected.length||!timingSafeEqual(signature,expected))
    throw fail(401,'unauthorized');
  let claims;
  try{claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));}
  catch{throw fail(401,'unauthorized');}
  const at=now();
  if(claims?.v!==1||claims.email!==adminEmail||!UUID.test(claims.accountId||'')||
     !Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.exp)||
     claims.iat>at||claims.exp<=at||claims.exp-claims.iat!==ADMIN_TTL)
    throw fail(401,'unauthorized');
  return {verified:true,method:'admin',role:'support-admin',
   permission:'support:manage',email:adminEmail,accountId:claims.accountId};
 }
 return {enabled,requestCode,verifyCode,actorFromToken};
}
