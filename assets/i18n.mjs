import {translations} from './i18n-catalog.mjs';

let locale='en';
try {if(localStorage.getItem('malguard-language')==='fa')locale='fa';} catch {}
export const language=()=>locale;
const originals=new WeakMap();
const attributes=new WeakMap();
const initialTitle=document.title;
const normalize=text=>text.replace(/\s+/g,' ').trim();
function translate() {
  document.documentElement.lang=locale;document.documentElement.dir=locale==='fa'?'rtl':'ltr';
  document.title=locale==='fa'?(translations[initialTitle]||initialTitle):initialTitle;
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()) {
    const node=walker.currentNode,parent=node.parentElement;
    if(!parent || parent.closest('script,style,code,pre,input,textarea,[data-i18n-dynamic],.mg-language,[contenteditable],[role=status],[aria-live]'))continue;
    if(!originals.has(node))originals.set(node,node.textContent);
    const original=originals.get(node),key=normalize(original);
    if(translations[key])node.textContent=locale==='fa'?translations[key]:original;
  }
  for(const item of document.querySelectorAll('[aria-label],[title]')) {
    if(item.closest('.mg-language'))continue;
    if(!attributes.has(item))attributes.set(item,{label:item.getAttribute('aria-label'),title:item.getAttribute('title')});
    const original=attributes.get(item);
    for(const [key,attr]of [['label','aria-label'],['title','title']]){
      const current=item.getAttribute(attr);
      if(current&&translations[current])original[key]=current;
    }
    for(const [attr,value]of [['aria-label',original.label],['title',original.title]])if(value&&translations[value]){
      const translated=locale==='fa'?translations[value]:value;
      if(item.getAttribute(attr)!==translated)item.setAttribute(attr,translated);
    }
  }
  for(const control of document.querySelectorAll('.mg-language select'))control.value=locale;
}
const wrapper=document.createElement('label');wrapper.className='mg-language';wrapper.setAttribute('aria-label','Language / زبان');
const selector=document.createElement('select');selector.setAttribute('aria-label','Language / زبان');
for(const [value,text]of [['en','English'],['fa','فارسی']]){const option=document.createElement('option');option.value=value;option.textContent=text;selector.append(option);}
selector.value=locale;wrapper.append(selector);(document.querySelector('.nav-actions')||document.body).append(wrapper);
function changeLanguage(value){locale=value==='fa'?'fa':'en';try{localStorage.setItem('malguard-language',locale);}catch{}translate();window.dispatchEvent(new Event('malguard-language'));}
selector.addEventListener('change',()=>changeLanguage(selector.value));
const gate=document.querySelector('.site-entry-shell');
if(gate){
  const alternative=wrapper.cloneNode(true);gate.prepend(alternative);
  alternative.querySelector('select').addEventListener('change',event=>changeLanguage(event.target.value));
}
translate();
let scheduled=false;
new MutationObserver(records=>{
  if(!records.some(record=>record.type==='childList'&&record.addedNodes.length))return;
  if(scheduled)return;scheduled=true;
  queueMicrotask(()=>{scheduled=false;translate();});
}).observe(document.body,{subtree:true,childList:true});
