import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSupportHandler} from '../services/support/server/support-http.mjs';

const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ID_A='11111111-1111-4111-8111-111111111111';
const ID_B='22222222-2222-4222-8222-222222222222';
const stamp=Date.parse('2026-11-20T08:00:00.000Z');
function makeFixture({enabled=true}={}) {
  let current=stamp, mailFailure=false, rateAllowed=true;
  const tickets=new Map(), messages=new Map(), storedLinks=[],sent=[];
  const makeTicket=(id,email)=>({id,owner_email:email,kind:'bug',subject:'Scanner problem',
    status:'open',revision:0,created_at:new Date(stamp).toISOString(),
    updated_at:new Date(stamp).toISOString(),closed_at:null,attachments_delete_at:null});
  tickets.set(A,makeTicket(A,'one@example.test'));
  tickets.set(B,makeTicket(B,'two@example.test'));
  const store={enabled:true,
    async ticket(id){return tickets.has(id)?{...tickets.get(id)}:null;},
    async listByEmail(email){return [...tickets.values()].filter(t=>t.owner_email===email);},
    async messages(id){return messages.get(id)||[];},
    async takeRate(){return rateAllowed;},
    async create({email,kind,subject,message}){
      const id=ID_A;tickets.set(id,{...makeTicket(id,email),kind,subject});
      messages.set(id,[{author_kind:'reporter',content:message}]);return id;
    },
    async putLink(record){storedLinks.push({...record});},
    async redeem(ticketId,hash){
      const found=storedLinks.find(x=>x.ticketId===ticketId&&x.tokenHash===hash&&!x.consumedAt);
      if(!found)return null;
      found.consumedAt=new Date(current).toISOString();
      return {ticketId,email:found.email};
    },
    async append(id,revision,content){
      const row=tickets.get(id);
      if(row.revision!==revision||row.status==='closed')throw Object.assign(new Error('conflict'),{status:409,code:'support_conflict'});
      row.revision++;messages.set(id,[...(messages.get(id)||[]),{content,author_kind:'reporter'}]);
      return {revision:row.revision};
    },
    async close(id,revision){
      const row=tickets.get(id);if(row.revision!==revision)throw Error('stale');
      row.status='closed';row.revision++;row.closed_at=new Date(current).toISOString();
      row.attachments_delete_at=new Date(current+30*86400000).toISOString();
      return {...row};
    },
    async reopen(id,revision){
      const row=tickets.get(id);if(row.revision!==revision)throw Error('stale');
      row.status='open';row.revision++;row.closed_at=null;row.attachments_delete_at=null;
      return {...row};
    }
  };
  const identity={enabled:true,
    accountActor:async token=>{
      if(token==='account-a')return {verified:true,method:'account',email:'one@example.test',accountId:ID_A};
      if(token==='account-b')return {verified:true,method:'account',email:'two@example.test',accountId:ID_B};
      throw Object.assign(new Error('unauthorized'),{status:401,code:'unauthorized'});
    },
    linkActor:token=>token==='mgst1.fake-a'
      ?{verified:true,method:'email-link',email:'one@example.test',ticketId:A}
      :{verified:true,method:'email-link',email:'two@example.test',ticketId:B},
    issueTicketSession:({ticketId,email})=>({accessToken:'ticket-session',ticketId,email})
  };
  const mailer={enabled:true,async sendTicketLink(payload){
    if(mailFailure)throw Error('provider_down');
    sent.push(payload);return true;
  }};
  const challenge={enabled:true,verify:async(token,action)=>token==='valid-challenge'&&
    ['support_create','support_request_link'].includes(action)};
  const handler=createSupportHandler({store,identity,mailer,challenge,enabled,rateSecret:'x'.repeat(48),publicSiteKey:'synthetic-site-key',now:()=>current});
  async function request(endpoint,body={},token,origin='https://malguard.site'){
    const req={method:endpoint==='status'?'GET':'POST',query:{endpoint},headers:{
      origin,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body};
    const res={statusCode:200,headers:{},setHeader(name,value){this.headers[name]=value;},
      end(value){this.body=value?JSON.parse(value):null;}};
    await handler(req,res);return res;
  }
  return {request,store,tickets,storedLinks,sent,
    clock(v){current=v;}, mailFails(){mailFailure=true;},denyRates(){rateAllowed=false;}};
}

test('feature flag disables all user operations and keeps status truthful',async()=>{
  const f=makeFixture({enabled:false});
  assert.equal((await f.request('status')).body.enabled,false);
  assert.equal((await f.request('ticket',{ticketId:A},'account-a')).statusCode,503);
});

test('account ownership prevents cross-user reading, messaging, closure and listing',async()=>{
  const f=makeFixture();
  assert.equal((await f.request('ticket',{ticketId:B,role:'support-admin'},'account-a')).statusCode,404);
  assert.equal((await f.request('message',{ticketId:B,message:'attack',role:'admin'},'account-a')).statusCode,404);
  assert.equal((await f.request('close',{ticketId:B,reason:'spoof',role:'admin'},'account-a')).statusCode,404);
  const list=await f.request('list',{},'account-a');
  assert.equal(list.statusCode,200);
  assert.equal(list.body.tickets.length,1);
  assert.equal(list.body.tickets[0].id,A);
  assert.equal((await f.request('ticket',{ticketId:A},'account-b')).statusCode,404);
  assert.equal((await f.request('ticket',{ticketId:A},'no-such-session')).statusCode,401);
});

test('account closes and reopens only inside seven days; messages respect closed state',async()=>{
  const f=makeFixture();
  const write=await f.request('message',{ticketId:A,message:'New log output'},'account-a');
  assert.equal(write.body.saved,true);
  const closed=await f.request('close',{ticketId:A},'account-a');
  assert.equal(closed.statusCode,200);
  assert.equal(closed.body.ticket.status,'closed');
  assert.equal((await f.request('message',{ticketId:A,message:'Again'},'account-a')).statusCode,409);
  f.clock(stamp+7*86400000);
  assert.equal((await f.request('reopen',{ticketId:A},'account-a')).statusCode,200);
  assert.equal(f.tickets.get(A).attachments_delete_at,null);
  assert.equal((await f.request('reopen',{ticketId:A},'account-a')).statusCode,409);
  assert.equal((await f.request('close',{ticketId:A},'account-a')).statusCode,200);
  f.clock(stamp+15*86400000+1);
  assert.equal((await f.request('reopen',{ticketId:A},'account-a')).statusCode,409);
});

test('email link creation/redeem is ticket-scoped and refuses replay',async()=>{
  const f=makeFixture();
  const guest=await f.request('create',{kind:'bug',route:'agent',subject:'Crashes',message:'Scanner crashes',
    email:'guest@example.test',turnstileToken:'valid-challenge'});
  assert.equal(guest.statusCode,200);
  assert.equal(guest.body.delivery,'provider_accepted');
  assert.equal(guest.body.ticketId,ID_A);
  assert.equal(f.sent.length,1);
  const {token,ticketId}=f.sent[0];
  const first=await f.request('redeem-link',{ticketId,token});
  assert.equal(first.statusCode,200);
  assert.equal(first.body.ticketId,ID_A);
  assert.equal((await f.request('redeem-link',{ticketId,token})).statusCode,401);
  assert.equal((await f.request('redeem-link',{ticketId:A,token})).statusCode,401);
  assert.notEqual(f.storedLinks[0].tokenHash,token);
  assert.equal(f.storedLinks[0].tokenHash,createHash('sha256').update(token).digest('hex'));
});

test('invalid request-link details do not disclose ticket ownership',async()=>{
  const f=makeFixture();
  const unknown=await f.request('request-link',{ticketId:A,email:'absent@example.test',
    turnstileToken:'valid-challenge'});
  const known=await f.request('request-link',{ticketId:A,email:'one@example.test',
    turnstileToken:'valid-challenge'});
  assert.deepEqual(unknown.body,known.body);
  assert.equal(f.sent.length,1);
  assert.equal((await f.request('request-link',{ticketId:A,email:'one@example.test',turnstileToken:'wrong'})).statusCode,403);
});

test('guest create is blocked without consent challenge; account creation uses verified identity',async()=>{
  const f=makeFixture();
  assert.equal((await f.request('create',{kind:'bug',route:'expert',subject:'x',message:'y',email:'visitor@example.test'})).statusCode,403);
  assert.equal((await f.request('create',{kind:'security',route:'agent',subject:'x',message:'y',turnstileToken:'valid-challenge'})).statusCode,400);
  const result=await f.request('create',{kind:'bug',route:'agent',subject:'x',message:'y',email:'one@example.test'},'account-a');
  assert.equal(result.statusCode,200);
  assert.equal(result.body.ticketId,ID_A);
  assert.equal((await f.request('create',{kind:'bug',route:'agent',subject:'x',message:'y',email:'two@example.test'},'account-a')).statusCode,400);
});

test('link sessions cannot list account tickets; invalid origins and rate limits fail closed',async()=>{
  const f=makeFixture();
  assert.equal((await f.request('list',{},'mgst1.fake-a')).statusCode,403);
  assert.equal((await f.request('ticket',{ticketId:B},'mgst1.fake-a')).statusCode,404);
  assert.equal((await f.request('ticket',{ticketId:A},'account-a','https://evil.invalid')).statusCode,403);
  f.denyRates();
  assert.equal((await f.request('message',{ticketId:A,message:'hello'},'account-a')).statusCode,429);
});
