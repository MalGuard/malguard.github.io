// Email delivery and bot protection for public ticket links. Server only.
const fail=(status,code)=>Object.assign(new Error(code),{status,code});
const normalized=value=>typeof value==='string'?value.trim().toLowerCase():'';
const validEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized(value)) && normalized(value).length<=254;
const HOSTS=new Set(['malguard.site','www.malguard.site']);

export function createSupportMailer({
  apiKey=process.env.BREVO_API_KEY,
  fromEmail=process.env.SUPPORT_FROM_EMAIL,
  publicUrl=process.env.SUPPORT_PUBLIC_URL,
  fetchImpl=fetch
}={}) {
  let landing;
  try{
    const parsed=new URL(String(publicUrl||''));
    if(parsed.protocol==='https:'&&HOSTS.has(parsed.hostname)&&
      parsed.pathname==='/support-ticket.html'&&!parsed.search&&!parsed.hash)landing=parsed;
  }catch{}
  const enabled=typeof apiKey==='string'&&apiKey.length>20&&validEmail(fromEmail)&&!!landing;
  async function sendTicketLink({email,ticketId,token}) {
    if(!enabled)throw fail(503,'support_mail_unavailable');
    if(!validEmail(email)||typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token)||
       !/^[0-9a-f-]{36}$/i.test(ticketId||''))throw fail(400,'invalid_link_request');
    const url=new URL(landing.href);
    url.hash=new URLSearchParams({ticket:ticketId,token}).toString();
    const message='Access your MalGuard Support ticket:\n'+url.href+
      '\n\nThis link expires in 15 minutes and can be used once. '+
      'If you did not request it, ignore this email. Never forward this link.';
    let response;
    try{
      response=await fetchImpl('https://api.brevo.com/v3/smtp/email',{
        method:'POST',redirect:'error',cache:'no-store',
        headers:{'api-key':apiKey,'content-type':'application/json','accept':'application/json'},
        body:JSON.stringify({
          sender:{name:'MalGuard Support',email:normalized(fromEmail)},
          to:[{email:normalized(email)}],subject:'MalGuard Support: ticket access',
          textContent:message
        }),signal:AbortSignal.timeout(10000)
      });
    }catch{throw fail(503,'support_mail_unavailable');}
    if(!response.ok)throw fail(503,'support_mail_unavailable');
    return true; // Provider accepted message; this is not proof of delivery.
  }
  async function sendAdminCode({email,code}) {
    if(!enabled)throw fail(503,'support_mail_unavailable');
    if(!validEmail(email)||typeof code!=='string'||!/^[0-9]{8}$/.test(code))
      throw fail(400,'invalid_admin_code_delivery');
    let response;
    try{
      response=await fetchImpl('https://api.brevo.com/v3/smtp/email',{
        method:'POST',redirect:'error',cache:'no-store',
        headers:{'api-key':apiKey,'content-type':'application/json','accept':'application/json'},
        body:JSON.stringify({
          sender:{name:'MalGuard Support',email:normalized(fromEmail)},
          to:[{email:normalized(email)}],
          subject:'MalGuard Support: owner verification',
          textContent:'MalGuard Support owner verification code: '+code+
            '\\nExpires in 10 minutes. Do not share it. If you did not request it, ignore this email.'
        }),signal:AbortSignal.timeout(10000)
      });
    }catch{throw fail(503,'support_mail_unavailable');}
    if(!response.ok)throw fail(503,'support_mail_unavailable');
    return true;
  }
  async function notifyExpert({ticketId}){
    if(!enabled)throw fail(503,'support_mail_unavailable');
    if(typeof ticketId!=='string'||!/^[a-f0-9-]{36}$/i.test(ticketId))
      throw fail(400,'invalid_ticket');
    let response;
    try{
      response=await fetchImpl('https://api.brevo.com/v3/smtp/email',{
        method:'POST',redirect:'error',cache:'no-store',
        headers:{'api-key':apiKey,'content-type':'application/json','accept':'application/json'},
        body:JSON.stringify({
          sender:{name:'MalGuard Support',email:normalized(fromEmail)},
          to:[{email:'contact@malguard.site'}],
          subject:'MalGuard Support: human ticket queued',
          textContent:'A support ticket needs expert attention. Ticket ID: '+ticketId+
            '\\nOpen the authenticated MalGuard Support admin panel to review it. '+
            'Do not request passwords or other secrets.'
        }),signal:AbortSignal.timeout(10000)
      });
    }catch{throw fail(503,'support_mail_unavailable');}
    if(!response.ok)throw fail(503,'support_mail_unavailable');
    return true;
  }
  return {enabled,sendTicketLink,sendAdminCode,notifyExpert};
}

export function createChallengeVerifier({
  secret=process.env.SUPPORT_TURNSTILE_SECRET,
  fetchImpl=fetch
}={}) {
  const enabled=typeof secret==='string'&&secret.length>20;
  return {
    enabled,
    async verify(token,action){
      if(!enabled)throw fail(503,'support_challenge_unavailable');
      if(typeof token!=='string'||token.length<10||token.length>2048)return false;
      if(!['support_create','support_request_link'].includes(action))return false;
      let response;
      try{
        response=await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
          method:'POST',redirect:'error',cache:'no-store',
          headers:{'content-type':'application/x-www-form-urlencoded'},
          body:new URLSearchParams({secret,response:token}).toString(),
          signal:AbortSignal.timeout(8000)
        });
      }catch{throw fail(503,'support_challenge_unavailable');}
      if(!response.ok)throw fail(503,'support_challenge_unavailable');
      const data=await response.json().catch(()=>null);
      return data?.success===true&&data.action===action&&HOSTS.has(data.hostname);
    }
  };
}
