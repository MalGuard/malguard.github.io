import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {createEmailAuth} from '../../game-scam-guard/server/email-auth.js';
import {createAccountStore} from '../../game-scam-guard/server/account-store.js';

const SESSION_MS=30*60*1000;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=(status,code)=>Object.assign(new Error(code),{status,code});
const norm=value=>typeof value==='string'?value.trim().toLowerCase():'';

export function createSupportIdentity({
  auth=createEmailAuth(), accounts=createAccountStore(),
  secret=process.env.SUPPORT_SESSION_SECRET, now=()=>Date.now()
}={}) {
  const enabled=typeof secret==='string' && secret.length>=32;
  const sign=value=>createHmac('sha256',secret).update(value).digest();
  function issueTicketSession({ticketId,email}) {
    if(!enabled)throw fail(503,'support_identity_unavailable');
    if(!UUID.test(ticketId||'') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm(email)))
      throw fail(400,'invalid_ticket_identity');
    const issued=now();
    const claims={v:1,ticketId,email:norm(email),iat:issued,exp:issued+SESSION_MS,
      nonce:randomBytes(12).toString('base64url')};
    const payload=Buffer.from(JSON.stringify(claims)).toString('base64url');
    const unsigned='mgst1.'+payload;
    return {accessToken:unsigned+'.'+sign(unsigned).toString('base64url'),
      expiresAt:new Date(claims.exp).toISOString(),ticketId};
  }
  function linkActor(token) {
    if(!enabled)throw fail(503,'support_identity_unavailable');
    if(typeof token!=='string'||token.length>1400)throw fail(401,'unauthorized');
    const parts=token.split('.');
    if(parts.length!==3||parts[0]!=='mgst1'||!/^[A-Za-z0-9_-]+$/.test(parts[1])||
       !/^[A-Za-z0-9_-]{43}$/.test(parts[2]))throw fail(401,'unauthorized');
    const actual=Buffer.from(parts[2],'base64url');
    const expected=sign('mgst1.'+parts[1]);
    if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw fail(401,'unauthorized');
    let claims;
    try{claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));}catch{throw fail(401,'unauthorized');}
    const current=now();
    if(claims?.v!==1||!UUID.test(claims.ticketId||'')||
       !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm(claims.email))||
       claims.email!==norm(claims.email)||!Number.isSafeInteger(claims.iat)||
       !Number.isSafeInteger(claims.exp)||claims.iat>current||claims.exp<=current||
       claims.exp-claims.iat!==SESSION_MS)throw fail(401,'unauthorized');
    return {verified:true,method:'email-link',ticketId:claims.ticketId,email:claims.email};
  }
  async function accountActor(token) {
    if(!auth.enabled||!accounts.enabled)throw fail(503,'account_login_unavailable');
    if(typeof token!=='string'||token.length>16000||token.length<20)throw fail(401,'unauthorized');
    let profile;
    try{profile=auth.session({sessionToken:token});}
    catch{throw fail(401,'unauthorized');}
    const email=norm(profile?.email);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw fail(401,'unauthorized');
    // A self-contained legacy session alone is not proof the persistent account still exists.
    const account=await accounts.findByEmail(email);
    if(!account||!UUID.test(account.id||'')||norm(account.email)!==email)throw fail(401,'unauthorized');
    return {verified:true,method:'account',email,accountId:account.id};
  }
  return {enabled,issueTicketSession,linkActor,accountActor};
}
