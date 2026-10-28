/* Navigation only: no page content, identity or URL is sent with a report. */
(()=>{'use strict';
 const showMilkyWay=()=>document.documentElement.classList.add('mg-milky-way');
 if(document.readyState==='complete')showMilkyWay();else addEventListener('load',showMilkyWay,{once:true});
 if(document.getElementById('mg-report-launcher'))return;
 const key='malguard-report-minimized',box=document.createElement('aside'),link=document.createElement('a'),toggle=document.createElement('button');box.id='mg-report-launcher';box.setAttribute('data-i18n-dynamic','');box.setAttribute('aria-label','Report a problem');link.href='/report.html?kind=bug';toggle.type='button';let minimized=false,lastLocale;try{minimized=localStorage.getItem(key)==='1';}catch{}
 const render=()=>{lastLocale=document.documentElement.lang;const fa=lastLocale==='fa';box.classList.toggle('minimized',minimized);link.hidden=minimized;link.textContent=fa?'گزارش مشکل':'Report a problem';toggle.textContent=minimized?'?':'−';toggle.setAttribute('aria-label',fa?(minimized?'نمایش دکمهٔ گزارش مشکل':'کوچک‌کردن دکمهٔ گزارش مشکل'):(minimized?'Show report button':'Minimize report button'));toggle.setAttribute('aria-expanded',String(!minimized));toggle.title=toggle.getAttribute('aria-label');};
 toggle.addEventListener('click',()=>{minimized=!minimized;try{localStorage.setItem(key,minimized?'1':'0');}catch{}render();toggle.focus();});window.addEventListener('storage',e=>{if(e.key===key){minimized=e.newValue==='1';render();}});window.addEventListener('malguard-language',render);new MutationObserver(()=>{if(document.documentElement.lang!==lastLocale)render();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});box.append(link,toggle);document.body.append(box);render();
})();
