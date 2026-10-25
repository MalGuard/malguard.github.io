import {starterFiles,validateFiles,codingPrompt,projectZip,MAX_FILES,MAX_FILE_BYTES} from './build-project.mjs?v=builder-file-blocks-20261025';
export function createBuilder({locale=()=> 'en'}={}){
 const $=id=>document.getElementById(id),text=(fa,en)=>locale()==='fa'?fa:en;
 let files=validateFiles(starterFiles),selected='index.html',previous,invalid=false,run=0,outputCount=0;
 const status=message=>{$('build-status').textContent=message;};
 const clone=value=>Object.assign(Object.create(null),value);
 function view(next){$('build-columns').dataset.view=next;$('build-code-view').setAttribute('aria-pressed',String(next==='code'));$('build-preview-view').setAttribute('aria-pressed',String(next==='preview'));}
 $('build-code-view').onclick=()=>view('code');$('build-preview-view').onclick=()=>view('preview');
 function draw(){view('code');
  $('build-file').replaceChildren();for(const name of Object.keys(files)){const option=document.createElement('option');option.value=name;option.textContent=name;$('build-file').append(option);}
  $('build-file').value=selected;$('build-editor').value=files[selected];$('build-editor').ariaLabel=selected;invalid=false;controls();
 }
 function controls(){ $('build-undo').disabled=!previous;$('build-run').disabled=invalid||!Object.hasOwn(files,'index.html');$('build-export').disabled=invalid;$('build-share-code').disabled=invalid;$('build-stop').disabled=$('build-preview').tagName!=='IFRAME';$('build-size').textContent=`${Object.keys(files).length} ${text('فایل','files')} · ${new TextEncoder().encode(Object.values(files).join('')).length} B`; }
 function replace(next){const checked=validateFiles(next);previous=clone(files);files=checked;if(!Object.hasOwn(files,selected))selected=Object.keys(files)[0];draw();}
 $('build-import-button').onclick=()=>$('build-import').click();
 $('build-import').onchange=async()=>{try{const imported=Object.create(null),items=[...$('build-import').files];if(!items.length)return;if(items.length>MAX_FILES||items.some(file=>file.size>MAX_FILE_BYTES))throw new Error();for(const file of items)imported[file.name]=await file.text();replace({...files,...imported});selected=Object.keys(imported)[0];draw();status(text('فایل‌ها فقط به پروژهٔ محلی وارد شدند؛ به مدل ارسال نشدند.','Files imported into the local project only; nothing was sent to a model.'));}catch{status(text('ورود انجام نشد؛ نام، قالب و حجم فایل‌ها را بررسی کن.','Import failed. Check file names, formats and size.'));}finally{$('build-import').value='';}};
 $('build-file').onchange=()=>{selected=$('build-file').value;draw();};
 $('build-editor').addEventListener('keydown',event=>{if(event.key==='Tab'&&!event.shiftKey){event.preventDefault();$('build-editor').setRangeText('  ',$('build-editor').selectionStart,$('build-editor').selectionEnd,'end');$('build-editor').dispatchEvent(new Event('input'));}});
 $('build-editor').oninput=()=>{try{files=validateFiles({...files,[selected]:$('build-editor').value});invalid=false;status(text('تغییرات در حافظهٔ همین صفحه است.','Changes are in this page’s memory.'));}catch{invalid=true;status(text('فایل باید حداکثر ۲۵۶ کیلوبایت و پروژه حداکثر ۲ مگابایت باشد.','Limit: 256 KB per file and 2 MB per project.'));}controls();};
 $('build-add').onclick=()=>{const name=$('build-name').value.trim();try{if(Object.hasOwn(files,name))throw new Error();replace({...files,[name]:''});selected=name;draw();$('build-name').value='';status(text('فایل ساخته شد.','File created.'));}catch{status(text('نامی مثل helper.js یا src/main.py بنویس؛ حداکثر ۳۲ فایل.','Use a name such as helper.js or src/main.py; at most 32 files.'));}};
 $('build-undo').onclick=()=>{if(previous){files=previous;previous=undefined;if(!Object.hasOwn(files,selected))selected=Object.keys(files)[0];draw();status(text('نسخهٔ پیش از آخرین اعمال پیشنهاد یا افزودن فایل بازیابی شد.','Restored the version before the last proposal or added file.'));}};
 function halt(){const frame=$('build-preview');if(frame.tagName==='IFRAME'){frame.onload=null;const empty=document.createElement('div');empty.id='build-preview';empty.dataset.i18n='previewEmpty';empty.textContent=text('برای دیدن نتیجه، پیش‌نمایش را اجرا کن.','Run preview to see your project.');frame.replaceWith(empty);}controls();}
 $('build-stop').onclick=()=>{halt();status(text('پیش‌نمایش متوقف شد.','Preview stopped.'));};
 addEventListener('message',event=>{if(event.source!==$('build-preview').contentWindow)return;if(event.data?.type==='malguard-preview-ready'){$('build-preview').dataset.ready='true';status(text('بارگذاری پیش‌نمایش پایان یافت.','Preview finished loading.'));return;}if(event.data?.type!=='malguard-preview-output'||typeof event.data.text!=='string'||outputCount>=40)return;outputCount++;const output=$('build-console');output.textContent=(output.textContent+'['+(event.data.level==='error'?'error':'log')+'] '+event.data.text.slice(0,1000)+'\n').slice(-6000);});
 $('build-run').onclick=()=>{if(invalid||!files['index.html'])return;$('build-console').textContent='';outputCount=0;const project=clone(files),old=$('build-preview'),frame=document.createElement('iframe');frame.id='build-preview';frame.dataset.ready='false';frame.title=text('پیش‌نمایش ایزولهٔ پروژه','Isolated project preview');frame.setAttribute('sandbox','allow-scripts');frame.referrerPolicy='no-referrer';frame.allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'";frame.onload=()=>{frame.contentWindow.postMessage({type:'malguard-project-preview',files:project},'*');status(text('پروژه به پیش‌نمایش ایزوله فرستاده شد.','Project sent to the isolated preview.'));};frame.src=`/code-preview/?v=builder-ready-20261025&run=${++run}`;old.replaceWith(frame);view('preview');controls();};
 $('build-export').onclick=()=>{try{const url=URL.createObjectURL(projectZip(files)),a=document.createElement('a');a.href=url;a.download='malguard-project.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);status(text('خروجی ZIP آماده شد.','ZIP export prepared.'));}catch{status(text('خروجی ساخته نشد؛ حجم و فایل‌ها را بررسی کن.','Export failed. Check project files and size.'));}};
 draw();
 return {
  refresh(){controls();},
  consumeShare(){$('build-share-code').checked=false;},
  prompt(request){if(invalid)throw new Error('build_context_too_large');return codingPrompt(request,$('build-share-code').checked?{name:selected,content:files[selected]}:{});},
  stop:halt,
  proposal(value,generated){
   const card=document.createElement('article');card.className='result build-proposal';
   const heading=document.createElement('h3');heading.textContent=value.summary;card.append(heading);
   const list=document.createElement('ul');for(const [name,code]of Object.entries(value.files)){const row=document.createElement('li');row.textContent=`${name} · ${new TextEncoder().encode(code).length} B`;list.append(row);}card.append(list);
   const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=text('مشاهدهٔ کد پیشنهادی','Review proposed code');details.append(summary);
   for(const [name,code]of Object.entries(value.files)){const title=document.createElement('p'),pre=document.createElement('pre');title.textContent=name;pre.textContent=code;pre.dir='ltr';details.append(title,pre);}card.append(details);
   const button=document.createElement('button');button.type='button';button.textContent=text('اعمال پیشنهاد در فایل‌ها','Apply proposal to files');button.onclick=()=>{try{replace({...files,...value.files});selected=Object.keys(value.files)[0];draw();status(text('پیشنهاد اعمال شد؛ «اجرای پیش‌نمایش» را بزن. نسخهٔ قبل با «برگرداندن» قابل بازیابی است.','Proposal applied. Run Preview to see it; Undo restores the previous version.'));}catch{status(text('پیشنهاد از محدودیت فایل یا حجم پروژه عبور می‌کند.','The proposal exceeds project file or size limits.'));}};card.append(button);
   const source=document.createElement('p');source.className='muted';source.textContent=`${generated.provider} · ${generated.model}`;card.append(source);return card;
  }
 };
}
