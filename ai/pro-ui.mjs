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
 const chev=document.createElementNS('http://www.w3.org/2000/svg','svg');chev.setAttribute('viewBox','0 0 24 24');chev.setAttribute('class','pro-chev');
 const chevPath=document.createElementNS('http://www.w3.org/2000/svg','path');chevPath.setAttribute('d','m7 10 5 5 5-5');chevPath.setAttribute('fill','none');chevPath.setAttribute('stroke','currentColor');chevPath.setAttribute('stroke-width','1.8');chevPath.setAttribute('stroke-linecap','round');chevPath.setAttribute('stroke-linejoin','round');chev.append(chevPath);
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
function t(en,faText){return fa()?faText:en;}
function move(node,into){if(node)into.append(node);return node;}
function asSwitch(label){if(!label||label.dataset.proSwitch)return label;label.dataset.proSwitch='1';label.classList.add('pro-switch');return label;}
function enhanceSettings(){
 const panel=$('settings-panel'),content=panel?.querySelector('.settings-content');
 if(!panel||!content)return;
 if(panel.dataset.proSettings){const dlg=$('pro-settings');const g=dlg&&$('pro-pane-general');const plugins=content.querySelector('.plugins-panel');if(g&&plugins)g.append(plugins);content.querySelector('.settings-general')?.setAttribute('hidden','');return;}
 panel.dataset.proSettings='1';
 const dlg=make('dialog','pro-settings');dlg.id='pro-settings';dlg.setAttribute('aria-modal','true');dlg.setAttribute('aria-labelledby','pro-settings-title');
 const head=make('div','pro-settings-head');
 const title=make('h2','pro-settings-title');title.id='pro-settings-title';
 const close=make('button','pro-settings-close');close.type='button';
 const x=document.createElementNS('http://www.w3.org/2000/svg','svg');x.setAttribute('width','20');x.setAttribute('height','20');x.setAttribute('viewBox','0 0 24 24');x.setAttribute('fill','none');x.setAttribute('aria-hidden','true');
 const xp=document.createElementNS('http://www.w3.org/2000/svg','path');xp.setAttribute('d','M6 6l12 12M18 6 6 18');xp.setAttribute('stroke','currentColor');xp.setAttribute('stroke-width','1.8');xp.setAttribute('stroke-linecap','round');x.append(xp);close.append(x);
 close.onclick=()=>dlg.close();head.append(title,close);
 const tabs=make('div','pro-settings-tabs');tabs.setAttribute('role','tablist');
 const body=make('div','pro-settings-body');
 const IDS=['general','appearance','models','account','data'];
 const NAMES={general:['General','عمومی'],appearance:['Appearance','ظاهر'],models:['Models','مدل‌ها'],account:['Account','حساب'],data:['Data','داده‌ها']};
 const tabBtn={},paneEl={};let current='general';
 const showTab=id=>{current=id;IDS.forEach(k=>{tabBtn[k].classList.toggle('is-active',k===id);tabBtn[k].setAttribute('aria-selected',String(k===id));tabBtn[k].tabIndex=k===id?0:-1;paneEl[k].hidden=k!==id;});};
 for(const id of IDS){
  const b=make('button','pro-settings-tab');b.type='button';b.setAttribute('role','tab');b.id='pro-tab-'+id;b.onclick=()=>showTab(id);tabs.append(b);tabBtn[id]=b;
  const p=make('section','pro-settings-pane');p.id='pro-pane-'+id;p.setAttribute('role','tabpanel');p.setAttribute('aria-labelledby','pro-tab-'+id);body.append(p);paneEl[id]=p;
 }
 const g=paneEl.general;move($('device-note'),g);move($('connection'),g);
 const modeBox=content.querySelector('.composer-controls')||$('mode')?.closest('.composer-controls');if(modeBox)g.append(modeBox);
 move($('mode-hint'),g);move($('toolbox'),g);const plugins=content.querySelector('.plugins-panel');if(plugins)g.append(plugins);
 const a=paneEl.appearance;
 const themeOpts=[['auto','Auto','خودکار'],['light','Day','روز'],['dark','Night','شب']];
 const themeSeg=make('div','pro-seg');themeSeg.id='pro-theme-seg';themeSeg.setAttribute('role','radiogroup');
 const themeBtns=[];
 const themeMode=()=>{try{return localStorage.getItem('malguard-theme')||'auto';}catch{return 'auto';}};
 const syncThemeSeg=()=>{const cur=themeMode();themeBtns.forEach(b=>{const on=b.dataset.value===cur;b.setAttribute('aria-checked',String(on));b.classList.toggle('is-active',on);});};
 const applyTheme=mode=>{const btn=$('mgThemeToggle');if(btn){let n=0;while((btn.dataset.mode||'auto')!==mode&&n++<4)btn.click();}else{try{localStorage.setItem('malguard-theme',mode);}catch{}}syncThemeSeg();};
 for(const [value] of themeOpts){const b=make('button','pro-seg-btn');b.type='button';b.dataset.value=value;b.setAttribute('role','radio');b.onclick=()=>applyTheme(value);themeSeg.append(b);themeBtns.push(b);}
 const themeMeta=make('div','pro-set-meta');themeMeta.append(make('div','pro-set-label'),make('p','pro-set-hint'));
 const themeRow=make('div','pro-set-row');themeRow.append(themeMeta,themeSeg);a.append(themeRow);
 const langSeg=make('div','pro-seg');langSeg.setAttribute('role','radiogroup');
 const langEn=make('button','pro-seg-btn');langEn.type='button';langEn.dataset.value='en';langEn.setAttribute('role','radio');
 const langFa=make('button','pro-seg-btn');langFa.type='button';langFa.dataset.value='fa';langFa.setAttribute('role','radio');
 const syncLangSeg=()=>{const cur=fa()?'fa':'en';[langEn,langFa].forEach(b=>{const on=b.dataset.value===cur;b.setAttribute('aria-checked',String(on));b.classList.toggle('is-active',on);});};
 const setLang=v=>{if((v==='fa')!==fa())$('language')?.click();syncLangSeg();};
 langEn.onclick=()=>setLang('en');langFa.onclick=()=>setLang('fa');langSeg.append(langEn,langFa);
 const langMeta=make('div','pro-set-meta');langMeta.append(make('div','pro-set-label'),make('p','pro-set-hint'));
 const langRow=make('div','pro-set-row');langRow.append(langMeta,langSeg);a.append(langRow);move($('language'),a);
 const mo=paneEl.models;move($('model-status'),mo);move($('local-status'),mo);
 const modelActions=make('div','pro-set-actions');move($('manage-models'),modelActions);move($('manage-desktop-models'),modelActions);move($('remove-models'),modelActions);mo.append(modelActions);move(content.querySelector('.notice'),mo);
 const acc=paneEl.account;const accStatus=make('p','pro-set-hint');accStatus.id='pro-account-status';
 const accActions=make('div','pro-set-actions');const accIn=make('button','pro-set-btn');accIn.type='button';const accUp=make('button','pro-set-btn');accUp.type='button';
 accIn.onclick=()=>{dlg.close();$('account')?.click();};accUp.onclick=()=>{dlg.close();($('sign-up')||$('account'))?.click();};
 accActions.append(accIn,accUp);acc.append(accStatus,accActions);
 const d=paneEl.data;const perm=$('permissions');
 if(perm){const intro=make('p','pro-set-hint');intro.id='pro-perm-intro';d.append(intro);perm.querySelectorAll('label').forEach(asSwitch);move(perm.querySelector('fieldset'),d);move($('revoke-permissions'),d);perm.hidden=true;}
 move(content.querySelector('.footer-note'),d);move(content.querySelector('.privacy-link'),d);
 content.querySelector('.settings-general')?.setAttribute('hidden','');
 $('revoke-permissions')?.classList.add('pro-set-btn','danger');
 for(const id of ['manage-models','manage-desktop-models','remove-models'])$(id)?.classList.add('pro-set-btn');
 dlg.append(head,tabs,body);document.body.append(dlg);
 const relabel=()=>{
  title.textContent=t('Settings','تنظیمات');close.setAttribute('aria-label',t('Close settings','بستن تنظیمات'));
  IDS.forEach(id=>tabBtn[id].textContent=t(...NAMES[id]));
  themeMeta.querySelector('.pro-set-label').textContent=t('Theme','تم');
  themeMeta.querySelector('.pro-set-hint').textContent=t('Day, night, or automatic by local sunrise.','روز، شب، یا خودکار بر اساس طلوع محلی.');
  themeBtns.forEach((b,i)=>b.textContent=t(themeOpts[i][1],themeOpts[i][2]));
  langMeta.querySelector('.pro-set-label').textContent=t('Language','زبان');
  langMeta.querySelector('.pro-set-hint').textContent=t('Applies to the MalGuard AI interface.','روی رابط MalGuard AI اعمال می‌شود.');
  langEn.textContent='English';langFa.textContent='فارسی';
  const signed=($('account')?.textContent||'').trim();
  const isIn=!!signed&&!/sign in|ورود/i.test(signed);
  accStatus.textContent=isIn?t('Signed in as '+signed,'وارد شده‌اید: '+signed):t('You are signed out. Sign in to save chats to your account.','خارج هستید. برای ذخیرهٔ گفتگوها وارد حساب شوید.');
  accIn.textContent=isIn?t('Manage account','مدیریت حساب'):t('Sign in','ورود');
  accUp.textContent=t('Create account','ساخت حساب');accUp.hidden=!!isIn;
  const intro=$('pro-perm-intro');if(intro)intro.textContent=t('Permissions are saved on this device and can be revoked at any time.','مجوزها روی همین دستگاه ذخیره می‌شوند و هر زمان قابل لغو هستند.');
  syncThemeSeg();syncLangSeg();
 };
 const openPro=tab=>{relabel();showTab(tab||($('permissions')?.open?'data':'general'));if(!dlg.open)dlg.showModal();tabBtn[current]?.focus();};
 panel.addEventListener('toggle',()=>{if(panel.open)openPro($('permissions')?.open?'data':undefined);else if(dlg.open)dlg.close();});
 dlg.addEventListener('close',()=>{if(panel.open)panel.open=false;});
 document.addEventListener('pointerdown',e=>{if(e.target.closest('#pro-settings'))e.stopPropagation();},true);
 if(panel.open)openPro();
 new MutationObserver(relabel).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
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
 document.querySelectorAll('.isolation-permission,.build-share,#permissions label').forEach(asSwitch);
 enhanceSettings();setTimeout(enhanceSettings,0);setTimeout(enhanceSettings,120);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else setTimeout(init,0);
