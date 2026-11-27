import {AsYouType,parsePhoneNumberFromString,getCountries,getCountryCallingCode} from 'libphonenumber-js/max';

const digits=value=>value.replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632));
const names=()=>new Intl.DisplayNames([document.documentElement.lang==='fa'?'fa':'en'],{type:'region'});
const controllers=new WeakMap();
function attach(input){
  if(controllers.has(input))return controllers.get(input);
  let country='US';const wrap=document.createElement('div');wrap.className='phone-field';input.before(wrap);wrap.append(input);input.dir='ltr';input.dataset.phoneInput='';
  const button=document.createElement('button');button.type='button';button.className='phone-country-button';button.setAttribute('aria-haspopup','dialog');
  let returnFocus=button;
  const flag=document.createElement('img');flag.width=26;flag.height=18;flag.alt='';const code=document.createElement('span');button.append(flag,code);wrap.prepend(button);
  const hint=document.createElement('p');hint.className='phone-format-hint';hint.dataset.i18nDynamic='';hint.id=input.id+'Format';wrap.after(hint);input.setAttribute('aria-describedby',hint.id);
  const dialog=document.createElement('dialog');dialog.className='country-picker';dialog.setAttribute('aria-label','Choose the phone number country');wrap.append(dialog);
  const top=document.createElement('div');top.className='country-picker-top';const title=document.createElement('strong');title.textContent='Phone country';
  const close=document.createElement('button');close.type='button';close.className='country-picker-close';close.textContent='×';close.setAttribute('aria-label','Close country picker');top.append(title,close);
  const search=document.createElement('input');search.type='search';search.placeholder='Search country or calling code';search.setAttribute('aria-label','Search country or calling code');search.autocomplete='off';
  const list=document.createElement('div');list.className='country-picker-list';dialog.append(top,search,list);
  function label(){flag.src='/assets/flags/'+country+'.svg';code.textContent='+'+getCountryCallingCode(country);button.setAttribute('aria-label',names().of(country)+' +'+getCountryCallingCode(country)+' — choose country');button.dataset.country=country;input.placeholder=country==='US'?'(202) 555-0148':country==='IR'?'0912 345 6789':country==='AF'?'070 123 4567':'Phone number';}
  function normalized(){const phone=parsePhoneNumberFromString(digits(input.value),{defaultCountry:country,extract:false});return phone?.isValid()&&(!phone.country||phone.country===country)?phone:null;}
  function format(){
    const raw=digits(input.value).replace(/^00/,'+'),formatter=new AsYouType(country),formatted=formatter.input(raw),detected=formatter.getCountry();
    if(raw.startsWith('+')&&detected){country=detected;label();}
    if(document.activeElement!==input||input.selectionStart===input.value.length)input.value=formatted;
    const phone=normalized(),fa=document.documentElement.lang==='fa';
    hint.textContent=phone?phone.formatInternational():(fa?'شمارهٔ مربوط به کشور انتخاب‌شده را وارد کنید.':'Enter a number belonging to the selected country.');
    input.setCustomValidity('');hint.classList.toggle('valid',!!phone);
  }
  function render(){
    const n=names(),q=digits(search.value).toLocaleLowerCase(),countries=getCountries().sort((a,b)=>n.of(a).localeCompare(n.of(b),document.documentElement.lang));list.replaceChildren();
    for(const c of countries){const prefix='+'+getCountryCallingCode(c),name=n.of(c);if(q&&!`${c} ${name} ${prefix}`.toLocaleLowerCase().includes(q))continue;
      const option=document.createElement('button');option.type='button';option.className='country-option';option.setAttribute('aria-pressed',String(c===country));
      const image=document.createElement('img');image.src='/assets/flags/'+c+'.svg';image.alt='';image.width=26;image.height=18;image.loading='lazy';const text=document.createElement('span');text.textContent=name;const dial=document.createElement('span');dial.textContent=prefix;dial.dir='ltr';option.append(image,text,dial);
      option.addEventListener('click',()=>{country=c;input.value='';label();format();returnFocus=input;dialog.close();input.focus();});list.append(option);
    }
  }
  button.addEventListener('click',()=>{returnFocus=button;search.value='';render();dialog.showModal();button.setAttribute('aria-expanded','true');search.focus();});
  close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{button.setAttribute('aria-expanded','false');returnFocus.focus();});search.addEventListener('input',render);
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  list.addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;e.preventDefault();const items=[...list.children],i=items.indexOf(document.activeElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();});
  input.addEventListener('input',format);input.addEventListener('blur',format);window.addEventListener('malguard-language',()=>{label();format();});
  let lastLocale=document.documentElement.lang;
  new MutationObserver(()=>{if(document.documentElement.lang===lastLocale)return;lastLocale=document.documentElement.lang;label();format();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  const control={validate(){format();const phone=normalized();if(!phone){input.setCustomValidity(document.documentElement.lang==='fa'?'شمارهٔ معتبر برای کشور انتخاب‌شده وارد کنید.':'Enter a valid number for the selected country.');input.reportValidity();return null;}return phone.number;},country:()=>country};
  controllers.set(input,control);label();format();return control;
}
window.MalGuardPhone={attach,validate:input=>attach(input).validate()};
function start(){document.querySelectorAll('[data-phone-input]').forEach(attach);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
