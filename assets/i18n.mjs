// Publish English before the catalog arrives. A stale `fa` preference must not
// leave `lang` unset while a large module or canvas frame is still loading.
document.documentElement.lang='en';
document.documentElement.dir='ltr';
// Do not suspend this module on a network request: navigation can tear down
// WebKit pages before a dynamically imported module finishes downloading.
// English is fully functional without the optional Persian catalog.
let translations=Object.create(null);
const catalogReady=import('./i18n-catalog.mjs?v=20261014-public')
  .then(module=>{
    translations=module.translations;
    if(document.body?.isConnected)translate();
    return true;
  })
  .catch(error=>{
    // Keep default English and avoid an unhandled rejection during navigation.
    if(document.visibilityState!=='hidden')
      console.warn('[MalGuard i18n] Persian catalog unavailable; English remains active.',error);
    return false;
  });
export {catalogReady};

let locale='en';

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
translate();
let scheduled=false;
new MutationObserver(records=>{
  if(!records.some(record=>record.type==='childList'&&record.addedNodes.length))return;
  if(scheduled)return;scheduled=true;
  queueMicrotask(()=>{scheduled=false;translate();});
}).observe(document.body,{subtree:true,childList:true});
