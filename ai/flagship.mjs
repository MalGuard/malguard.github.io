import {highlightCode,codeLanguage} from './code-view.mjs?v=flagship-20261109';

export const VIEWS = {
 home: ['Home','How can MalGuard AI help today?','Your all-in-one AI assistant for work, conversation, and building.'],
 worker: ['Work','Work faster with AI','Analyze information, research with sources, and turn ideas into action.'],
 chat: ['Chat','Chat','A natural conversation for ideas, answers, and everyday help.'],
 build: ['Code','Code with MalGuard AI','Build, debug, and improve code with your AI coding assistant.']
};
const paths={home:'m3 10 9-7 9 7v11h-6v-7H9v7H3Z',worker:'M9 6V3h6v3M3 10h18M3 6h18v15H3ZM10 10v3h4v-3',chat:'M21 11a8 8 0 0 1-8 8H8l-5 3 1-7a8 8 0 1 1 17-4Z',build:'m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18',library:'m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5',file:'M14 2H5v20h14V7Zm0 0v6h5M8 12h8M8 16h8',search:'M21 21l-6-6M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',plan:'M3 5h18v17H3ZM7 2v6m10-6v6M3 11h18',image:'M3 3h18v18H3Zm0 14 5-5 4 4 4-6 5 7M7 7h1',attach:'m8 13 7-7a3 3 0 0 1 4 4l-9 9a5 5 0 0 1-7-7L13 2',tools:'M3 3h6v6H3Zm12 0h6v6h-6ZM3 15h6v6H3Zm12 0h6v6h-6Z'};
const $=id=>document.getElementById(id);
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const [k,v] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.6','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(k,v);const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',paths[name]||paths.chat);svg.append(p);return svg;}
function button(label,action,name){const b=make('button');b.type='button';if(name)b.append(icon(name));b.append(make('span',label));b.onclick=action;return b;}
let ui;

export function installFlagship({navigate}){
 if(ui)return;
 ui={navigate,view:'home',busy:false};
 document.body.classList.add('mg-flagship');
 const intro=document.querySelector('.intro');
 const mark=make('img',null,'flagship-mark');mark.src='./malguard-ai-orbit.svg';mark.width=72;mark.height=72;mark.alt='';intro.prepend(mark);
 const subtitle=make('p',null,'flagship-subtitle');subtitle.id='flagship-subtitle';$('title').after(subtitle);
 const modeCards=$('experience-tabs');modeCards.replaceChildren();modeCards.className='flagship-modes';modeCards.setAttribute('aria-label','Choose your workspace');
 for(const mode of ['worker','chat','build']){
  const b=button(VIEWS[mode][0],()=>navigate(mode),mode);b.dataset.flagshipView=mode;b.id='experience-'+mode;b.setAttribute('aria-label',VIEWS[mode][0]);
  b.append(make('small',({worker:'For research, analysis, and productivity.',chat:'For conversation, ideas, and everyday help.',build:'For coding, debugging, and technical building.'})[mode]));modeCards.append(b);
 }
 intro.after(modeCards);
 const home=button('Home',()=>navigate('home'),'home');home.id='navigation-mode-home';home.className='navigation-shortcut';home.dataset.flagshipView='home';
 document.querySelector('.navigation-shortcuts-label').after(home);
 for(const mode of ['worker','chat','build']){const b=$('navigation-mode-'+mode);b.querySelector('.shortcut-glyph').replaceChildren(icon(mode));b.dataset.flagshipView=mode;}
 const brand=$('mode-toggle').querySelector('strong');brand.textContent='MalGuard AI';
 const mobileBrand=make('a',null,'flagship-mobile-brand');mobileBrand.href='#home';mobileBrand.setAttribute('aria-label','MalGuard AI Home');mobileBrand.onclick=e=>{e.preventDefault();navigate('home');};
 const logo=mark.cloneNode();logo.className='';logo.width=32;logo.height=32;mobileBrand.append(logo,make('strong','MalGuard AI'));$('navigation-toggle').after(mobileBrand);
 const dock=make('nav',null,'flagship-dock');dock.setAttribute('aria-label','Primary navigation');
 for(const mode of ['home','worker','chat','build']){const b=button(VIEWS[mode][0],()=>navigate(mode),mode);b.dataset.flagshipView=mode;dock.append(b);}
 const openLibrary=()=>{if(document.body.classList.contains('navigation-closed'))$('navigation-toggle').click();$('chat-search').focus();};
 dock.append(button('Library',openLibrary,'library'));document.body.append(dock);

 const fill=(value,mode)=>{if(ui.busy)return;if(mode)navigate(mode);$('message').value=value;$('message').dispatchEvent(new Event('input',{bubbles:true}));$('message').focus();};
 const actions=make('div',null,'flagship-actions');actions.id='flagship-actions';
 actions.append(button('Analyze a file',()=>{navigate('worker');$('attach-file').click();},'file'));
 const research=button('Web research',()=>{navigate('worker');if(!$('web-search-toggle').disabled){if($('web-search-toggle').getAttribute('aria-pressed')!=='true')$('web-search-toggle').click();fill('Research the following topic and cite your sources: ');}else if(!$('workspace-tool').querySelector('[value="ai_web"]').disabled){$('workspace-tool').value='ai_web';$('workspace-tool').dispatchEvent(new Event('change'));fill('Research: ');}else{$('flagship-action-status').textContent='Web research is unavailable for the current connection. Check tool availability in Settings.';}},'search');actions.append(research);
 const generate=button('Generate an image',()=>{navigate('chat');$('attach-media-generate').click();},'image');generate.id='flagship-generate';actions.append(generate);
 actions.append(button('Plan a project',()=>fill('Help me plan a project. Ask about my goal, deadline, and resources, then propose milestones and next steps.','worker'),'plan'));
 document.querySelector('.composer-area').after(actions);
 const actionStatus=make('p',null,'muted');actionStatus.id='flagship-action-status';actionStatus.setAttribute('role','status');actions.after(actionStatus);
 const work=make('section',null,'flagship-work');work.setAttribute('aria-label','Work quick actions');work.id='flagship-work';
 for(const [name,desc,glyph,action] of [
  ['Document analysis','Summarize pasted document text. PDF and DOCX extraction is not available.','file',()=>fill('Summarize the text below. Identify key findings, open questions, and next steps:\n\n')],
  ['Research','Explore public sources with citations and transparent search consent.','search',()=>research.click()],
  ['Project planning','Turn your goal into a practical plan with milestones and priorities.','plan',()=>actions.lastElementChild.click()],
  ['Security analysis','Inspect a file, URL, or hash. Review evidence and limitations.','library',()=>{$('workspace-panel').scrollIntoView({block:'center'});$('workspace-tool').focus();}]
 ]){const b=button(name,action,glyph);b.append(make('p',desc));work.append(b);}
 modeCards.after(work);
 $('conversation').before($('workspace-panel'));
 const codeActions=make('div',null,'flagship-code-actions');codeActions.id='flagship-code-actions';
 for(const [name,prompt] of [['Explain','Explain this code, including inputs, outputs, and edge cases.'],['Debug','Review this code for bugs. Explain each issue and propose a fix.'],['Refactor','Suggest a refactoring of this code, preserving its behavior. Show changes for review.'],['Generate tests','Generate meaningful tests for this code, including edge cases. Do not claim they have run.']]){
  codeActions.append(button(name,()=>{fill(prompt);$('flagship-code-notice').textContent='To share the selected file, enable “Include the currently selected file” below the editor, then send.';},'build'));
 }
 const notice=make('p',null,'muted');notice.id='flagship-code-notice';notice.setAttribute('role','status');codeActions.append(notice);$('build-panel').after(codeActions);
 const attach=button('Attach',()=>$('attach-file').click(),'attach');attach.id='flagship-attach';attach.setAttribute('aria-label','Attach a file');document.querySelector('.composer-actions').prepend(attach);
 const tools=make('span','Tools');tools.className='flagship-tools-label';$('attach-toggle').append(tools);
 $('attach-toggle').querySelector('svg').replaceWith(icon('tools'));
 installEditor();
 const updateMedia=()=>{generate.disabled=ui.busy||$('attach-media-generate').hidden||$('attach-media-generate').disabled;generate.title=generate.disabled?'Image generation is unavailable for the current connection.':'Create an image with the connected provider';};
 new MutationObserver(updateMedia).observe($('attach-media-generate'),{attributes:true,attributeFilter:['hidden','disabled']});ui.updateMedia=updateMedia;
 const online=make('p',null,'flagship-network');online.id='flagship-network';online.setAttribute('role','status');document.querySelector('.composer-area').prepend(online);
 const connection=()=>{online.hidden=navigator.onLine;online.textContent='You’re offline. Your current text is still here. Reconnect before sending.';};addEventListener('online',connection);addEventListener('offline',connection);connection();
 // The existing app remains the only owner of model, consent and network state.
 syncFlagship({view:'home',busy:false});
}

export function syncFlagship({view,busy}){
 if(!ui)return;ui.view=Object.hasOwn(VIEWS,view)?view:'chat';ui.busy=busy;
 document.body.dataset.view=ui.view;
 $('title').textContent=VIEWS[ui.view][1];$('flagship-subtitle').textContent=VIEWS[ui.view][2];
 for(const b of document.querySelectorAll('[data-flagship-view]')){b.setAttribute('aria-pressed',String(b.dataset.flagshipView===ui.view));b.disabled=busy;}
 for(const b of document.querySelectorAll('.flagship-actions button,.flagship-work button,.flagship-code-actions button,.flagship-dock button'))b.disabled=busy;
 $('flagship-attach').disabled=busy;$('flagship-work').hidden=ui.view!=='worker';$('flagship-actions').hidden=!['home','worker'].includes(ui.view);$('flagship-code-actions').hidden=ui.view!=='build';
 ui.updateMedia();
}

function installEditor(){
 const editor=$('build-editor'),select=$('build-file');
 const tabs=make('div',null,'flagship-file-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Project files');document.querySelector('.editor-pane').prepend(tabs);
 const surface=make('div',null,'flagship-editor');editor.before(surface);
 const syntax=make('pre',null,'flagship-syntax');syntax.setAttribute('aria-hidden','true');surface.append(syntax,editor);
 const paint=()=>{highlightCode(syntax,editor.value+'\n',codeLanguage(select.value));syntax.scrollTop=editor.scrollTop;syntax.scrollLeft=editor.scrollLeft;};
 const draw=()=>{const focused=tabs.contains(document.activeElement)?document.activeElement.textContent:null;tabs.replaceChildren();for(const option of select.options){const b=button(option.value,()=>{select.value=option.value;select.dispatchEvent(new Event('change'));draw();});b.setAttribute('aria-pressed',String(option.value===select.value));tabs.append(b);if(focused===option.value)b.focus();}paint();};
 editor.addEventListener('input',paint);editor.addEventListener('scroll',()=>{syntax.scrollTop=editor.scrollTop;syntax.scrollLeft=editor.scrollLeft;},{passive:true});
 select.addEventListener('change',draw);new MutationObserver(draw).observe(select,{childList:true});
 // Tab must remain a keyboard navigation key; indentation is explicit Ctrl/Cmd+].
 editor.addEventListener('keydown',e=>{if(e.key===']'&&(e.ctrlKey||e.metaKey)){e.preventDefault();editor.setRangeText('  ',editor.selectionStart,editor.selectionEnd,'end');editor.dispatchEvent(new Event('input'));}});
 draw();
}
