
(function(){
  const AUTH_API='https://malware-ai-gray.vercel.app/api/auth';
  const gate=document.getElementById('siteEntryGate');
  const choice=document.getElementById('siteEntryChoice');
  const publicEntry=document.getElementById('sitePublicEntry');
  const adminEntry=document.getElementById('siteAdminEntry');
  const passwordStep=document.getElementById('siteAdminPasswordStep');
  const passwordForm=document.getElementById('siteAdminPasswordForm');
  const passwordInput=document.getElementById('siteAdminPassword');
  const passwordToggle=document.getElementById('siteAdminPasswordToggle');
  const passwordSubmit=document.getElementById('siteAdminPasswordSubmit');
  const passwordBack=document.getElementById('siteAdminPasswordBack');
  const passwordError=document.getElementById('siteAdminPasswordError');
  const identityStep=document.getElementById('siteAdminIdentityStep');
  const identityForm=document.getElementById('siteAdminIdentityForm');
  const nameInput=document.getElementById('siteAdminName');
  const phoneInput=document.getElementById('siteAdminPhone');
  const consent=document.getElementById('siteAdminConsent');
  const identityBack=document.getElementById('siteAdminIdentityBack');
  const identityError=document.getElementById('siteAdminIdentityError');
  let adminPassword='';

  function syncGate(){
    [...document.body.children].filter(el=>el!==gate && !['SCRIPT','STYLE','NOSCRIPT'].includes(el.tagName)).forEach(el=>{el.inert=!gate.hidden});
  }
  const gateObserver=new MutationObserver(syncGate);
  gateObserver.observe(gate,{attributes:true,attributeFilter:['hidden']});
  gate.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const controls=[...gate.querySelectorAll('button,input')].filter(el=>!el.disabled&&el.getClientRects().length);
    if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1)?.focus()}
    else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0]?.focus()}
  });
  function replaySecurity(){
    gate.classList.remove('security-play');
    void gate.offsetWidth;
    requestAnimationFrame(()=>gate.classList.add('security-play'));
  }
  function show(step){
    choice.hidden=step!=='choice';
    passwordStep.hidden=step!=='password';
    identityStep.hidden=step!=='identity';
    passwordError.textContent='';
    identityError.textContent='';
    replaySecurity();
  }
  function enterSite(role,sessionToken='',expiresAt=''){
    try{
      sessionStorage.setItem('malguard-site-role',role);
      if(role==='admin'&&sessionToken){
        sessionStorage.setItem('malguard-admin-session',sessionToken);
        sessionStorage.setItem('malguard-admin-session-exp',String(expiresAt||''));
      }else{
        sessionStorage.removeItem('malguard-admin-session');
        sessionStorage.removeItem('malguard-admin-session-exp');
      }
    }catch(e){}
    gate.hidden=true;
    document.body.classList.remove('site-entry-locked');
    syncGate();
    document.getElementById('homeContent')?.focus({preventScroll:true});
  }
  async function clientDeviceInfo(){
    const info={
      platform:navigator.platform||'',
      maxTouchPoints:navigator.maxTouchPoints||0,
      language:navigator.language||'',
      timeZone:(Intl.DateTimeFormat().resolvedOptions().timeZone||''),
      screen:(window.screen?String(window.screen.width)+'x'+String(window.screen.height):'')
    };
    try{
      if(navigator.userAgentData&&navigator.userAgentData.getHighEntropyValues){
        const high=await navigator.userAgentData.getHighEntropyValues(['platform','platformVersion','model','architecture','bitness']);
        Object.assign(info,high);
      }
    }catch(e){}
    return info;
  }

  passwordToggle?.addEventListener('click',()=>{
    const showing=passwordInput.type==='text';
    passwordInput.type=showing?'password':'text';
    passwordToggle.setAttribute('aria-pressed',String(!showing));
    passwordToggle.setAttribute('aria-label',showing?'Show password':'Hide password');
    passwordInput.focus();
  });

  publicEntry.addEventListener('click',()=>enterSite('public'));
  adminEntry.addEventListener('click',()=>{show('password');setTimeout(()=>passwordInput.focus(),0)});
  passwordBack.addEventListener('click',()=>{adminPassword='';passwordInput.value='';show('choice')});
  identityBack.addEventListener('click',()=>{nameInput.value='';phoneInput.value='';consent.checked=false;show('password');setTimeout(()=>passwordInput.focus(),0)});

  passwordForm.addEventListener('submit',async function(event){
    event.preventDefault();
    const password=passwordInput.value;
    if(!password)return;
    passwordSubmit.disabled=true;
    passwordError.textContent='Checking access…';
    try{
      const response=await fetch(AUTH_API,{
        method:'POST',mode:'cors',cache:'no-store',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({password})
      });
      let data={};try{data=await response.json()}catch(e){}
      if(!response.ok){
        if(response.status===429)throw new Error('Too many failed attempts. Try again later.');
        throw new Error(data.error||'Access denied');
      }
      adminPassword=password;
      passwordInput.value='';
      show('identity');
      setTimeout(()=>nameInput.focus(),0);
    }catch(error){
      passwordInput.select();
      passwordError.textContent=error&&error.message?error.message:'Access denied';
    }finally{passwordSubmit.disabled=false}
  });

  identityForm.addEventListener('submit',async function(event){
    event.preventDefault();
    const name=nameInput.value.replace(/\s+/g,' ').trim();
    const phoneRaw=phoneInput.value.trim();
    const phoneDigits=phoneRaw.replace(/\D/g,'');
    if(name.length<2){identityError.textContent='Enter your name before continuing.';nameInput.focus();return}
    if(phoneDigits.length<8||phoneDigits.length>15||/^([0-9])\1{7,}$/.test(phoneDigits)){identityError.textContent='Enter a valid phone number with 8 to 15 digits.';phoneInput.focus();return}
    if(!consent.checked){identityError.textContent='You must acknowledge the administrator access log before continuing.';return}
    const enterButton=document.getElementById('siteAdminEnter');
    enterButton.disabled=true;
    identityError.textContent='Recording secure access…';
    try{
      const client=await clientDeviceInfo();
      const response=await fetch(AUTH_API,{
        method:'POST',mode:'cors',cache:'no-store',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({password:adminPassword,phase:'enter',name,phone:phoneRaw,client,consent:true})
      });
      let data={};try{data=await response.json()}catch(e){}
      if(!response.ok)throw new Error(data.error||'Access could not be completed');
      if(data.emailConfigured===false)throw new Error('Administrator login email is not configured.');
      if(data.emailSent!==true)throw new Error('Administrator login email could not be sent.');
      adminPassword='';
      enterSite('admin',data.sessionToken||'',data.sessionExpiresAt||'');
    }catch(error){
      identityError.textContent=error&&error.message?error.message:'Access could not be completed';
    }finally{enterButton.disabled=false}
  });

  let existingRole='';
  try{existingRole=sessionStorage.getItem('malguard-site-role')||''}catch(e){}
  if(existingRole==='public'||existingRole==='admin'){
    gate.hidden=true;
    document.body.classList.remove('site-entry-locked');
    syncGate();
    document.getElementById('homeContent')?.focus({preventScroll:true});
  }else{
    gate.hidden=false;
    document.body.classList.add('site-entry-locked');
    show('choice');
    publicEntry.focus({preventScroll:true});
  }
  syncGate();
})();
