// Navigation owns presentation only. Account and model permissions stay in their modules.
export function createNavigation({account,onLanguage}){
 const $=id=>document.getElementById(id), make=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const rail=make('aside');rail.id='navigation';rail.className='navigation';rail.setAttribute('aria-label','MalGuard navigation');
 const head=make('div');head.className='navigation-heading';head.append($('mode-picker'));
 const collapse=make('button','☰');collapse.type='button';collapse.id='navigation-toggle';collapse.setAttribute('aria-label','Toggle sidebar');collapse.setAttribute('aria-expanded','true');collapse.setAttribute('aria-controls','navigation');
 const toggle=()=>{const closed=document.body.classList.toggle('navigation-closed');collapse.setAttribute('aria-expanded',String(!closed));};collapse.onclick=toggle;
 const hide=(restoreFocus=true)=>{document.body.classList.add('navigation-closed');collapse.setAttribute('aria-expanded','false');if(restoreFocus)collapse.focus();};
 const dismiss=make('button','×');dismiss.type='button';dismiss.className='navigation-dismiss';dismiss.setAttribute('aria-label','Close sidebar');dismiss.onclick=hide;head.append(dismiss);
 const backdrop=make('button');backdrop.type='button';backdrop.id='navigation-backdrop';backdrop.setAttribute('aria-label','Close navigation');backdrop.tabIndex=-1;backdrop.onclick=hide;document.body.prepend(backdrop);
 document.querySelector('.site-header').prepend(collapse);
 const fresh=$('clear');fresh.replaceChildren(make('span','＋'),make('span','New chat'));fresh.className='navigation-new';
 fresh.addEventListener('click',()=>{if(innerWidth<=760){document.body.classList.add('navigation-closed');collapse.setAttribute('aria-expanded','false');}});
 const search=make('input');search.type='search';search.placeholder='Search chats';search.setAttribute('aria-label','Search chats');search.id='chat-search';search.setAttribute('aria-keyshortcuts','Control+K Meta+K');search.title='Search chats · Ctrl/⌘ + K';
 const shortcuts=make('nav');shortcuts.className='navigation-shortcuts';shortcuts.setAttribute('aria-label','MalGuard AI workspaces');
 const shortcutsLabel=make('span','WORKSPACES');shortcutsLabel.className='navigation-shortcuts-label';shortcuts.append(shortcutsLabel);
 const modes=[['chat','Chat','◎','chat-tab'],['worker','Work','◇','workspace-tab'],['build','Code','⌘','build-tab']];
 const shortcutButtons=new Map();
 for(const [mode,title,glyph,target] of modes){
  const button=make('button');button.type='button';button.className='navigation-shortcut';button.dataset.mode=mode;button.id='navigation-mode-'+mode;
  const icon=make('span',glyph);icon.className='shortcut-glyph';icon.setAttribute('aria-hidden','true');
  const name=make('span',title);name.className='shortcut-name';button.append(icon,name);
  button.setAttribute('aria-pressed',String(mode==='chat'));
  button.onclick=()=>{if(button.disabled)return;$(target).click();if(innerWidth<=760){hide(false);$('message')?.focus({preventScroll:true});}};
  shortcuts.append(button);shortcutButtons.set(mode,{button,name});
 }
 const label=make('h2','Recent chats');label.className='navigation-label';const chats=make('div');chats.id='saved-chats';
 const empty=make('p','Sign in to save and revisit your chats.');empty.id='history-status';empty.className='navigation-note';
 const footer=make('div');footer.className='navigation-footer';
 const settings=$('settings-panel');const settingsLabel=make('span','Settings');settingsLabel.dataset.i18n='settings';settings.querySelector('summary').append(settingsLabel);const settingsSummary=settings.querySelector('summary');settingsSummary.setAttribute('aria-label','Settings');
 settings.addEventListener('toggle',()=>{if(settings.open){document.body.classList.remove('navigation-closed');collapse.setAttribute('aria-expanded','true');}});
 const general=make('section');general.className='settings-general';const settingsHeading=make('h2','Settings');general.append(settingsHeading);
 const settingsClose=make('button','Close settings');settingsClose.type='button';settingsClose.id='settings-close';settingsClose.onclick=()=>{settings.open=false;if(innerWidth<=760)hide();else collapse.focus();};general.prepend(settingsClose);
 const settingsContent=settings.querySelector('.settings-content');settingsContent.setAttribute('role','dialog');settingsContent.setAttribute('aria-modal','true');settingsContent.setAttribute('aria-label','Settings');
 settings.addEventListener('toggle',()=>{if(settings.open)settingsClose.focus();});
 settingsContent.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const focusable=[...settingsContent.querySelectorAll('button,input,select,summary,a[href]')].filter(n=>!n.disabled&&n.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}});
 const select=make('select'); select.value='en';
 // Retain the existing accessible language action for compatibility, inside settings.
 $('language').hidden=true;general.append($('language'));settings.querySelector('.settings-content').prepend(general);
 const plugins=make('details');plugins.className='plugins-panel';plugins.append(make('summary','Tools & connections'));
 const pluginsNotice=make('p','Check tool availability in Work. Only the live service can confirm a connection.');plugins.append(pluginsNotice);settings.querySelector('.settings-content').append(plugins);
 footer.append(settings);
 const help=make('a','Help & shortcuts');help.href='/ai/help/';footer.append(help);
 const home=make('a','MalGuard home');home.href='/';footer.append(home);
 rail.append(head,fresh,shortcuts,search,label,chats,empty,footer);document.body.prepend(rail);
 const signup=make('button','Sign up');signup.type='button';signup.id='sign-up';signup.onclick=()=>account.open(true);$('account').after(signup);
 document.querySelector('.mode-home')?.remove();
 document.querySelector('.mode-options').addEventListener('click',event=>{if(event.target.closest('button')&&innerWidth<=760){document.body.classList.add('navigation-closed');collapse.setAttribute('aria-expanded','false');}});
 document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(settings.open){settings.open=false;settings.querySelector('summary').focus();return;}if(innerWidth<=760&&!document.body.classList.contains('navigation-closed'))hide();});
 if(innerWidth<=760){document.body.classList.add('navigation-closed');collapse.setAttribute('aria-expanded','false');}
 return {
  profile(p){signup.hidden=!!p;empty.textContent=p?'Your chats are saved to your account.':'Sign in to save and revisit your chats.';},
  language(value){
    select.value=value;
    const fa=value==='fa';
    shortcutsLabel.textContent=fa?'بخش‌ها':'WORKSPACES';
    shortcuts.setAttribute('aria-label',fa?'بخش‌های مالگارد':'MalGuard AI workspaces');
    for(const [mode,{name,button}] of shortcutButtons){
      name.textContent=fa?({chat:'گفت‌وگو',worker:'کار',build:'کد'}[mode]):({chat:'Chat',worker:'Work',build:'Code'}[mode]);
      button.setAttribute('aria-label',name.textContent);
    }
    search.placeholder=fa?'جست‌وجوی گفتگوها':'Search chats';
    search.setAttribute('aria-label',fa?'جست‌وجوی گفتگوها':'Search chats');
    plugins.querySelector('summary').textContent=fa?'ابزارها و اتصال‌ها':'Tools & connections';
    pluginsNotice.textContent=fa?'وضعیت واقعی اتصال ابزارها را در بخش کار بررسی کنید. فقط سرویس فعال می‌تواند اتصال را تأیید کند.':'Check tool availability in Work. Only the live service can confirm a connection.';
    label.textContent=fa?'گفتگوهای اخیر':'Recent chats';
    help.textContent=fa?'راهنما و میان‌برها':'Help & shortcuts';
    home.textContent=fa?'صفحه اصلی MalGuard':'MalGuard home';
    fresh.lastElementChild.textContent=fa?'گفتگوی جدید':'New chat';
    const settingsWord=fa?'تنظیمات':'Settings';
    settingsLabel.textContent=settingsWord;
    settingsSummary.setAttribute('aria-label',settingsWord);
    settingsHeading.textContent=settingsWord;
    settingsClose.textContent=fa?'بستن تنظیمات':'Close settings';
    settingsContent.setAttribute('aria-label',settingsWord);
  }
};
}
