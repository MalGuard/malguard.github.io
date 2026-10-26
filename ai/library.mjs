export function createChatLibrary({account,restore,snapshot}){
 const $=id=>document.getElementById(id),make=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 let data={chats:[],notes:[]},generation=0,connected=false,ids={chat:crypto.randomUUID(),worker:crypto.randomUUID(),build:crypto.randomUUID()},activeId=ids.chat,queue=Promise.resolve();
 const saveState=make('p');saveState.id='save-state';saveState.className='muted small';saveState.setAttribute('role','status');document.querySelector('.composer-area').append(saveState);
 const status=text=>{$('history-status').textContent=text;saveState.textContent=text;};
 async function request(value){
  const token=account.getToken();if(!token)throw Error('sign_in_required');
  const base=['malguard.site','malguard.github.io'].includes(location.hostname)?'https://game-scam-guard-connected.vercel.app':'';
  const response=await fetch(`${base}/api/malguard-library`,{method:value?'POST':'GET',credentials:'omit',headers:{Authorization:`Bearer ${token}`,...(value?{'Content-Type':'application/json'}:{})},body:value?JSON.stringify(value):undefined,signal:AbortSignal.timeout(20000)});
  const raw=await response.text();if(!response.ok||raw.length>262144)throw Error('library_failed');return JSON.parse(raw);
 }
 function render(){
  const list=$('saved-chats');list.replaceChildren();const query=$('chat-search').value.toLowerCase();
  for(const chat of data.chats.filter(c=>!c.archived&&c.title.toLowerCase().includes(query)).sort((a,b)=>b.updatedAt-a.updatedAt)){
   const row=make('div');row.className='history-row';const button=make('button',chat.title||'New chat');button.type='button';button.title=chat.title;button.setAttribute('aria-current',String(chat.id===activeId));button.onclick=()=>{if(document.querySelector('#conversation').getAttribute('aria-busy')==='true')return;activeId=chat.id;ids[chat.mode]=chat.id;restore(chat);render();};
   const archive=make('button','×');archive.type='button';archive.setAttribute('aria-label',`Archive ${chat.title}`);archive.onclick=()=>{chat.archived=true;save();render();};row.append(button,archive);list.append(row);
  }
 }
 function save(){if(!connected)return;const version=generation,body=JSON.stringify(data);status('Saving…');queue=queue.catch(()=>{}).then(async()=>{if(version!==generation)return;try{await request(JSON.parse(body));if(version===generation)status('Saved to your account');}catch{if(version===generation)status('Not saved. Check your connection and sign in again if needed.');}});}
 const memory=make('button','Memory');memory.type='button';memory.id='manage-memory';document.querySelector('.navigation-footer').prepend(memory);
 memory.onclick=()=>{
  const dialog=make('dialog');dialog.className='ai-account';const title=make('h2','Saved memory'),description=make('p','Notes are private to your account. They are not automatically sent to AI models.');const list=make('div');const input=make('textarea');input.maxLength=1000;input.setAttribute('aria-label','New memory');const add=make('button','Save memory');add.type='button';add.disabled=!connected;const close=make('button','Close');close.type='button';close.onclick=()=>dialog.close();
  function notes(){list.replaceChildren();data.notes.forEach((text,index)=>{const item=make('p',text),remove=make('button','Remove');remove.type='button';remove.onclick=()=>{data.notes.splice(index,1);save();notes();};item.append(remove);list.append(item);});}
  add.onclick=()=>{if(!input.value.trim()||data.notes.length>=20)return;data.notes.push(input.value.trim());input.value='';save();notes();};dialog.append(title,description,list,input,add,close);dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);notes();dialog.showModal();if(!connected)description.textContent='Sign in to view or save your account’s memory.';
 };
 $('chat-search').oninput=render;
 return {
  async profile(profile){generation++;connected=false;data={chats:[],notes:[]};ids={chat:crypto.randomUUID(),worker:crypto.randomUUID(),build:crypto.randomUUID()};activeId=ids.chat;render();if(!profile){status('Sign in to save and revisit your chats.');return;}const version=generation;status('Loading your chats…');try{const result=await request();if(version!==generation)return;if(!Array.isArray(result.chats)||!Array.isArray(result.notes))throw Error();data=result;connected=true;status('Chats are saved to your account. Sign in again after reopening this page.');render();}catch{if(version===generation)status('Account storage is unavailable. This chat is not saved.');}},
  capture(){if(!connected)return;const chat=snapshot();if(!chat.messages.length)return;activeId=ids[chat.mode];const existing=data.chats.find(c=>c.id===activeId);const value={...chat,id:activeId,updatedAt:Date.now(),archived:false};if(existing)Object.assign(existing,value);else{if(data.chats.length>=30){status('30-chat limit reached. Export or reuse a saved chat.');return;}data.chats.push(value);}render();save();},
  fresh(){const mode=snapshot().mode;activeId=ids[mode]=crypto.randomUUID();render();}
 };
}
