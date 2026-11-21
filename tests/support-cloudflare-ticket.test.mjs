import test from 'node:test';
import assert from 'node:assert/strict';
import {handleSupport} from '../services/support/cloudflare/ticket-api.mjs';

const A='a'.repeat(44),B='b'.repeat(44);
const envFor=()=> {
 const tickets=new Map(),messages=[],rates=new Map();
 function statement(sql,params=[]){
  return {
   bind(...args){return statement(sql,args);},
   async run(){
    if(sql.startsWith('INSERT INTO support_rate_limits')){const value=rates.get(params[0])||0;rates.set(params[0],value+1);return {success:true};}
    if(sql.startsWith('INSERT INTO support_tickets')){const [id,owner_email,kind,routing,subject,created_at,updated_at]=params;
      tickets.set(id,{id,owner_email,kind,routing,subject,created_at,updated_at,revision:0,status:'open',closed_at:null,attachments_delete_at:null});return {success:true};}
    if(sql.startsWith('INSERT INTO support_messages')){const [id,ticket_id,author_kind,content,created_at]=params;
      messages.push({id,ticket_id,author_kind,content,created_at});return {success:true};}
    throw Error('unimplemented run: '+sql);
   },
   async first(){
    if(sql.startsWith('SELECT hits FROM support_rate_limits'))return {hits:rates.get(params[0])||0};
    if(sql.startsWith('SELECT * FROM support_tickets WHERE id=')){
      const ticket=tickets.get(params[0]);return ticket?.owner_email===params[1]?{...ticket}:null;
    }
    if(sql.startsWith('SELECT content FROM support_messages'))return [...messages].reverse().find(x=>x.ticket_id===params[0])||null;
    if(sql.startsWith('UPDATE support_tickets')) {
      const id=params.find(x=>typeof x==='string'&&tickets.has(x)),t=tickets.get(id);
      if(!t||t.owner_email!==params[params.length-2]||t.revision!==params[params.length-1])return null;
      if(sql.includes("SET status='open'")&&sql.includes('closed_at=NULL')){
        if(t.status!=='closed')return null;t.status='open';t.closed_at=null;t.attachments_delete_at=null;t.updated_at=params[0];}
      else if(sql.includes("SET status='closed'")){if(t.status!=='open')return null;t.status='closed';
        t.closed_at=params[0];t.attachments_delete_at=params[1];t.updated_at=params[2];}
      else{if(t.status!=='open')return null;t.updated_at=params[0];}
      t.revision++;return sql.includes('RETURNING *')?{...t}:{revision:t.revision};
    }
    throw Error('unimplemented first: '+sql);
   },
   async all(){
    if(sql.startsWith('SELECT * FROM support_tickets WHERE owner_email'))return {
      results:[...tickets.values()].filter(x=>x.owner_email===params[0]).map(x=>({...x}))
    };
    if(sql.startsWith('SELECT id,author_kind,content,created_at FROM support_messages'))
      return {results:messages.filter(x=>x.ticket_id===params[0]).slice().reverse()};
    throw Error('unimplemented all: '+sql);
   }
  };
 }
 const db={prepare(sql){return statement(sql);},async batch(items){
   for(const item of items)await item.run();
   return [{success:true},{success:true}];
 }};
 return {db,tickets,messages,rates};
};
function request(endpoint,body={},token=A){
 return {endpoint,request:new Request('https://support-preview.malguard.site/api/support/'+endpoint,{
  method:'POST',headers:{'content-type':'application/json',
   ...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)})
 };
}
test('D1 tickets only expose the verified reporter’s records; no guest writes',async()=>{
 const savedFetch=globalThis.fetch;
 globalThis.fetch=async (_url,options)=>{
  const auth=JSON.parse(options.body);
  return {ok:true,status:200,text:async()=>JSON.stringify({
    email:auth.sessionToken===B?'other@example.test':'owner@example.test',
    expiresAt:Date.now()+600000
  })};
 };
 try{
  const store=envFor(),env={SUPPORT_DB:store.db,SUPPORT_TICKETS_ENABLED:'true'};
  const call=async(endpoint,body,token)=>{
    const value=request(endpoint,body,token);
    const response=await handleSupport({request:value.request,env},value.endpoint);
    return {status:response.status,body:await response.json()};
  };
  const missing=await call('create',{kind:'bug',route:'agent',subject:'Scanner',message:'Scanner crashed on load'},null);
  assert.equal(missing.status,401);
  const created=await call('create',{kind:'bug',route:'agent',subject:'Scanner',message:'Scanner crashed on load'},A);
  assert.equal(created.status,200);
  const id=created.body.ticketId;
  assert.match(id,/^[a-f0-9-]{36}$/);
  assert.equal(store.tickets.get(id).owner_email,'owner@example.test');
  assert.equal((await call('list',{},A)).body.tickets.length,1);
  assert.equal((await call('list',{},B)).body.tickets.length,0);
  assert.equal((await call('ticket',{ticketId:id},B)).status,404);
  assert.equal((await call('message',{ticketId:id,message:'foreign'},B)).status,404);
  const reply=await call('message',{ticketId:id,message:'It reproduces on Windows 11'},A);
  assert.equal(reply.status,200);
  const ticket=await call('ticket',{ticketId:id},A);
  assert.equal(ticket.body.messages.length,2);
  const closure=await call('close',{ticketId:id},A);
  assert.equal(closure.status,200);
  assert.equal((await call('message',{ticketId:id,message:'after closure'},A)).status,409);
  assert.equal((await call('reopen',{ticketId:id},A)).status,200);
  assert.equal(store.tickets.get(id).status,'open');
 }finally{globalThis.fetch=savedFetch;}
});
test('guest magic-link and admin endpoints stay disabled until separately verified',async()=>{
 const store=envFor(),env={SUPPORT_DB:store.db,SUPPORT_TICKETS_ENABLED:'true'};
 const req=request('request-link',{ticketId:'invalid'});
 const resp=await handleSupport({request:req.request,env},'request-link');
 assert.equal(resp.status,503);
 assert.equal((await resp.json()).error,'feature_not_configured');
});

test('email OTP uses the existing provider and never stores passwords or codes',async()=>{
 const savedFetch=globalThis.fetch,store=envFor(),env={SUPPORT_DB:store.db,SUPPORT_TICKETS_ENABLED:'true'};
 const calls=[];
 globalThis.fetch=async (url,options)=>{
   calls.push({url,body:JSON.parse(options.body||'{}')});
   if(String(url).endsWith('/auth/start'))return {ok:true,text:async()=>JSON.stringify({
     verificationToken:'synthetic-verification-token-xxxxxxxxxxxxxxxx'
   })};
   if(String(url).endsWith('/auth/verify'))return {ok:true,text:async()=>JSON.stringify({
     sessionToken:'synthetic-session-token-xxxxxxxxxxxxxxxxxx'
   })};
   return {ok:false,status:404,text:async()=>''};
 };
 try{
   const start=request('auth/start',{email:'guest@example.test'},null);
   const first=await handleSupport({request:start.request,env},'auth/start');
   assert.equal(first.status,200);
   assert.equal((await first.json()).verificationToken.startsWith('synthetic-verification-token'),true);
   const verify=request('auth/verify',{verificationToken:'synthetic-verification-token-xxxxxxxxxxxxxxxx',code:'123456'},null);
   const second=await handleSupport({request:verify.request,env},'auth/verify');
   assert.equal(second.status,200);
   assert.equal((await second.json()).sessionToken.startsWith('synthetic-session-token'),true);
   assert.equal(calls.length,2);
   assert.deepEqual(calls.map(c=>new URL(c.url).pathname.split('/').pop()),['start','verify']);
   assert.equal(store.tickets.size,0);
 }finally{globalThis.fetch=savedFetch;}
});
