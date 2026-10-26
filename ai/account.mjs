// Reuse the existing first-party account API. No provider keys or credentials in storage.
export function createAccount({button,locale=()=> 'en',onChange=()=>{}}){
 let profile=null,dialog,controller;
 const text=(en,fa)=>locale()==='fa'?fa:en;
 const node=(tag,value,cls)=>{const n=document.createElement(tag);if(value)n.textContent=value;if(cls)n.className=cls;return n;};
 const refresh=()=>{button.textContent=profile?.username||text('Sign in','ورود');button.ariaLabel=profile?text('Your MalGuard account','حساب مالگارد شما'):text('Sign in or create account','ورود یا ساخت حساب');};
 const close=()=>{controller?.abort();controller=undefined;if(dialog){const old=dialog;dialog=undefined;old.close();old.remove();}button.focus();};
 async function request(endpoint,body){
  if(!['status','start','verify','password','session'].includes(endpoint))throw Error('invalid_endpoint');
  const base=['malguard.site','malguard.github.io'].includes(location.hostname)?'https://game-scam-guard-connected.vercel.app':'';
  const response=await fetch(`${base}/api/game-scam-guard/auth/${endpoint}`,{method:body?'POST':'GET',credentials:'omit',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])});
  const raw=await response.text();if(raw.length>65536)throw Error('invalid_response');let data;try{data=JSON.parse(raw);}catch{throw Error('invalid_response');}
  if(!response.ok)throw Object.assign(Error('account_failed'),{status:response.status});return data;
 }
 function shell(title){
  dialog?.remove();dialog=node('dialog',null,'ai-account');dialog.dir=locale()==='fa'?'rtl':'ltr';dialog.setAttribute('aria-labelledby','account-title');
  const heading=node('h2',title);heading.id='account-title';const exit=node('button',text('Close','بستن'),'account-close');exit.type='button';exit.onclick=close;
  dialog.append(exit,heading);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});document.body.append(dialog);dialog.showModal();return dialog;
 }
 function note(container){container.append(node('p',text('Uses your existing Game Scam Guard account. Sign-in lasts on this page only; conversations and project files are not synchronized to your account. Signing out clears this page’s conversations and files; export your project first.','همان حساب Game Scam Guard است. ورود فقط در همین صفحه حفظ می‌شود؛ مکالمه و فایل پروژه هنوز در حساب همگام نمی‌شوند. خروج، مکالمه و فایل‌های همین صفحه را پاک می‌کند؛ ابتدا پروژه را دانلود کن.'),'account-note'));}
 function field(form,fields,key,en,fa,type='text',autocomplete){const label=node('label',text(en,fa)),input=node('input');input.type=type;input.required=true;input.name=key;input.id='account-'+key;input.maxLength=key==='email'?254:key==='password'||key==='confirm'?128:80;if(autocomplete)input.autocomplete=autocomplete;if(['email','password'].includes(type))input.dir='ltr';if(type==='password')input.minLength=10;if(key==='birthDate'){input.min='1900-01-01';const d=new Date();d.setFullYear(d.getFullYear()-12);input.max=d.toISOString().slice(0,10);}label.append(input);form.append(label);fields[key]=input;return input;}
 function action(container,en,fa,handler){const b=node('button',text(en,fa));b.type='button';b.onclick=handler;container.append(b);return b;}
 function feedback(container){const error=node('p');error.setAttribute('role','alert');error.hidden=true;container.append(error);return error;}
 function failure(error,target){target.hidden=false;target.textContent=error.status===409?text('That email or username is already registered. Sign in instead.','این ایمیل یا نام کاربری قبلاً ثبت شده است؛ وارد حساب شو.'):error.status===429?text('Too many attempts. Please wait and try again.','تعداد تلاش‌ها زیاد است؛ کمی صبر کن و دوباره امتحان کن.'):text('The account request could not be completed. Check your details and connection, then try again.','درخواست حساب کامل نشد؛ اطلاعات و اتصال را بررسی کن و دوباره امتحان کن.');}
 async function signedIn(result,expected){
  if(dialog!==expected)return;
  if(typeof result.sessionToken!=='string'||result.sessionToken.length>16000)throw Error('invalid_session');
  const p=await request('session',{sessionToken:result.sessionToken});
  if(typeof p.email!=='string'||p.email.length>254||typeof p.username!=='string'||p.username.length>80||!Number.isFinite(p.expiresAt)||p.expiresAt<=Date.now())throw Error('invalid_profile');
  if(dialog!==expected)return;profile={email:p.email,username:p.username};close();refresh();onChange({...profile});
 }
 function authForm(signup=false){
  const pane=shell(signup?text('Create your MalGuard account','ساخت حساب مالگارد'):text('Welcome back','خوش برگشتی'));note(pane);
  const form=node('form'),fields={};form.autocomplete='on';pane.append(form);
  if(signup){field(form,fields,'firstName','First name','نام','text','given-name');field(form,fields,'lastName','Last name','نام خانوادگی','text','family-name');field(form,fields,'birthDate','Date of birth','تاریخ تولد','date','bday');const u=field(form,fields,'username','Username','نام کاربری','text','username');u.minLength=3;u.maxLength=48;}
  field(form,fields,'email','Email address','ایمیل','email','email');field(form,fields,'password','Password','رمز عبور','password',signup?'new-password':'current-password');
  if(signup){field(form,fields,'confirm','Confirm password','تکرار رمز عبور','password','new-password');form.append(node('p',text('At least 10 characters including uppercase, lowercase and a number. Existing registration requires age 12 or older.','حداقل ۱۰ کاراکتر شامل حرف بزرگ، حرف کوچک و عدد. ثبت‌نام فعلی برای سن ۱۲ سال به بالا است.'),'account-note'));}
  const error=feedback(form),submit=node('button',signup?text('Send verification code','ارسال کد تأیید'):text('Sign in','ورود'),'account-submit');submit.type='submit';form.append(submit);
  const controls=node('div',null,'account-actions');pane.append(controls);action(controls,signup?'Back to sign in':'Create account',signup?'بازگشت به ورود':'ساخت حساب',()=>authForm(!signup));
  form.onsubmit=async event=>{event.preventDefault();if(submit.disabled)return;error.hidden=true;if(signup&&fields.password.value!==fields.confirm.value){failure({},error);return;}submit.disabled=true;controls.inert=true;
   try{const email=fields.email.value.trim();if(signup){const result=await request('start',{email,profile:{firstName:fields.firstName.value.trim(),lastName:fields.lastName.value.trim(),birthDate:fields.birthDate.value,username:fields.username.value.trim(),password:fields.password.value}});for(const input of [fields.password,fields.confirm])input.value='';if(dialog!==pane)return;if(typeof result.verificationToken!=='string'||result.verificationToken.length>16000)throw Error('invalid_challenge');codeForm(email,result.verificationToken);}else{const result=await request('password',{email,password:fields.password.value});fields.password.value='';await signedIn(result,pane);}}
   catch(e){if(controller&&!controller.signal.aborted)failure(e,error);}finally{submit.disabled=false;controls.inert=false;}
  };pane.querySelector('input')?.focus();
 }
 function codeForm(email,ticket){
  const pane=shell(text('Verify your email','تأیید ایمیل'));pane.append(node('p',text('Enter the six-digit code sent to '+email,'کد شش‌رقمی ارسال‌شده به '+email+' را وارد کن.')));
  const form=node('form'),fields={};pane.append(form);const code=field(form,fields,'code','Verification code','کد تأیید','text','one-time-code');code.inputMode='numeric';code.pattern='[0-9]{6}';code.maxLength=6;code.dir='ltr';const error=feedback(form),submit=node('button',text('Verify email','تأیید ایمیل'),'account-submit');submit.type='submit';form.append(submit);action(pane,'Back to sign in','بازگشت به ورود',()=>authForm());
  form.onsubmit=async event=>{event.preventDefault();if(submit.disabled)return;submit.disabled=true;error.hidden=true;try{await signedIn(await request('verify',{verificationToken:ticket,code:code.value}),pane);}catch(e){if(controller&&!controller.signal.aborted)failure(e,error);}finally{submit.disabled=false;}};code.focus();
 }
 button.onclick=async()=>{
  if(dialog)return;controller=new AbortController();
  if(profile){const pane=shell(text('Your MalGuard account','حساب مالگارد شما'));pane.append(node('p',profile.username),node('p',profile.email));note(pane);action(pane,'Sign out on this page','خروج از همین صفحه',()=>{profile=null;close();refresh();onChange(null);});return;}
  const pane=shell(text('Preparing sign-in…','در حال آماده‌سازی ورود…'));try{const status=await request('status');if(status.configured!==true||status.persistentAccounts!==true)throw Error('unavailable');if(controller)authForm();}catch(e){if(controller&&!controller.signal.aborted){const err=feedback(pane);failure(e,err);action(pane,'Retry','تلاش دوباره',()=>{close();button.click();});}}
 };refresh();return {refresh};
}
