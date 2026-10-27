import {readFile} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {createEmailAuth} from '../../services/game-scam-guard/server/email-auth.js';
import {createChallengeStore} from '../../services/game-scam-guard/server/challenge-store.js';
import {createLibrary} from '../../services/game-scam-guard/server/ai-library.js';
const require=createRequire(import.meta.url);
export async function createLocalLab(){
 const {PGlite}=require(process.env.MALGUARD_TEST_PGLITE||'@electric-sql/pglite'),db=new PGlite();
 await db.exec('create role anon; create role authenticated; create role service_role;');
 await db.exec(await readFile(new URL('../../services/game-scam-guard/supabase/email_challenges.sql',import.meta.url),'utf8'));
 await db.exec('create table staging_objects(path text primary key,data jsonb not null);');
 const key=randomBytes(32).toString('hex'),inbox=new Map();let runs=0,active=false;
 const query=async(sql,args)=>(await db.query(sql,args)).rows[0]?.value;
 const rpc=async(url,options)=>{
  const name=new URL(url).pathname.split('/').at(-1),p=JSON.parse(options.body);
  if(name==='guard_issue_email_challenge')return Response.json(await query('select public.guard_issue_email_challenge($1,$2) as value',[p.p_id,p.p_subject]));
  if(name==='guard_attempt_email_challenge')return Response.json(await query('select public.guard_attempt_email_challenge($1,$2) as value',[p.p_id,p.p_matched]));
  return Response.json({error:'not_found'},{status:404});
 };
 const mail=async(_url,options)=>{const body=JSON.parse(options.body);inbox.set(body.to[0].email,body.htmlContent.match(/>(\d{6})</)[1]);return {ok:true};};
 const store=()=>createChallengeStore({url:'https://synthetic.supabase.co',key,fetchImpl:rpc});
 const auth=()=>createEmailAuth({apiKey:key,fromEmail:'guard@example.test',accountStore:{enabled:false,status:{}},challengeStore:store(),fetchImpl:mail});
 const first=auth(),second=auth();
 const storage=async(url,options)=>{
  const path=new URL(url).pathname;
  if(path==='/storage/v1/bucket/malguard-ai-library-v1')return Response.json({public:false});
  if(!/^\/storage\/v1\/object\/malguard-ai-library-v1\/[a-f0-9]{64}\/library\.json$/.test(path))return Response.json({error:'not_found'},{status:404});
  if(options.method==='POST'){await db.query('insert into staging_objects(path,data) values($1,$2::jsonb) on conflict(path) do update set data=excluded.data',[path,options.body]);return Response.json({saved:true});}
  const rows=(await db.query('select data from staging_objects where path=$1',[path])).rows;return rows.length?Response.json(rows[0].data):Response.json({statusCode:404},{status:404});
 };
 const library=createLibrary({auth:first,url:'https://synthetic.supabase.co',key,fetchImpl:storage});
 const signIn=async(address)=>{const challenge=await first.start({emailAddress:address});return first.verify({...challenge,code:inbox.get(address)});};
 return {async runChecks(){
  if(active)throw Object.assign(Error('lab_busy'),{status:409});if(runs>=10)throw Object.assign(Error('lab_budget_exhausted'),{status:429});active=true;runs++;
  try{
   const suffix=randomUUID().slice(0,8),checks=[],address=`guess-${suffix}@example.test`;
   const challenge=await first.start({emailAddress:address});for(let i=0;i<5;i++)await (i%2?first:second).verify({...challenge,code:'000000'}).catch(()=>{});
   let blocked=false;try{await second.verify({...challenge,code:inbox.get(address)});}catch(error){blocked=error.status===400;}checks.push({name:'shared_attempt_budget',passed:blocked});
   const concurrentAddress=`single-${suffix}@example.test`,single=await first.start({emailAddress:concurrentAddress});
   const results=await Promise.allSettled([first.verify({...single,code:inbox.get(concurrentAddress)}),second.verify({...single,code:inbox.get(concurrentAddress)})]);checks.push({name:'single_use_across_instances',passed:results.filter(r=>r.status==='fulfilled').length===1});
   const a=await signIn(`a-${suffix}@example.test`),b=await signIn(`b-${suffix}@example.test`);
   await library(a.sessionToken,{chats:[{id:'synthetic-chat',title:'Synthetic staging chat',mode:'chat',updatedAt:Date.now(),archived:false,messages:[{role:'user',text:'Harmless staging fixture'}]}],notes:['Synthetic staging note']});
   const own=await library(a.sessionToken),other=await library(b.sessionToken);checks.push({name:'account_library_isolation',passed:own.chats.length===1&&other.chats.length===0});
   const permission=await query("select has_function_privilege('anon','public.guard_attempt_email_challenge(uuid,boolean)','EXECUTE') as value",[]);checks.push({name:'public_rpc_denied',passed:permission===false});
   return {mode:'synthetic_local_postgresql',storage:'simulated_supabase_storage',passed:checks.every(c=>c.passed),checks,runs,maxRuns:10};
  }finally{active=false;inbox.clear();}
 },close:()=>db.close()};
}
