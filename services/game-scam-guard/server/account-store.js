const fields='id,email,username,first_name,last_name,birth_date,password_hash,created_at';
const error=(status,message)=>Object.assign(new Error(message),{status});
const normalizeUrl=value=>{try{const url=new URL(String(value||''));return url.protocol==='https:'&&url.hostname.endsWith('.supabase.co')?url.origin:null;}catch{return null;}};
const normalizeRow=row=>row&&typeof row==='object'?{id:row.id,email:row.email,username:row.username,firstName:row.first_name,lastName:row.last_name,birthDate:row.birth_date,passwordHash:row.password_hash,createdAt:row.created_at}:null;

export function createAccountStore({url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,fetchImpl=fetch}={}){
  const origin=normalizeUrl(url),enabled=!!origin&&typeof key==='string'&&key.length>20;
  async function request(path,{method='GET',body,prefer}={}){
    if(!enabled)throw error(503,'ذخیره‌سازی حساب هنوز آماده نشده است.');
    let response;try{response=await fetchImpl(origin+path,{method,headers:{apikey:key,authorization:`Bearer ${key}`,accept:'application/json','content-type':'application/json',...(prefer?{prefer}:{})},body:body?JSON.stringify(body):undefined});}catch{throw error(503,'ارتباط با ذخیره‌سازی حساب کامل نشد.');}
    const data=await response.json().catch(()=>null);if(!response.ok)throw error(response.status===409?409:503,response.status===409?'این ایمیل یا نام کاربری پیش‌تر استفاده شده است.':'ذخیره‌سازی حساب در دسترس نیست.');return data;
  }
  async function findBy(field,value){const rows=await request(`/rest/v1/guard_accounts?${field}=eq.${encodeURIComponent(value)}&select=${fields}&limit=1`);return Array.isArray(rows)&&rows[0]?normalizeRow(rows[0]):null;}
  return {enabled,status:{hasUrl:!!origin,hasServiceKey:typeof key==='string'&&key.length>20},findByEmail:email=>findBy('email',email),findByUsername:username=>findBy('username',username),async create(profile){const rows=await request('/rest/v1/guard_accounts',{method:'POST',prefer:'return=representation',body:{email:profile.email,username:profile.username,first_name:profile.firstName,last_name:profile.lastName,birth_date:profile.birthDate,password_hash:profile.passwordHash}});return normalizeRow(Array.isArray(rows)?rows[0]:null);}};
}
