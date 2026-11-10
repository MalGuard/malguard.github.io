// MalGuard AI demo mode (/ai/?demo=1): no sign-in, no provider calls. Never contacts models.malguard.site.
(()=>{
 let on=false;try{const q=new URLSearchParams(location.search);if(q.has('demo'))sessionStorage.setItem('mg-ai-demo',q.get('demo')==='0'?'0':'1');on=sessionStorage.getItem('mg-ai-demo')==='1';}catch{}
 if(!on)return;
 window.MG_AI_DEMO=true;
 const TOKEN='demo-session-token-0000';
 try{localStorage.setItem('malguard.ai.session.v1',TOKEN);localStorage.setItem('malguard.ai.welcome.v1','1');localStorage.setItem('malguard.ai.welcomeSeen.v1','1');}catch{}
 const real=window.fetch.bind(window);
 const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
 const LIB='mg-ai-demo-library';
 const lib=()=>{try{return JSON.parse(localStorage.getItem(LIB))||null;}catch{return null;}};
 const seed={chats:[{id:'demo-1',mode:'chat',title:'Is this Steam gift link safe?',messages:[{role:'user',text:'Is this Steam gift link safe?'}],updatedAt:Date.now()-3e5,archived:false},{id:'demo-2',mode:'build',title:'Landing page for GTA Guard',messages:[{role:'user',text:'Landing page for GTA Guard'}],updatedAt:Date.now()-9e7,archived:false},{id:'demo-3',mode:'chat',title:'خلاصه قابلیت‌های MalGuard',messages:[{role:'user',text:'خلاصه قابلیت‌های MalGuard'}],updatedAt:Date.now()-5e8,archived:false}],notes:[]};
 const EN=m=>`## Demo reply\n\nYou asked: *${m.slice(0,120)}*\n\nThis is a **demo** answer — no real model was called.\n\n### What MalGuard AI can do\n- **GTA Guard** — static evidence for GTA mods\n- **Game Scam Guard** — store and link checks\n- \`MalwareBazaar\` and \`URLhaus\` lookups\n\n| Mode | Best for |\n|---|---|\n| Chat | Questions and writing |\n| Work | Files, links, evidence |\n| Code | Build and preview |\n\n1. Attach a file or paste a link\n2. Pick a tool, or let Auto decide\n\n> Findings never guarantee safety.\n\n\`\`\`js\nconst verdict = await scan(file);\nconsole.log(verdict.level);\n\`\`\``;
 const FA=m=>`## پاسخ نمایشی\n\nپرسیدی: *${m.slice(0,120)}*\n\nاین یک پاسخ **نمایشی** است و هیچ مدل واقعی صدا زده نشد.\n\n### قابلیت‌های MalGuard AI\n- **GTA Guard** — شواهد استاتیک برای مودهای GTA\n- **Game Scam Guard** — بررسی فروشگاه و لینک بازی\n- جست‌وجو در \`MalwareBazaar\` و \`URLhaus\`\n\n| بخش | کاربرد |\n|---|---|\n| گفت‌وگو | پرسش و نوشتن |\n| کار | فایل، لینک و شواهد |\n| کد | ساخت و پیش‌نمایش |\n\n1. فایل را پیوست کن یا لینک بگذار\n2. ابزار را انتخاب کن یا بگذار خودکار انتخاب شود\n\n> هیچ نتیجه‌ای تضمین امنیت نیست.\n\n\`\`\`js\nconst verdict = await scan(file);\nconsole.log(verdict.level);\n\`\`\``;
 window.fetch=async(input,init={})=>{
  const url=new URL(typeof input==='string'?input:input.url,location.href),method=(init.method||'GET').toUpperCase(),p=url.pathname;
  if(url.origin===location.origin&&p.startsWith('/ai/demo/'))return real(input,init);
  if(p.includes('/api/game-scam-guard/auth/status'))return json({configured:true,persistentAccounts:true});
  if(p.includes('/api/game-scam-guard/auth/'))return json({email:'demo@malguard.site',username:'Demo',expiresAt:Date.now()+864e5,sessionToken:TOKEN});
  if(p.endsWith('/api/malguard-ai/status'))return real('/ai/demo/status.json');
  if(p.endsWith('/api/malguard-library')){if(method==='POST'){try{localStorage.setItem(LIB,init.body);}catch{}return json({saved:true});}return json(lib()||seed);}
  if(p.endsWith('/api/public-models'))return real('/ai/demo/models.json');
  if(p.endsWith('/api/account-usage'))return json({limitTokens:100000,remainingTokens:96000,usedTokens:4000,resetAt:new Date(Date.now()+8e7).toISOString()});
  if(p.endsWith('/api/public-model-chat')){let b={};try{b=JSON.parse(init.body||'{}');}catch{}const m=String(b.message||'');await new Promise(r=>setTimeout(r,450));
   return json({text:/[\u0600-\u06FF]/.test(m)?FA(m):EN(m),model:'MalGuard Demo',modelId:b.model||'chat_auto',provider:'demo'});}
  if(p.endsWith('/api/public-media'))return json({error:'demo_unavailable'},503);
  if(p.includes('/api/malguard-ai/'))return json({error:'demo_unavailable'},503);
  if(url.origin===location.origin)return real(input,init);
  return Promise.reject(new TypeError('Blocked in demo mode'));
 };
 document.addEventListener('DOMContentLoaded',()=>{document.body.classList.add('mg-ai-demo');const b=document.createElement('div');b.className='pro-demo-badge';b.textContent=document.documentElement.lang==='fa'?'حالت نمایشی · بدون مدل واقعی':'Demo mode · no real models';document.body.append(b);});
})();
