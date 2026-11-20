// Server-only Supabase PostgREST adapter. Never import into browser bundles.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (status, code) => Object.assign(new Error(code), {status, code});
const validEmail = input => typeof input === 'string' && input.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input) && input === input.toLowerCase();

export function createSupportStore({
  url=process.env.SUPABASE_URL,
  key=process.env.SUPABASE_SERVICE_ROLE_KEY,
  fetchImpl=fetch
}={}) {
  let origin;
  try {
    const u=new URL(String(url||''));
    if (u.protocol==='https:' && /^[a-z0-9-]+\.supabase\.co$/.test(u.hostname) &&
      !u.username && !u.password && !u.port && u.pathname==='/') origin=u.origin;
  } catch {}
  const enabled=!!origin && typeof key==='string' && key.length>20;
  async function request(path,{method='GET',body}={}) {
    if(!enabled) throw fail(503,'support_store_unavailable');
    let response;
    try {
      response=await fetchImpl(origin+path,{method,redirect:'error',cache:'no-store',
        headers:{'apikey':key,'authorization':`Bearer ${key}`,'accept':'application/json',
          'content-type':'application/json',...(method==='POST'?{'prefer':'return=representation'}:{})},
        body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
    } catch {throw fail(503,'support_store_unavailable');}
    const text=await response.text().catch(()=>'');
    if (Buffer.byteLength(text)>128*1024) throw fail(502,'support_store_invalid_response');
    let parsed=null;
    if(text){try{parsed=JSON.parse(text);}catch{throw fail(502,'support_store_invalid_response');}}
    if(!response.ok) {
      // Transactional RPCs report conflicts with P0001. Do not expose DB messages.
      if(response.status===409 || parsed?.code==='P0001') throw fail(409,'support_conflict');
      throw fail(503,'support_store_unavailable');
    }
    return parsed;
  }
  const rpc=(name,values)=>request('/rest/v1/rpc/'+name,{method:'POST',body:values});
  async function ticket(ticketId) {
    if(!UUID.test(ticketId||'')) return null;
    const rows=await request('/rest/v1/support_tickets?id=eq.'+ticketId+
      '&select=id,owner_email,kind,subject,status,revision,created_at,updated_at,closed_at,attachments_delete_at,closed_by,close_reason&limit=1');
    if(!Array.isArray(rows)) throw fail(502,'support_store_invalid_response');
    return rows[0]||null;
  }
  return {
    enabled, ticket,
    async listByEmail(address){
      if(!validEmail(address)) throw fail(400,'invalid_email');
      const rows=await request('/rest/v1/support_tickets?owner_email=eq.'+encodeURIComponent(address)+
        '&select=id,kind,subject,status,revision,created_at,updated_at,closed_at&order=created_at.desc&limit=30');
      if(!Array.isArray(rows)) throw fail(502,'support_store_invalid_response');
      return rows;
    },
    async messages(ticketId){
      if(!UUID.test(ticketId||'')) throw fail(400,'invalid_ticket');
      const rows=await request('/rest/v1/support_messages?ticket_id=eq.'+ticketId+
        '&select=id,author_kind,content,created_at&order=created_at.asc&limit=50');
      if(!Array.isArray(rows)) throw fail(502,'support_store_invalid_response');
      return rows;
    },
    async takeRate(hash,limit,seconds){
      return (await rpc('support_take_rate',{p_key:hash,p_limit:limit,p_seconds:seconds}))===true;
    },
    async create({email,accountId,kind,subject,message}){
      if(!validEmail(email)) throw fail(400,'invalid_email');
      const id=await rpc('support_create_ticket',{p_email:email,p_account_id:accountId||null,
        p_kind:kind,p_subject:subject,p_message:message});
      if(!UUID.test(id||'')) throw fail(502,'support_store_invalid_response');
      return id;
    },
    async putLink(record){
      if(!UUID.test(record.ticketId||'')) throw fail(400,'invalid_ticket');
      await request('/rest/v1/support_access_links',{method:'POST',body:{
        ticket_id:record.ticketId,email:record.email,token_hash:record.tokenHash,
        expires_at:record.expiresAt,created_at:record.createdAt
      }});
    },
    redeem:(ticketId,tokenHash)=>rpc('support_redeem_link',{p_ticket_id:ticketId,p_token_hash:tokenHash}),
    append:(ticketId,revision,content)=>rpc('support_append_message',{
      p_ticket_id:ticketId,p_expected_revision:revision,p_content:content
    }),
    close:(ticketId,revision,reason)=>rpc('support_close_ticket',{
      p_ticket_id:ticketId,p_expected_revision:revision,p_actor:'reporter',p_reason:reason||null
    }),
    reopen:(ticketId,revision)=>rpc('support_reopen_ticket',{
      p_ticket_id:ticketId,p_expected_revision:revision
    })
  };
}
