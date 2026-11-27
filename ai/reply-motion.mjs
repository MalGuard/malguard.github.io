// Presentation of received text, not token streaming or model reasoning.
export function formatElapsed(milliseconds,locale='en',precise=false){
 const seconds=precise?Math.round(milliseconds/100)/10:Math.floor(milliseconds/1000);
 const minutes=Math.floor(seconds/60),remaining=seconds%60;
 const number=new Intl.NumberFormat(locale==='fa'?'fa-IR':'en-US',{maximumFractionDigits:precise?1:0,useGrouping:false});
 const tail=locale==='fa'?`${number.format(remaining)} ثانیه`:`${number.format(remaining)}s`;
 return minutes?(locale==='fa'?`${number.format(minutes)} دقیقه و ${tail}`:`${number.format(minutes)}m ${tail}`):tail;
}
export function typeText(text,write,{signal,charactersPerSecond=180,reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches,frame=globalThis.requestAnimationFrame,cancel=globalThis.cancelAnimationFrame}={}){
 const parts=typeof Intl.Segmenter==='function'?Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text),s=>s.segment):Array.from(text);
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(signal.reason);return;}
  if(reducedMotion||!parts.length){write(text);resolve();return;}
  let id,start,last=0,visible='';
  const cleanup=()=>{cancel(id);signal?.removeEventListener('abort',abort);};
  const abort=()=>{cleanup();reject(signal.reason);};
  const tick=now=>{
   start??=now;
   const count=Math.min(parts.length,Math.max(1,Math.floor((now-start)*Math.max(charactersPerSecond/1000,parts.length/6000))));
   if(count>last){visible+=parts.slice(last,count).join('');last=count;write(visible);}
   if(count===parts.length){cleanup();resolve();}else id=frame(tick);
  };
  signal?.addEventListener('abort',abort,{once:true});id=frame(tick);
 });
}
export async function typeActivity(text,write,{signal}={}){
 if(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){write(text);return;}
 while(!signal?.aborted){
  await typeText(text,write,{signal,charactersPerSecond:20});
  await new Promise((resolve,reject)=>{
   if(signal?.aborted){reject(signal.reason);return;}
   const abort=()=>{clearTimeout(timer);reject(signal.reason);};
   const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},1000);
   signal?.addEventListener('abort',abort,{once:true});
  });
 }
}
