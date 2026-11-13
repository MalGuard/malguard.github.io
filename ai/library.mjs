export function createChatLibrary({account,restore,snapshot}){
 const $=id=>document.getElementById(id),make=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 let data={chats:[],notes:[]},generation=0,connected=false,showArchived=false,ids={chat:crypto.randomUUID(),worker:crypto.randomUUID(),build:crypto.randomUUID()},activeId=ids.chat,queue=Promise.resolve();
 const saveState=make('p');saveState.id='save-state';saveState.className='muted small';saveState.setAttribute('role','status');document.querySelector('.composer-area').append(saveState);
 const STATUS_FA={'Saving…':'در حال ذخیره…','Saved to your account':'در حساب شما ذخیره شد','Loading your chats…':'در حال بارگذاری گفتگوها…','Sign in to save and revisit your chats.':'برای ذخیره و دیدن دوبارهٔ گفتگوها وارد شوید.','Chats are saved to your account. Sign in again after reopening this page.':'گفتگوها در حساب شما ذخیره می‌شوند. پس از بازکردن دوبارهٔ صفحه دوباره وارد شوید.','Not saved. Check your connection and sign in again if needed.':'ذخیره نشد. اتصال را بررسی کنید و در صورت نیاز دوباره وارد شوید.','Account storage is unavailable. This chat is not saved.':'فضای حساب در دسترس نیست. این گفتگو ذخیره نشد.','30-chat limit reached. Export or reuse a saved chat.':'به سقف ۳۰ گفتگو رسیدید. یک گفتگوی ذخیره‌شده را خروجی بگیرید یا دوباره استفاده کنید.'};
 let lastStatus='';const status=text=>{lastStatus=text;const shown=fa()?(STATUS_FA[text]||text):text;$('history-status').textContent=shown;saveState.textContent=shown;};
 new MutationObserver(()=>{if(lastStatus)status(lastStatus);}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 async function request(value){
  const token=account.getToken();if(!token)throw Error('sign_in_required');
  const base=['malguard.site','malguard.github.io'].includes(location.hostname)?'https://game-scam-guard-connected.vercel.app':'';
  const response=await fetch(`${base}/api/malguard-library`,{method:value?'POST':'GET',credentials:'omit',headers:{Authorization:`Bearer ${token}`,...(value?{'Content-Type':'application/json'}:{})},body:value?JSON.stringify(value):undefined,signal:AbortSignal.timeout(20000)});
  const raw=await response.text();if(!response.ok||raw.length>262144)throw Error('library_failed');const result=JSON.parse(raw);if(value&&result.saved!==true)throw Error('library_failed');return result;
 }
 const fa=()=>document.documentElement.lang==='fa';
 const tr=(en,f)=>fa()?f:en;
 function bucket(time){const day=86400000,start=new Date();start.setHours(0,0,0,0);const t=start.getTime();if(time>=t)return tr('Today','امروز');if(time>=t-day)return tr('Yesterday','دیروز');if(time>=t-7*day)return tr('Previous 7 days','۷ روز گذشته');if(time>=t-30*day)return tr('Previous 30 days','۳۰ روز گذشته');return tr('Older','قدیمی‌تر');}
 let openMenu=null;
 const closeMenus=()=>{if(openMenu){openMenu.hidden=true;openMenu.previousElementSibling?.setAttribute('aria-expanded','false');openMenu=null;}};
 document.addEventListener('pointerdown',event=>{if(openMenu&&!event.target.closest('.history-row'))closeMenus();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&openMenu){const toggle=openMenu.previousElementSibling;closeMenus();toggle?.focus();}});
 function rename(chat,row,button){
  const input=make('input');input.type='text';input.className='history-rename';input.maxLength=100;input.value=chat.title||'';input.dir='auto';input.setAttribute('aria-label',tr('Rename chat','تغییر نام گفتگو'));
  let done=false;const finish=commit=>{if(done)return;done=true;const value=input.value.trim().slice(0,100);if(commit&&value&&value!==chat.title){chat.title=value;chat.updatedAt=chat.updatedAt||Date.now();save();}render();};
  input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();finish(true);}else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finish(false);}};
  input.onblur=()=>finish(true);
  button.replaceWith(input);input.focus();input.select();
 }
 function render(){
  const list=$('saved-chats');list.replaceChildren();openMenu=null;const query=$('chat-search').value.toLowerCase();let lastGroup='';
  for(const chat of data.chats.filter(c=>c.archived===showArchived&&c.title.toLowerCase().includes(query)).sort((a,b)=>b.updatedAt-a.updatedAt)){
   const group=bucket(chat.updatedAt||0);if(group!==lastGroup){lastGroup=group;const heading=make('p',group);heading.className='history-group';list.append(heading);}
   const row=make('div');row.className='history-row';row.dataset.mode=chat.mode||'chat';const button=make('button',chat.title||tr('New chat','گفت‌وگوی تازه'));button.type='button';button.className='history-open';button.dir='auto';button.title=chat.title;button.setAttribute('aria-current',String(chat.id===activeId));button.onclick=()=>{if(document.querySelector('#conversation').getAttribute('aria-busy')==='true')return;activeId=chat.id;ids[chat.mode]=chat.id;restore(chat);render();};
   const more=make('button');more.type='button';more.className='history-more';more.setAttribute('aria-haspopup','menu');more.setAttribute('aria-expanded','false');more.setAttribute('aria-label',`${tr('Options for','گزینه‌های')} ${chat.title}`);more.title=tr('More','بیشتر');
   const dots=document.createElementNS('http://www.w3.org/2000/svg','svg');dots.setAttribute('viewBox','0 0 24 24');dots.setAttribute('aria-hidden','true');for(const cx of [5,12,19]){const c=document.createElementNS(dots.namespaceURI,'circle');c.setAttribute('cx',cx);c.setAttribute('cy','12');c.setAttribute('r','1.7');c.setAttribute('fill','currentColor');dots.append(c);}more.append(dots);
   const menu=make('div');menu.className='history-menu';menu.setAttribute('role','menu');menu.hidden=true;
   const item=(label,cls,action)=>{const b=make('button',label);b.type='button';b.setAttribute('role','menuitem');b.className=cls;b.onclick=event=>{event.stopPropagation();action(b);};menu.append(b);return b;};
   item(tr('Rename','تغییر نام'),'history-rename-action',()=>{closeMenus();rename(chat,row,button);});
   const archive=item(showArchived?tr('Restore','بازگردانی'):tr('Archive','بایگانی'),'history-archive',()=>{chat.archived=!chat.archived;save();render();});archive.setAttribute('aria-label',`${showArchived?tr('Restore','بازگردانی'):tr('Archive','بایگانی')} ${chat.title}`);
   item(tr('Delete','حذف'),'history-delete danger',b=>{if(b.dataset.confirm!=='true'){b.dataset.confirm='true';b.textContent=tr('Confirm delete','تأیید حذف');return;}data.chats=data.chats.filter(c=>c!==chat);if(activeId===chat.id){activeId=ids[chat.mode]=crypto.randomUUID();}save();render();});
   more.onclick=event=>{event.stopPropagation();const wasOpen=!menu.hidden;closeMenus();if(!wasOpen){menu.hidden=false;more.setAttribute('aria-expanded','true');openMenu=menu;menu.querySelector('button')?.focus();}};
   menu.onkeydown=event=>{const items=[...menu.querySelectorAll('button')];const at=items.indexOf(document.activeElement);if(event.key==='ArrowDown'){event.preventDefault();items[(at+1)%items.length].focus();}else if(event.key==='ArrowUp'){event.preventDefault();items[(at-1+items.length)%items.length].focus();}};
   row.append(button,more,menu);list.append(row);
  }
 }
 function save(){if(!connected)return;const version=generation,body=JSON.stringify(data);status('Saving…');queue=queue.catch(()=>{}).then(async()=>{if(version!==generation)return;try{await request(JSON.parse(body));if(version===generation)status('Saved to your account');}catch{if(version===generation)status('Not saved. Check your connection and sign in again if needed.');}});}
 function paintChrome(){
  memory.textContent=tr('Memory','حافظه');
  memory.setAttribute('aria-label',tr('Memory','حافظه'));
  archived.textContent=showArchived?tr('Back to recent chats','بازگشت به گفت‌وگوهای اخیر'):tr('Archived chats','گفت‌وگوهای بایگانی‌شده');
  archived.setAttribute('aria-label',archived.textContent);
 }
 const memory=make('button');memory.type='button';memory.id='manage-memory';document.querySelector('.navigation-footer').prepend(memory);
 const archived=make('button');archived.type='button';archived.id='archived-chats';archived.onclick=()=>{showArchived=!showArchived;paintChrome();render();};memory.after(archived);
 paintChrome();
 memory.onclick=()=>{
  const dialog=make('dialog');dialog.className='ai-account';const title=make('h2',tr('Saved memory','حافظهٔ ذخیره‌شده')),description=make('p',tr('Notes are private to your account. They are not automatically sent to AI models.','یادداشت‌ها خصوصی هستند و به‌صورت خودکار به مدل‌ها ارسال نمی‌شوند.'));const list=make('div');const input=make('textarea');input.maxLength=1000;input.setAttribute('aria-label',tr('New memory','یادداشت تازه'));const add=make('button',tr('Save memory','ذخیرهٔ حافظه'));add.type='button';add.disabled=!connected;const close=make('button',tr('Close','بستن'));close.type='button';close.onclick=()=>dialog.close();
  function notes(){list.replaceChildren();data.notes.forEach((text,index)=>{const item=make('p',text),remove=make('button',tr('Remove','حذف'));remove.type='button';remove.onclick=()=>{data.notes.splice(index,1);save();notes();};item.append(remove);list.append(item);});}
  add.onclick=()=>{if(!input.value.trim()||data.notes.length>=20)return;data.notes.push(input.value.trim());input.value='';save();notes();};dialog.append(title,description,list,input,add,close);dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);notes();dialog.showModal();if(!connected)description.textContent=tr('Sign in to view or save your account’s memory.','برای دیدن یا ذخیرهٔ حافظهٔ حساب وارد شوید.');
 };
 $('chat-search').oninput=render;
 return {
  async profile(profile){generation++;connected=false;data={chats:[],notes:[]};ids={chat:crypto.randomUUID(),worker:crypto.randomUUID(),build:crypto.randomUUID()};activeId=ids.chat;render();if(!profile){status('Sign in to save and revisit your chats.');return;}const version=generation;status('Loading your chats…');try{const result=await request();if(version!==generation)return;if(!Array.isArray(result.chats)||!Array.isArray(result.notes))throw Error();data=result;connected=true;status('Chats are saved to your account. Sign in again after reopening this page.');render();}catch{if(version===generation)status('Account storage is unavailable. This chat is not saved.');}},
  capture(){if(!connected)return;const chat=snapshot();if(!chat.messages.length)return;activeId=ids[chat.mode];const existing=data.chats.find(c=>c.id===activeId);const value={...chat,id:activeId,updatedAt:Date.now(),archived:false};if(existing)Object.assign(existing,{...value,title:existing.title||value.title});else{if(data.chats.length>=30){status('30-chat limit reached. Export or reuse a saved chat.');return;}data.chats.push(value);}render();save();},
  fresh(){const mode=snapshot().mode;activeId=ids[mode]=crypto.randomUUID();render();},
  language(){paintChrome();render();if(lastStatus)status(lastStatus);}
 };
}
