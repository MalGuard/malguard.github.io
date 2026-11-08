// MalGuard AI Experience 2026 — navigation enhancement, no provider calls.
// All prompts merely populate the input; users must explicitly send and approve sharing.
export const EXPERIENCE_PROMPTS=Object.freeze({
 chat:{
  en:[['Explain a topic simply','Explain a difficult topic in simple terms, with an example.'],['Help me write','Help me write a clear, professional message.'],['Compare two options','Help me compare two choices and their trade-offs.']],
  fa:[['یک موضوع را ساده توضیح بده','یک موضوع سخت را با مثال و زبان ساده توضیح بده.'],['کمکم کن بنویسم','کمکم کن یک پیام حرفه‌ای و واضح بنویسم.'],['دو گزینه را مقایسه کن','کمکم کن دو انتخاب را با مزایا و معایب مقایسه کنم.']]
 },
 worker:{
  en:[['Check a suspicious link','Help me assess a suspicious link and explain what can be verified.'],['Understand a security alert','Explain a security warning and what evidence I should review.'],['Review a file safely','Explain how to review an unfamiliar file safely.']],
  fa:[['بررسی یک لینک مشکوک','کمکم کن یک لینک مشکوک را با شواهد موجود ارزیابی کنم.'],['توضیح هشدار امنیتی','یک هشدار امنیتی را توضیح بده و بگو چه شواهدی لازم دارم.'],['بررسی امن یک فایل','توضیح بده یک فایل ناشناس را چگونه با رعایت ایمنی بررسی کنم.']]
 },
 build:{
  en:[['Build a web page','Build a clean, responsive single-page website.'],['Debug JavaScript','Help debug a JavaScript function; ask me for the code first.'],['Improve accessibility','Review a web interface for accessibility and usability issues.']],
  fa:[['ساخت یک صفحه وب','یک صفحه وب واکنش‌گرا و تمیز بساز.'],['رفع باگ جاوااسکریپت','برای دیباگ تابع جاوااسکریپت کمکم کن؛ اول کد را بخواه.'],['بهبود دسترس‌پذیری','یک رابط وب را از نظر دسترس‌پذیری و تجربه کاربری بررسی کن.']]
 }
});
export const MODE_LINKS=Object.freeze({chat:'chat-tab',worker:'workspace-tab',build:'build-tab'});
let installed;
const $=id=>document.getElementById(id);
function applyUi({mode='chat',locale='en',busy=false,selectedId='',modelLabel='',isNew=false,thinkingReady=false,thinkingOn=false,thinkingModel=''}={}){
 if(!EXPERIENCE_PROMPTS[mode])return;
 const fa=locale==='fa';
 const translations=fa?{chat:'گفت‌وگو',worker:'کار',build:'کد'}:{chat:'Chat',worker:'Work',build:'Code'};
 for(const [id,target] of Object.entries({chat:'experience-chat',worker:'experience-worker',build:'experience-build'})){
  const button=$(target);if(!button)continue;
  button.setAttribute('aria-pressed',String(mode===id));
  button.setAttribute('aria-label',translations[id]);
  button.disabled=busy;
  const shortcut=$('navigation-mode-'+id);
  if(shortcut){shortcut.setAttribute('aria-pressed',String(mode===id));shortcut.disabled=busy;}
 }
 const modelNode=$('experience-current-model');
 if(modelNode)modelNode.textContent=modelLabel||(fa?'انتخاب مدل':'Choose model');
 const newBadge=$('experience-new');if(newBadge)newBadge.hidden=!isNew;
 const note=$('thinking-state');
 if(note){
  const label=thinkingOn?
   (fa?'تفکر روشن · ':'Thinking on · ')+thinkingModel+(fa?' · مصرف توکن بیشتر':' · higher token use'):
   thinkingReady?(fa?'تفکر خاموش · پاسخ سریع‌تر و کم‌مصرف‌تر':'Thinking off · faster, lower usage'):
   (fa?'تفکر برای این مدل یا ابزار در دسترس نیست':'Thinking unavailable for this model or tool');
  if(note.textContent!==label)note.textContent=label;
  note.dataset.enabled=String(!!thinkingOn);
 }
 const thinking=$('thinking-toggle');if(thinking)thinking.setAttribute('aria-label',fa?'تفکر عمیق':'Thinking');
 const kicker=$('experience-kicker');if(kicker)kicker.textContent='MALGUARD / '+translations[mode].toUpperCase();
 const title=$('title');
 if(title)title.textContent=(fa?{chat:'چطور می‌تونم کمکت کنم؟',worker:'چی رو می‌خوای بررسی کنیم؟',build:'چی می‌خوای بسازیم؟'}:{chat:'What can I help with?',worker:'What should we inspect?',build:'What shall we build?'})[mode];
 const prompts=EXPERIENCE_PROMPTS[mode][fa?'fa':'en'];
 for(const b of document.querySelectorAll('[data-quick-index]')){
  const entry=prompts[Number(b.dataset.quickIndex)];
  if(!entry)continue;
  const text=b.querySelector('span');if(text)text.textContent=entry[0];
  b.title=fa?'افزودن به پیام، بدون ارسال':'Fill message without sending';
  b.disabled=busy;
 }
 const suggestions=$('quick-suggestions');if(suggestions)suggestions.setAttribute('aria-label',fa?'پیشنهادهای شروع':'Suggested prompts');
 const fieldLabel=document.querySelector('label[for="model"]');
 if(fieldLabel)fieldLabel.textContent=fa?'مدل '+translations[mode]:'Model · '+translations[mode];
}
export function syncExperienceV2(state){if(installed)installed.state={...state};applyUi(state);}
export function installExperienceV2(){
 if(installed)return;
 installed={state:{mode:'chat',locale:'en'}};
 const openMode=mode=>{
  if(installed.state.busy||!MODE_LINKS[mode])return;
  $(MODE_LINKS[mode])?.click();
  $('message')?.focus({preventScroll:true});
 };
 for(const [mode,id] of [['chat','experience-chat'],['worker','experience-worker'],['build','experience-build']]){
  const button=$(id);if(button)button.addEventListener('click',()=>openMode(mode));
 }
 for(const b of document.querySelectorAll('[data-quick-index]')){
  b.addEventListener('click',()=>{
   const state=installed?.state;
   if(!state||state.busy)return;
   const entry=EXPERIENCE_PROMPTS[state.mode]?.[state.locale==='fa'?'fa':'en']?.[Number(b.dataset.quickIndex)];
   if(!entry)return;
   const textarea=$('message');if(!textarea)return;
   textarea.value=entry[1];
   textarea.dispatchEvent(new Event('input',{bubbles:true}));
   textarea.focus({preventScroll:true});
  });
 }
 document.addEventListener('keydown',event=>{
  if((event.metaKey||event.ctrlKey)&&!event.altKey&&event.key.toLowerCase()==='k'){
   event.preventDefault();
   if(document.body.classList.contains('navigation-closed'))$('navigation-toggle')?.click();
   $('chat-search')?.focus({preventScroll:true});$('chat-search')?.select();
   return;
  }
  const editable=event.target instanceof Element&&!!event.target.closest('input,textarea,select,[contenteditable=true]');
  if(!editable&&event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&['1','2','3'].includes(event.key)){
   event.preventDefault();
   openMode(({1:'chat',2:'worker',3:'build'})[event.key]);
  }
 });
 applyUi(installed.state);
}
