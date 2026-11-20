import React,{useState,useRef} from 'react';
import {suggestAvailableUsername} from '../../../assets/unique-username.mjs';
import {ShieldCheck,X,LoaderCircle,ArrowLeft,Check,Dices} from 'lucide-react';
import {sendEmailCode,checkAccountAvailability,verifyEmailCode,signInWithPassword,readEmailSession} from './email-account.js';
import {translateText,accountError} from './account-messages.js';
export function translateTree(node,locale){
 if(typeof node==='string')return translateText(node,locale);
 if(Array.isArray(node))return node.map(child=>translateTree(child,locale));
 if(!React.isValidElement(node))return node;
 if(node.props.dir==='ltr'||node.props['data-original'])return node;
 const props={};for(const key of ['aria-label','placeholder','title'])if(typeof node.props[key]==='string')props[key]=translateText(node.props[key],locale);
 if(node.props.children!==undefined)props.children=translateTree(node.props.children,locale);
 return React.cloneElement(node,props);
}
export function AccountDialog(props){return translateTree(useAccountDialogTree(props),props.locale);}
function PasswordStrength({value,locale}){const rules=[['length',value.length>=10,'At least 10 characters'],['upper',/[A-Z]/.test(value),'One uppercase letter'],['lower',/[a-z]/.test(value),'One lowercase letter'],['number',/\d/.test(value),'One number']];const score=rules.filter(([,valid])=>valid).length;const label=['','Weak','Fair','Good','Strong'][score];return translateTree(<div className={`password-strength ${['','weak','weak','fair','good'][score]}`} aria-live="polite"><div className="password-meter"><i style={{width:`${score*25}%`}}/></div><b>{value?label:'Choose a password'}</b><ul>{rules.map(([id,valid,text])=><li className={valid?'valid':''} key={id}><Check size={13}/>{text}</li>)}</ul></div>,locale);}

function useAccountDialogTree({modalRef,state,account,onClose,onRetry,onSignedIn,onSignOut,locale}){
  const [mode,setMode]=useState('signup');
  const [stage,setStage]=useState('details');
  const [form,setForm]=useState({firstName:'',lastName:'',birthDate:'',username:'',email:'',password:'',confirmPassword:''});
  const [code,setCode]=useState('');
  const [attempt,setAttempt]=useState(null);
  const [busy,setBusy]=useState(false);
  const [rawError,setError]=useState('');
  const error=accountError(rawError,locale);
  const [availability,setAvailability]=useState({email:'',username:''});
  const [checkingAvailability,setCheckingAvailability]=useState(false);
  const [suggesting,setSuggesting]=useState(false);
  const [suggestionNotice,setSuggestionNotice]=useState('');
  const latestForm=useRef(form);
  const availabilityRequest=useRef(0);
  const suggestionRequest=useRef(0);
  const minimumBirthDate=(()=>{const value=new Date();value.setFullYear(value.getFullYear()-13);return value.toISOString().slice(0,10);})();
  const suggestion=[form.firstName,form.lastName].map(value=>value.trim().replace(/[^\p{L}\p{N}]+/gu,'_').replace(/^_+|_+$/g,'')).filter(Boolean).join('_')||'Player_Guard';
  const update=(field,value)=>{latestForm.current={...latestForm.current,[field]:value};setForm(latestForm.current);if(field==='email'||field==='username')setAvailability(current=>({...current,[field]:''}));if(['firstName','lastName','username'].includes(field))setSuggestionNotice('');};
  const availabilityText=field=>({available:field==='email'?'This email is available.':'This username is available.',taken:field==='email'?'This email is already registered. Sign in instead.':'This username is already taken. Choose another one.',invalid:field==='email'?'Enter a valid email address.':'Use 3–48 letters, numbers, spaces, _ or -.'}[availability[field]]||'');
  function switchMode(next){suggestionRequest.current++;availabilityRequest.current++;setMode(next);setStage('details');setCode('');setAttempt(null);setError('');setAvailability({email:'',username:''});setSuggestionNotice('');}
  async function checkAvailability(){
    const snapshot={email:latestForm.current.email.trim(),username:latestForm.current.username.trim()};
    if(busy||suggesting||!snapshot.email&&!snapshot.username)return;
    const requestId=++availabilityRequest.current;
    setCheckingAvailability(true);
    try{
      const result=await checkAccountAvailability(snapshot);
      if(requestId===availabilityRequest.current&&
        snapshot.email===latestForm.current.email.trim()&&snapshot.username===latestForm.current.username.trim())setAvailability(result);
    }catch{
      if(requestId===availabilityRequest.current)setAvailability({email:'',username:''});
    }finally{if(requestId===availabilityRequest.current)setCheckingAvailability(false);}
  }
  async function suggestUsername(){
    if(busy||suggesting)return;
    const requestId=++suggestionRequest.current;
    const {firstName,lastName,username}=latestForm.current;
    setSuggesting(true);setSuggestionNotice(locale==='fa'?'در حال بررسی نام‌های کاربری آزاد…':'Checking available usernames…');
    try{
      const candidate=await suggestAvailableUsername({
        firstName,lastName,
        check:async suggested=>(await checkAccountAvailability({email:'',username:suggested})).username
      });
      if(requestId!==suggestionRequest.current)return;
      const current=latestForm.current;
      if(current.firstName!==firstName||current.lastName!==lastName||current.username!==username)return;
      update('username',candidate);setAvailability(prev=>({...prev,username:'available'}));
      setSuggestionNotice(locale==='fa'?'این نام فعلاً آزاد است؛ هنگام ثبت‌نام دوباره بررسی می‌شود.':'Available now. Final availability is verified when you register.');
    }catch{
      if(requestId===suggestionRequest.current)setSuggestionNotice(locale==='fa'?'بررسی نام کاربری آزاد ممکن نشد؛ دوباره تلاش کن.':'Could not verify a free username. Try again.');
    }finally{if(requestId===suggestionRequest.current)setSuggesting(false);}
  }
  async function submitSignup(event){event.preventDefault();if(busy)return;if(form.password!==form.confirmPassword){setError('Passwords do not match.');return;}setBusy(true);setError('');try{const next=await sendEmailCode({email:form.email.trim(),profile:{firstName:form.firstName,lastName:form.lastName,birthDate:form.birthDate,username:form.username,password:form.password}});setAttempt(next);setStage('code');}catch(err){setError(err.message||'We could not send a code to that email address.');}finally{setBusy(false);}}
  async function submitPassword(event){event.preventDefault();if(busy)return;setBusy(true);setError('');try{const session=await signInWithPassword({email:form.email.trim(),password:form.password});const profile=await readEmailSession(session.sessionToken);onSignedIn({...profile,sessionToken:session.sessionToken});}catch(err){setError(err.message||'Email or password is not correct.');}finally{setBusy(false);}}
  async function requestCodeLogin(){if(busy||!form.email.trim())return;setBusy(true);setError('');try{setAttempt(await sendEmailCode({email:form.email.trim()}));setMode('code');setStage('code');}catch(err){setError(err.message||'We could not send a code to that email address.');}finally{setBusy(false);}}
  async function submitCode(event){event.preventDefault();if(!attempt||busy)return;setBusy(true);setError('');try{const session=await verifyEmailCode({verificationToken:attempt.verificationToken,code});const profile=await readEmailSession(session.sessionToken);onSignedIn({...profile,sessionToken:session.sessionToken});}catch(err){setError(err.message||'That code is not valid. Request a new one and try again.');}finally{setBusy(false);}}
  async function resend(){if(busy)return;setBusy(true);setError('');try{setAttempt(await sendEmailCode(mode==='signup'?{email:form.email.trim(),profile:{firstName:form.firstName,lastName:form.lastName,birthDate:form.birthDate,username:form.username,password:form.password}}:{email:form.email.trim()}));}catch(err){setError(err.message||'We could not resend the code yet. Please wait and try again.');}finally{setBusy(false);}}
  const duplicate=/already (registered|taken)|just registered/i.test(rawError);
  if(!account&&state==='unavailable')return <div className="modal-backdrop" onClick={onClose}><section ref={modalRef} className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title" onClick={event=>event.stopPropagation()}><button className="icon-button modal-close" aria-label="Close" onClick={onClose}><X size={20}/></button><h2 id="account-title">Account service is unavailable</h2><p>We could not reach the account service. Check your connection and try again.</p><button className="primary-button account-wide" onClick={onRetry}>Try again</button></section></div>;
  const signup=<form onSubmit={submitSignup}><div className="account-heading"><span className="account-shield"><ShieldCheck size={22}/></span><h2 id="account-title">Create your account</h2><p>Complete your profile, choose a password, then confirm your email.</p></div><div className="account-two-columns"><label>First name<input autoFocus aria-label="First name" autoComplete="given-name" required maxLength="80" value={form.firstName} onChange={event=>update('firstName',event.target.value)} placeholder="For example: Alex"/><small>Example: Alex</small></label><label>Last name<input aria-label="Last name" autoComplete="family-name" required maxLength="80" value={form.lastName} onChange={event=>update('lastName',event.target.value)} placeholder="For example: Morgan"/><small>Example: Morgan</small></label></div><label className="date-field">Date of birth<input type="date" aria-label="Date of birth" autoComplete="bday" max={minimumBirthDate} required value={form.birthDate} onChange={event=>update('birthDate',event.target.value)}/><small>Example: 2000-01-01 · you must be at least 13.</small></label><div className="username-field"><div className="username-heading"><label htmlFor="account-username">Username</label><button type="button" className="username-suggestion" aria-label="Suggest an available handle" title="Suggest an available handle" disabled={busy||suggesting} onClick={suggestUsername}>{suggesting?<LoaderCircle className="spin" size={15}/>:<Dices size={16} aria-hidden="true"/>}</button></div><input id="account-username" aria-label="Username" autoComplete="username" minLength="3" maxLength="48" required value={form.username} onChange={event=>update('username',event.target.value)} onBlur={checkAvailability} placeholder="For example: Player_Guard"/><small>Choose it yourself. Example: <b dir="ltr">{suggestion}</b></small><span className={'availability '+availability.username}>{checkingAvailability?'Checking…':availabilityText('username')}</span><span className="username-suggestion-feedback" role="status" aria-live="polite">{suggestionNotice}</span></div><label>Email address<input aria-label="Email address" autoComplete="email" inputMode="email" type="email" required value={form.email} onChange={event=>update('email',event.target.value)} onBlur={checkAvailability} placeholder="For example: you@example.com"/><small>Example: you@example.com</small><span className={'availability '+availability.email}>{checkingAvailability?'Checking…':availabilityText('email')}</span></label><label>Password<input aria-label="Password" autoComplete="new-password" type="password" minLength="10" maxLength="128" required value={form.password} onChange={event=>update('password',event.target.value)} placeholder="At least 10 characters"/></label><PasswordStrength value={form.password} locale={locale}/><label>Confirm password<input aria-label="Confirm password" autoComplete="new-password" type="password" required value={form.confirmPassword} onChange={event=>update('confirmPassword',event.target.value)} placeholder="Type the password again"/></label>{error&&<div className="account-error" role="alert">{error}{duplicate&&<button type="button" onClick={()=>switchMode('signin')}>Sign in</button>}</div>}<button className="primary-button account-wide" disabled={busy||suggesting||availability.email==='taken'||availability.username==='taken'}>{busy?<LoaderCircle className="spin" size={17}/>:null}Send verification code <ArrowLeft size={16}/></button><p className="account-switch">Already have an account? <button type="button" onClick={()=>switchMode('signin')}>Sign in</button></p></form>;
  const codeForm=<form onSubmit={submitCode}><div className="account-heading"><span className="account-shield"><ShieldCheck size={22}/></span><h2 id="account-title">Enter your code</h2><p>We sent a six-digit code to <b dir="ltr">{form.email}</b>.</p></div><label>Verification code<input className="code-input" aria-label="Verification code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" required autoFocus value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,''))} placeholder="000000"/></label>{error&&<p className="account-error" role="alert">{error}</p>}<button className="primary-button account-wide" disabled={busy||code.length!==6}>{busy?<LoaderCircle className="spin" size={17}/>:null}Verify and continue <ArrowLeft size={16}/></button><button type="button" className="text-button account-wide" disabled={busy} onClick={resend}>Send a new code</button><button type="button" className="text-button account-wide" onClick={()=>switchMode('signup')}>Use another method</button></form>;
  const signin=<form onSubmit={submitPassword}><div className="account-heading"><span className="account-shield"><ShieldCheck size={22}/></span><h2 id="account-title">Welcome back</h2><p>Sign in with the email and password you chose.</p></div><label>Email address<input autoFocus aria-label="Email address" autoComplete="email" inputMode="email" type="email" required value={form.email} onChange={event=>update('email',event.target.value)} placeholder="Enter your email address"/></label><label>Password<input aria-label="Password" autoComplete="current-password" type="password" required value={form.password} onChange={event=>update('password',event.target.value)} placeholder="Enter your password"/></label>{error&&<p className="account-error" role="alert">{error}</p>}<button className="primary-button account-wide" disabled={busy}>{busy?<LoaderCircle className="spin" size={17}/>:null}Sign in <ArrowLeft size={16}/></button><button type="button" className="text-button account-wide" disabled={busy} onClick={requestCodeLogin}>Use an email code instead</button><p className="account-switch">New to GameScam Guard? <button type="button" onClick={()=>switchMode('signup')}>Create an account</button></p></form>;
  return <div className="modal-backdrop" onClick={onClose}><section ref={modalRef} className="account-modal account-signup-card" role="dialog" aria-modal="true" aria-labelledby="account-title" onClick={event=>event.stopPropagation()}><button className="icon-button modal-close" aria-label="Close" onClick={onClose}><X size={20}/></button>{account?<><span className="modal-icon"><ShieldCheck size={29}/></span><h2 id="account-title">You are signed in</h2><p>{account.firstName||account.username} · {account.email}</p><button className="outline-button account-wide" onClick={onSignOut}>Sign out</button></>:state==='loading'?<p className="account-loading"><LoaderCircle size={18}/>Preparing secure sign-in…</p>:stage==='code'?codeForm:mode==='signup'?signup:signin}</section></div>;
}
