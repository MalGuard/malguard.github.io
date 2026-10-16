import {createCipheriv,createDecipheriv,createHash,randomBytes,timingSafeEqual} from 'node:crypto';

const CODE_TTL_MS=10*60*1000,SESSION_TTL_MS=30*24*60*60*1000;
const email=value=>typeof value==='string'&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)?value.trim().toLowerCase():null;
const username=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{3,32}$/.test(value)?value:null;
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const decode=value=>JSON.parse(Buffer.from(value,'base64url').toString('utf8'));

export function createEmailAuth({apiKey=process.env.BREVO_API_KEY,fromEmail=process.env.AUTH_FROM_EMAIL,fetchImpl=fetch,now=()=>Date.now()}={}) {
  const hasApiKey=typeof apiKey==='string'&&apiKey.length>20,hasFromEmail=!!email(fromEmail);
  const enabled=hasApiKey&&hasFromEmail;
  const key=enabled?createHash('sha256').update(`gamescam-email-auth-v1\0${apiKey}`).digest():null;
  const attempts=new Map();
  const seal=payload=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);const body=Buffer.concat([cipher.update(JSON.stringify(payload),'utf8'),cipher.final()]);return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${body.toString('base64url')}`;};
  const open=token=>{try{const [iv,tag,body]=String(token||'').split('.');if(!iv||!tag||!body)return null;const cipher=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64url'));cipher.setAuthTag(Buffer.from(tag,'base64url'));return JSON.parse(Buffer.concat([cipher.update(Buffer.from(body,'base64url')),cipher.final()]).toString('utf8'));}catch{return null;}};
  const error=(status,message)=>Object.assign(new Error(message),{status});
  async function start({emailAddress,name,ip=''}) {
    if(!enabled)throw error(503,'ارسال کد ایمیل هنوز آماده نشده است.');
    const address=email(emailAddress),profile=name===undefined?null:username(name);if(!address||name!==undefined&&!profile)throw error(400,'ایمیل یا نام کاربری معتبر نیست.');
    const rateKey=`${ip}|${address}`,entry=attempts.get(rateKey),time=now();if(entry&&entry.until>time&&entry.count>=3)throw error(429,'تعداد درخواست کد زیاد است؛ چند دقیقه دیگر تلاش کنید.');
    attempts.set(rateKey,{count:(entry?.until>time?entry.count:0)+1,until:time+15*60*1000});for(const [key,item]of attempts)if(item.until<time)attempts.delete(key);
    const code=String(Math.floor(100000+Math.random()*900000));
    const response=await fetchImpl('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':apiKey,'content-type':'application/json','accept':'application/json'},body:JSON.stringify({sender:{name:'GameScam Guard',email:fromEmail},to:[{email:address}],subject:'Your GameScam Guard verification code',htmlContent:`<p>Your GameScam Guard verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes.</p>`})});
    if(!response.ok)throw error(502,'ارسال کد ایمیل ممکن نشد؛ کمی بعد دوباره تلاش کنید.');
    return {verificationToken:seal({type:'code',email:address,name:profile,code:encode(code),expiresAt:time+CODE_TTL_MS})};
  }
  function verify({verificationToken,code}) {if(!enabled)throw error(503,'ارسال کد ایمیل هنوز آماده نشده است.');const payload=open(verificationToken);if(!payload||payload.type!=='code'||payload.expiresAt<now()||!/^\d{6}$/.test(String(code)))throw error(400,'کد تأیید نامعتبر یا منقضی شده است.');const expected=Buffer.from(payload.code),actual=Buffer.from(encode(String(code)));if(expected.length!==actual.length||!timingSafeEqual(expected,actual))throw error(400,'کد تأیید نامعتبر یا منقضی شده است.');return {sessionToken:seal({type:'session',email:payload.email,name:payload.name||payload.email.split('@')[0],expiresAt:now()+SESSION_TTL_MS})};}
  function session({sessionToken}) {if(!enabled)throw error(503,'سرویس حساب هنوز آماده نشده است.');const payload=open(sessionToken);if(!payload||payload.type!=='session'||payload.expiresAt<now())throw error(401,'نشست حساب معتبر نیست.');return {email:payload.email,username:payload.name,expiresAt:payload.expiresAt};}
  return {enabled:!!enabled,status:{hasApiKey,hasFromEmail},start,verify,session};
}
