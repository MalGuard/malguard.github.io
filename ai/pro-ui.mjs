// MalGuard AI pro UI layer: presentation only. Native controls stay the source of truth;
// custom widgets mirror them and dispatch the same change events, so every API call is unchanged.
const $=id=>document.getElementById(id);
const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
const fa=()=>document.documentElement.lang==='fa';
const desc={value:Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value'),selectedIndex:Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'selectedIndex')};
let openPicker=null;
function closeAll(){if(openPicker){openPicker.close();openPicker=null;}}
document.addEventListener('pointerdown',e=>{if(openPicker&&!openPicker.root.contains(e.target))closeAll();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&openPicker){const p=openPicker;closeAll();p.button.focus();}});
function groupOf(o){const v=o.value,l=o.textContent;if(v.startsWith('__'))return 'actions';if(v.startsWith('local_'))return 'device';if(/Ollama/.test(l))return 'desktop';return 'cloud';}
const GROUPS={cloud:['Cloud models','مدل‌های ابری'],device:['On this device','روی همین دستگاه'],desktop:['Your computer · Ollama','کامپیوتر شما · Ollama'],actions:['More','بیشتر']};
export function enhanceSelect(select,{variant='plain',mount}={}){
 if(!select||select.dataset.proEnhanced)return;select.dataset.proEnhanced='1';
 const root=make('div','pro-select pro-select-'+variant);
 const button=make('button','pro-select-button');button.type='button';button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');
 const label=make('span','pro-select-label'),sub=make('span','pro-select-sub'),badge=make('span','pro-new','NEW');badge.hidden=true;
 const chev=document.createElementNS('http://www.w3.org/2000/svg','svg');chev.setAttribute('viewBox','0 0 24 24');chev.setAttribute('class','pro-chev');chev.innerHTML='<path d="m7 10 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
 button.append(label,badge,sub,chev);
 const list=make('div','pro-select-list');list.setAttribute('role','listbox');list.hidden=true;list.tabIndex=-1;
 root.append(button,list);
 const split=t=>{const isNew=/·\s*NEW$/.test(t);t=t.replace(/\s*·\s*NEW$/,'');const [head,...rest]=t.split(' · ');return {head,rest:rest.join(' · '),isNew};};
 let items=[],active=-1;
 const sync=()=>{
  const o=select.options[select.selectedIndex];const s=split(o?.textContent||'');
  label.textContent=s.head||(fa()?'انتخاب':'Choose');sub.textContent=variant==='model'?s.rest:'';badge.hidden=!s.isNew;
  button.disabled=select.disabled;root.hidden=select.hidden||!!select.closest('[hidden]')&&!mount;
  button.setAttribute('aria-label',(select.getAttribute('aria-label')||document.querySelector(`label[for="${select.id}"]`)?.textContent||'')+': '+(o?.textContent||''));
 };
 const build=()=>{
  list.replaceChildren();items=[];let last='';
  [...select.options].forEach((o,i)=>{
   if(o.disabled&&o.value==='')return;
   if(variant==='model'){const g=groupOf(o);if(g!==last){last=g;list.append(make('div','pro-group',GROUPS[g][fa()?1:0]));}}
   const s=split(o.textContent),it=make('div','pro-option');it.setAttribute('role','option');it.dataset.index=i;it.setAttribute('aria-selected',String(i===select.selectedIndex));if(o.disabled)it.setAttribute('aria-disabled','true');
   const txt=make('span','pro-option-text');txt.append(make('span','pro-option-title',s.head));if(s.rest)txt.append(make('span','pro-option-sub',s.rest));
   it.append(txt);if(s.isNew)it.append(make('span','pro-new','NEW'));
   const check=make('span','pro-check','✓');it.append(check);
   it.onclick=()=>choose(i);it.onpointermove=()=>setActive(items.indexOf(it));
   list.append(it);items.push(it);
  });
 };
 const setActive=n=>{items.forEach(x=>x.classList.remove('is-active'));active=n;if(items[n]){items[n].classList.add('is-active');items[n].scrollIntoView({block:'nearest'});}};
 const choose=i=>{const o=select.options[i];if(!o||o.disabled)return;close();openPicker=null;if(select.selectedIndex!==i){desc.selectedIndex.set.call(select,i);select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));}sync();button.focus();};
 const open=()=>{if(button.disabled)return;closeAll();build();list.hidden=false;root.classList.add('is-open');button.setAttribute('aria-expanded','true');openPicker=api;setActive(items.findIndex(x=>x.getAttribute('aria-selected')==='true'));list.focus({preventScroll:true});};
 const close=()=>{list.hidden=true;root.classList.remove('is-open');button.setAttribute('aria-expanded','false');};
 const api={root,button,close};
 button.onclick=()=>{list.hidden?open():(closeAll());};
 button.onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();open();}};
 list.onkeydown=e=>{const enabled=items.filter(x=>!x.hasAttribute('aria-disabled'));let at=enabled.indexOf(items[active]);
  if(e.key==='ArrowDown'){e.preventDefault();setActive(items.indexOf(enabled[(at+1)%enabled.length]));}
  else if(e.key==='ArrowUp'){e.preventDefault();setActive(items.indexOf(enabled[(at-1+enabled.length)%enabled.length]));}
  else if(e.key==='Enter'||e.key===' '){e.preventDefault();if(items[active])choose(+items[active].dataset.index);}
  else if(e.key==='Tab'){closeAll();}};
 for(const k of ['value','selectedIndex'])Object.defineProperty(select,k,{configurable:true,get(){return desc[k].get.call(this);},set(v){desc[k].set.call(this,v);queueMicrotask(sync);}});
 select.addEventListener('change',sync);select.addEventListener('pro-sync',sync);
 new MutationObserver(()=>{sync();if(!list.hidden)build();}).observe(select,{childList:true,subtree:true,attributes:true,characterData:true});
 if(select.parentElement)new MutationObserver(sync).observe(select.closest('section,form,dialog,details,div')||select.parentElement,{attributes:true,attributeFilter:['hidden']});
 select.classList.add('pro-native');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
 (mount||select.parentElement).insertBefore(root,mount?null:select.nextSibling);
 sync();return api;
}
function init(){
 document.body.classList.add('mg-pro');
 const header=document.querySelector('.site-header');
 // Header model picker (ChatGPT style). Chat/Code use #model, Work uses #workspace-model.
 const slot=make('div','pro-model-slot');
 const toggle=$('navigation-toggle');if(toggle&&toggle.parentElement===header)toggle.after(slot);else header.prepend(slot);
 enhanceSelect($('model'),{variant:'model',mount:slot});
 enhanceSelect($('workspace-model'),{variant:'model',mount:slot});
 const wsPicker=slot.lastElementChild;wsPicker.classList.add('pro-work-picker');
 const syncMode=()=>{const m=document.body.dataset.mode||'chat';slot.dataset.mode=m;wsPicker.hidden=m!=='worker';slot.firstElementChild.hidden=m==='worker'||$('model').hidden;};
 new MutationObserver(syncMode).observe(document.body,{attributes:true,attributeFilter:['data-mode']});syncMode();
 for(const id of ['workspace-tool','tool','web-search-depth','build-file','mode','offer-model','desktop-model'])enhanceSelect($(id));
 // Theme toggle and language switch live in the header actions.
 const actions=document.querySelector('.header-actions');
 const lang=make('button','pro-lang');lang.type='button';lang.id='pro-language';
 const syncLang=()=>{lang.textContent=fa()?'EN':'فا';lang.title=fa()?'Switch to English':'تغییر به فارسی';lang.setAttribute('aria-label',lang.title);};
 lang.onclick=()=>$('language')?.click();syncLang();
 new MutationObserver(()=>{syncLang();document.querySelectorAll('select[data-pro-enhanced]').forEach(s=>s.dispatchEvent(new Event('pro-sync')));}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 actions?.prepend(lang);
 const moveTheme=()=>{const t=$('mgThemeToggle');if(t&&actions&&t.parentElement!==actions){actions.prepend(t);t.classList.add('pro-theme');}};
 moveTheme();new MutationObserver(moveTheme).observe(document.body,{childList:true});
 // Auto-grow composer.
 const msg=$('message');if(msg){const grow=()=>{msg.style.height='auto';msg.style.height=Math.min(msg.scrollHeight,240)+'px';};msg.addEventListener('input',grow);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else setTimeout(init,0);
