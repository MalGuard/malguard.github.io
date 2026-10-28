// Navigation owns presentation only. Account and model permissions stay in their modules.
export function createNavigation({account,onLanguage}){
 const $=id=>document.getElementById(id), make=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const rail=make('aside');rail.id='navigation';rail.className='navigation';rail.setAttribute('aria-label','MalGuard navigation');
 const head=make('div');head.className='navigation-heading';head.append($('mode-picker'));
 const collapse=make('button','☰');collapse.type='button';collapse.id='navigation-toggle';collapse.setAttribute('aria-label','Toggle sidebar');collapse.setAttribute('aria-expanded','true');
 const toggle=()=>{const closed=document.body.classList.toggle('navigation-closed');collapse.setAttribute('aria-expanded',String(!closed));};collapse.onclick=toggle;
 const hide=()=>{document.body.classList.add('navigation-closed');collapse.setAttribute('aria-expanded','false');collapse.focus();};
 const dismiss=make('button','×');dismiss.type='button';dismiss.className='navigation-dismiss';dismiss.setAttribute('aria-label','Close sidebar');dismiss.onclick=hide;head.append(dismiss);
 const backdrop=make('button');backdrop.type='button';backdrop.id='navigation-backdrop';backdrop.setAttribute('aria-label','Close navigation');backdrop.tabIndex=-1;backdrop.onclick=hide;document.body.prepend(backdrop);
 document.querySelector('.site-header').prepend(collapse);
 const fresh=$('clear');fresh.replaceChildren(make('span','＋'),make('span','New chat'));fresh.className='navigation-new';
 fresh.addEventListener('click',()=>{if(innerWidth<=760){document.body.classList.add('navigation-closed');collapse.setAttribute('aria-expanded','false');}});
 const search=make('input');search.type='search';search.placeholder='Search chats';search.setAttribute('aria-label','Search chats');search.id='chat-search';
 const label=make('h2','Recent chats');label.className='navigation-label';const chats=make('div');chats.id='saved-chats';
 const empty=make('p','Sign in to save and revisit your chats.');empty.id='history-status';empty.className='navigation-note';
 const footer=make('div');footer.className='navigation-footer';
 const settings=$('settings-panel');settings.querySelector('summary').append(make('span','Settings'));
 settings.addEventListener('toggle',()=>{if(settings.open){document.body.classList.remove('navigation-closed');collapse.setAttribute('aria-expanded','true');}});
 const general=make('section');general.className='settings-general';general.append(make('h2','Settings'));
 const settingsClose=make('button','Close settings');settingsClose.type='button';settingsClose.id='settings-close';settingsClose.onclick=()=>{settings.open=false;if(innerWidth<=760)hide();else collapse.focus();};general.prepend(settingsClose);
 const settingsContent=settings.querySelector('.settings-content');settingsContent.setAttribute('role','dialog');settingsContent.setAttribute('aria-modal','true');settingsContent.setAttribute('aria-label','Settings');
 settings.addEventListener('toggle',()=>{if(settings.open)settingsClose.focus();});
 settingsContent.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const focusable=[...settingsContent.querySelectorAll('button,input,select,summary,a[href]')].filter(n=>!n.disabled&&n.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}});
 const select=make('select'); select.value='en';
 // Retain the existing accessible language action for compatibility, inside settings.
 $('language').hidden=true;general.append($('language'));settings.querySelector('.settings-content').prepend(general);
 const plugins=make('details');plugins.className='plugins-panel';plugins.append(make('summary','Plugins & connections'));plugins.append(make('p','Security tools are available in MalGuard Work. Each tool shows its actual connection status.'));
 for(const name of ['GitHub','Notion'])plugins.append(make('p',`${name} · Not connected`));settings.querySelector('.settings-content').append(plugins);
 footer.append(settings);const home=make('a','MalGuard home');home.href='/';footer.append(home);rail.append(head,fresh,search,label,chats,empty,footer);document.body.prepend(rail);
 const signup=make('button','Sign up');signup.type='button';signup.id='sign-up';signup.onclick=()=>account.open(true);$('account').after(signup);
 document.querySelector('.mode-home')?.remove();
 document.querySelector('.mode-options').addEventListener('click',event=>{if(event.target.closest('button')&&innerWidth<=760){document.body.classList.add('navigation-closed');collapse.setAttribute('aria-expanded','false');}});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&innerWidth<=760){document.body.classList.add('navigation-closed');collapse.setAttribute('aria-expanded','false');}});
 if(innerWidth<=760){document.body.classList.add('navigation-closed');collapse.setAttribute('aria-expanded','false');}
 return {profile(p){signup.hidden=!!p;empty.textContent=p?'Your account is connected. Sign in again after reopening this page to retrieve saved chats.':'Sign in to save and revisit your chats.';},language(value){select.value=value;}};
}
