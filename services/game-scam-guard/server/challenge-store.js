const unavailable=()=>Object.assign(new Error('Shared authentication protection is unavailable.'),{status:503});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createChallengeStore({url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,fetchImpl=fetch}={}){
 let origin;try{const p=new URL(String(url||'').trim());if(p.protocol==='https:'&&/^[a-z0-9-]+\.supabase\.co$/.test(p.hostname)&&!p.username&&!p.password)origin=p.origin;}catch{}
 const enabled=!!origin&&typeof key==='string'&&key.length>20;
 async function rpc(name,body){
  if(!enabled)throw unavailable();
  try{const response=await fetchImpl(`${origin}/rest/v1/rpc/${name}`,{method:'POST',redirect:'error',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
   if(!response.ok||Number(response.headers.get('content-length'))>16384)throw unavailable();const raw=await response.text();if(raw.length>16384)throw unavailable();const value=JSON.parse(raw);if(typeof value!=='boolean')throw unavailable();return value;
  }catch{throw unavailable();}
 }
 return {enabled,async issue({id,subject}){if(!uuid.test(id)||!/^[a-f0-9]{64}$/.test(subject))throw unavailable();return rpc('guard_issue_email_challenge',{p_id:id,p_subject:subject});},async attempt({id,matched}){if(!uuid.test(id)||typeof matched!=='boolean')throw unavailable();return rpc('guard_attempt_email_challenge',{p_id:id,p_matched:matched});}};
}
