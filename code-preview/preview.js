// Trusted bridge only: the parent supplies project text after explicit Run.
// User code runs in the nested opaque-origin frame, never in this bridge.
addEventListener('message',event=>{
 if(event.source===document.getElementById('result').contentWindow&&event.data?.type==='malguard-preview-log'&&typeof event.data.text==='string'){
  parent.postMessage({type:'malguard-preview-output',text:event.data.text.slice(0,1000),level:event.data.level==='error'?'error':'log'},'*');return;
 }
 if(event.source!==parent||event.data?.type!=='malguard-project-preview')return;
 const files=event.data.files;if(!files||typeof files!=='object'||Array.isArray(files)||Object.keys(files).length>32)return;
 let size=0;for(const [name,content]of Object.entries(files)){if(!/^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(html|css|js|json|md|txt|py|ts|tsx|jsx)$/.test(name)||typeof content!=='string'||new TextEncoder().encode(content).length>262144)return;size+=new TextEncoder().encode(content).length;}
 if(size>2097152||typeof files['index.html']!=='string')return;
 const path=value=>value.replace(/^\.\//,'');
 let html=files['index.html'];
 html=html.replace(/<link\b[^>]*\bhref\s*=\s*(["'])([^"']+)\1[^>]*>/gi,(tag,quote,href)=>{const file=path(href);return file.endsWith('.css')&&Object.hasOwn(files,file)?'<style>'+files[file].replace(/</g,'\\3c ')+'</style>':tag;});
 html=html.replace(/<script\b[^>]*\bsrc\s*=\s*(["'])([^"']+)\1[^>]*>\s*<\/script\s*>/gi,(tag,quote,src)=>{const file=path(src);return file.endsWith('.js')&&Object.hasOwn(files,file)?'<script>'+files[file].replace(/<\/script/gi,'<\\/script')+'</script>':tag;});
 const policy="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; worker-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
 const logger='<script>(()=>{let sent=0;const emit=(level,values)=>{if(++sent>40)return;const text=values.map(value=>{try{return typeof value==="string"?value:JSON.stringify(value)}catch{return "[unprintable]"}}).join(" ").slice(0,1000);parent.postMessage({type:"malguard-preview-log",level,text},"*")};for(const key of ["log","warn","error"]){const original=console[key];console[key]=(...values)=>{emit(key==="error"?"error":"log",values);original.apply(console,values)}}addEventListener("error",event=>{emit("error",[event.message]);event.preventDefault()});addEventListener("unhandledrejection",event=>{emit("error",[String(event.reason)]);event.preventDefault()})})();</script>';
 const result=document.getElementById('result');
 result.onload=()=>parent.postMessage({type:'malguard-preview-ready'},'*');
 result.srcdoc='<!doctype html><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="'+policy+'">'+logger+html;
});
