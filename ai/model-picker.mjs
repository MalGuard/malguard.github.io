// Presentation adapter: the existing selects remain the only source of model availability.
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
let picker;
export function modelOptionDescription(option,mode){
 if(option.disabled)return 'Unavailable in this session';
 if(option.value==='__downloads')return 'Download and manage on-device models';
 if(option.value==='__desktop')return 'Connect models running in Ollama';
 if(option.value.endsWith('_auto'))return 'Automatic model routing for '+mode;
 if(option.value.startsWith('local_'))return 'On-device model · browser';
 if(option.value.startsWith('native_'))return 'Local model · Ollama';
 return option.textContent.split(' · ').slice(1).join(' · ')||'Cloud model · '+mode;
}
export function installModelPicker(){
 if(picker)return;
 const dialog=make('dialog',null,'model-picker-dialog');dialog.id='model-picker-dialog';dialog.setAttribute('aria-labelledby','model-picker-title');
 const heading=make('div',null,'model-picker-heading'),title=make('h2','Choose a model');title.id='model-picker-title';
 const close=make('button','×','model-picker-close');close.type='button';close.setAttribute('aria-label','Close model selector');close.onclick=()=>dialog.close();heading.append(title,close);
 const search=make('input',null,'model-picker-search');search.type='search';search.placeholder='Find a model…';search.setAttribute('aria-label','Find a model');
 const list=make('div',null,'model-picker-list');list.setAttribute('role','group');list.setAttribute('aria-label','Available model choices');
 const status=make('p',null,'model-picker-empty');status.setAttribute('role','status');
 const retry=make('button','Retry cloud connection','model-picker-retry');retry.type='button';retry.onclick=()=>{dialog.close();document.getElementById('retry-cloud')?.click();};
 dialog.append(heading,search,list,status,retry);document.body.append(dialog);
 picker={dialog,search,list,status,retry,bindings:[],active:null,busy:false,mode:'Chat'};
 for(const id of ['model','workspace-model']){
  const select=document.getElementById(id),parent=select.parentElement;
  parent.classList.add('model-picker-ready');select.setAttribute('aria-hidden','true');select.tabIndex=-1;
  const trigger=make('button',null,'model-picker-trigger');trigger.id=id+'-picker-trigger';trigger.type='button';trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls',dialog.id);trigger.setAttribute('aria-expanded','false');
  const mark=make('img');mark.src='./malguard-ai-orbit.svg';mark.width=20;mark.height=20;mark.alt='';
  const copy=make('span',null,'model-picker-copy'),label=make('span',null,'model-picker-label'),detail=make('small',null,'model-picker-status');copy.append(label,detail);
  const chevron=make('span','⌄','model-picker-chevron');chevron.setAttribute('aria-hidden','true');trigger.append(mark,copy,chevron);parent.append(trigger);
  const binding={select,trigger,label,detail};picker.bindings.push(binding);
  trigger.onclick=()=>{if(trigger.disabled)return;picker.active=binding;search.value='';draw();trigger.setAttribute('aria-expanded','true');dialog.showModal();search.focus();};
  select.addEventListener('change',()=>refreshModelPicker());
  new MutationObserver(()=>{refreshModelPicker();if(dialog.open&&picker.active===binding)draw();}).observe(select,{childList:true,subtree:true,attributes:true,characterData:true});
 }
 search.oninput=draw;
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
 dialog.addEventListener('close',()=>{for(const b of picker.bindings)b.trigger.setAttribute('aria-expanded','false');picker.active?.trigger.focus({preventScroll:true});});
 dialog.addEventListener('keydown',event=>{
  if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
  if(event.target===search&&event.key!=='ArrowDown')return;
  const choices=[...list.querySelectorAll('button:not(:disabled)')];if(!choices.length)return;
  event.preventDefault();let i=choices.indexOf(document.activeElement);i=event.key==='Home'?0:event.key==='End'?choices.length-1:event.key==='ArrowUp'?(i-1+choices.length)%choices.length:(i+1)%choices.length;choices[i].focus();
 });
 refreshModelPicker();
}
export function refreshModelPicker({busy,mode}={}){
 if(!picker)return;if(typeof busy==='boolean')picker.busy=busy;if(mode)picker.mode=mode;
 for(const b of picker.bindings){
  const option=b.select.selectedOptions[0],real=option?.value&&!option.value.startsWith('__'),available=real&&!option.disabled;
  b.label.textContent=real?option.textContent.split(' · ')[0]:'Choose model';
  b.detail.textContent=picker.busy?'Responding…':available?(option.value.endsWith('_auto')?'Automatic':'Selected'):'Check availability';
  b.trigger.disabled=picker.busy||b.select.disabled;b.trigger.setAttribute('aria-label','Choose model: '+b.label.textContent);b.trigger.dataset.available=String(!!available);
 }
 if(picker.dialog.open&&(picker.busy||picker.active?.select.closest('[hidden]')))picker.dialog.close();
}
function draw(){
 const {active,list,search,status,retry}=picker;if(!active)return;list.replaceChildren();
 const options=[...active.select.options].filter(o=>o.value&&o.textContent.trim()),query=search.value.trim().toLowerCase();
 let shown=0;for(const option of options){
  if(!option.textContent.toLowerCase().includes(query))continue;shown++;
  const row=make('button',null,'model-picker-option');row.type='button';row.disabled=option.disabled;row.dataset.modelId=option.value;row.setAttribute('aria-pressed',String(option.value===active.select.value));
  const icon=make('span',null,'model-option-icon'),img=make('img');img.src='./malguard-ai-orbit.svg';img.alt='';img.width=22;img.height=22;icon.append(img);
  const copy=make('span',null,'model-option-copy');copy.append(make('strong',option.textContent.split(' · ')[0]),make('small',modelOptionDescription(option,picker.mode)));
  const check=make('span',option.value===active.select.value?'✓':'','model-option-check');check.setAttribute('aria-hidden','true');row.append(icon,copy,check);
  row.onclick=()=>{if(row.disabled||active.select.disabled||picker.busy)return;picker.dialog.close();active.select.value=option.value;active.select.dispatchEvent(new Event('change',{bubbles:true}));refreshModelPicker();};list.append(row);
 }
 status.hidden=shown>0;status.textContent=options.length?'No models match your search.':'Cloud models could not be loaded. Retry the connection or manage local models in Tools.';
 retry.hidden=options.some(o=>!o.disabled&&!o.value.startsWith('__'));
}
