/* Readable DOM and its glyph particles share the persistent field's scroll clock.
   No screenshots of text, extra scene canvases, scroll interception or overlays. */
(()=>{
 'use strict';
 const root=document.body,scenes=[...document.querySelectorAll('.scene[data-scene]')];
 if(scenes.length!==6)return;
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const clamp=x=>Math.max(0,Math.min(1,x)),smooth=(a,b,x)=>{const q=clamp((x-a)/(b-a));return q*q*(3-2*q);};
 const offset=el=>{let x=0,y=0;for(let n=el;n;n=n.offsetParent){x+=n.offsetLeft;y+=n.offsetTop;}return{x,y};};
 const records=scenes.map((scene,index)=>({scene,index,copy:scene.querySelector('.t'),words:[...scene.querySelectorAll('.w')],points:new Float32Array(0),start:0,height:0,enter:0,exit:0,opacity:0}));
 let width=innerWidth,height=innerHeight,age=0,visualY=scrollY,frame=null,disposed=false,measureRAF=0,measureTimer=0,lastLocale='',epoch=0;
 root.classList.add('particle-story');
 function sample(r){
  const heading=r.copy.querySelector('h1,h2');
  if(!heading.querySelector('.w')){
   const walker=document.createTreeWalker(heading,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
   for(const node of nodes){const fragment=document.createDocumentFragment();for(const part of node.textContent.split(/(\s+)/u)){if(!part)continue;if(/^\s+$/u.test(part))fragment.append(document.createTextNode(part));else{const span=document.createElement('span');span.className='w';span.textContent=part;fragment.append(span);}}node.replaceWith(fragment);}
  }
  const words=[...heading.querySelectorAll('.w')];r.words=words;
  if(!words.length){r.points=new Float32Array(0);return;}
  const origin=offset(r.copy),points=[],off=document.createElement('canvas'),ctx=off.getContext('2d',{willReadFrequently:true});
  const stride=width<=900?4:5;
  words.forEach((word,index)=>{
   const style=getComputedStyle(word),position=offset(word),w=Math.ceil(word.offsetWidth+4),h=Math.ceil(parseFloat(style.lineHeight)||parseFloat(style.fontSize)*1.2);
   if(!w||!h)return;off.width=w;off.height=h;ctx.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText(word.textContent,2,h/2);
   const pixels=ctx.getImageData(0,0,w,h).data;
   for(let y=1;y<h;y+=stride)for(let x=1;x<w;x+=stride)if(pixels[(y*w+x)*4+3]>110){
    const seed=((x*73+y*29+index*137)%997)/997;
    points.push(position.x-origin.x+x,position.y-origin.y+y,index/Math.max(1,words.length-1),seed);
   }
  });
  const count=points.length/4,limit=width<=900?760:1400,take=Math.min(count,limit),bank=new Float32Array(take*4);
  for(let i=0;i<take;i++){const at=Math.floor(i*count/take)*4;bank.set(points.slice(at,at+4),i*4);}r.points=bank;
 }
 function measure(){
  if(disposed)return;width=innerWidth;height=innerHeight;
  for(const r of records){
   // The copy's sticky destination, not its in-flight visual transform, is measured.
   const readingTop=Math.max(94,Math.min(width<=900?height*.50:height*.5-r.copy.offsetHeight*.5,height-r.copy.offsetHeight-(height<=700?32:76)));
   r.copy.style.setProperty('--reading-top',readingTop.toFixed(1)+'px');
   r.start=offset(r.scene).y;r.height=r.scene.offsetHeight;sample(r);
  }
  epoch++;window.dispatchEvent(new CustomEvent('mg:story-measured'));
 }
 function schedule(){if(disposed)return;clearTimeout(measureTimer);measureTimer=setTimeout(()=>{cancelAnimationFrame(measureRAF);measureRAF=requestAnimationFrame(measure);},100);}
 function write(r,enter,exit,still){
  r.enter=enter;r.exit=exit;
  const key=`${enter.toFixed(4)}/${exit.toFixed(4)}/${still}/${epoch}`;if(r.lastPaint===key)return;r.lastPaint=key;
  const visible=still||enter>.015&&exit<.995;
  r.copy.style.setProperty('--copy-visibility',visible?'visible':'hidden');
  r.copy.style.setProperty('--copy-events',visible&&enter>.8&&exit<.12?'auto':'none');
  r.copy.inert=!still&&(!visible||enter<.8||exit>.12);
  r.opacity=still?1:smooth(.2,.88,enter)*(1-smooth(0,.46,exit));
  r.scene.classList.toggle('in',still||r.opacity>.97);
  r.scene.style.setProperty('--chapter-label',String(r.opacity));
  for(const [i,child]of [...r.copy.children].entries()){
   const p=still?1:smooth(.18+i*.045,.79+i*.025,enter)*(1-smooth(0,.40,exit));
   child.style.setProperty('--element-opacity',p.toFixed(4));child.style.setProperty('--element-blur',((1-p)*9).toFixed(2)+'px');child.style.setProperty('--element-y',((1-p)*12-exit*18).toFixed(2)+'px');child.style.setProperty('--element-scale',String(1+exit*.09));
  }
  r.words.forEach((word,i)=>{
   const lag=i/Math.max(1,r.words.length-1)*.17,p=still?1:smooth(.15+lag,.72+lag,enter)*(1-smooth(lag*.35,.40+lag*.35,exit));
   word.style.setProperty('--word-opacity',p.toFixed(4));word.style.setProperty('--word-blur',((1-p)*10).toFixed(2)+'px');word.style.setProperty('--word-x',((i%2?1:-1)*exit*12).toFixed(2)+'px');word.style.setProperty('--word-y',((1-enter)*15-exit*20).toFixed(2)+'px');word.style.setProperty('--word-scale',String(1+(1-enter)*.06+exit*.16));
  });
  r.scene.dataset.readingPhase=still?'static':exit>.01?'dissolve':enter<.99?'assemble':'hold';
  r.scene.dataset.copyProgress=r.opacity.toFixed(3);r.scene.dataset.glyphParticles=String(r.points.length/4);
 }
 function update(y,opening,elapsed,still,particleProgress){
  if(disposed)return;still=still||reduced.matches;
  visualY=y;
  const ready=!opening||opening.complete;
  age=ready?Math.min(1400,age+elapsed):0;frame=null;
  for(const r of records){
   const p=(y-r.start)/Math.max(1,r.height),last=r.index===5;
   let enter=r.index===0?smooth(80,1200,age):smooth(-.08,.13,p),exit=last?0:smooth(.54,.77,p);
   if(r.index===0&&!ready)enter=0;
   if(!last&&p<-.12||last&&r.scene.getBoundingClientRect().top>height)enter=0;
   // Never release reading copy while its security form is still in flight.
   if(r.index>0&&r.index<5)enter*=1-smooth(.025,.24,Math.abs(particleProgress-r.index));
   write(r,still?1:enter,still?0:exit,still);
   if(!still&&enter>.015&&enter<.999&&exit<.01||!still&&exit>.001&&exit<.999)frame=r;
  }
 }
 function drawDust(ctx,cx,cy,time){
  if(!frame||!frame.points.length)return 0;
  const r=frame,box=r.copy.getBoundingClientRect(),bank=r.points,exiting=r.exit>.001;
  let count=0;ctx.save();ctx.globalCompositeOperation='lighter';
  for(let i=0;i<bank.length;i+=4){
   const seed=bank[i+3],word=bank[i+2],phase=seed*6.283185;
   const q=exiting?smooth(word*.035,.94,r.exit):smooth(seed*.14,.84+word*.10,r.enter);
   const targetX=box.left+bank[i],targetY=box.top+bank[i+1];let x,y,alpha;
   if(exiting){const travel=q*q,turn=phase+q*1.7;x=targetX+Math.cos(turn)*travel*width*.9;y=targetY+Math.sin(turn)*travel*height*.8;alpha=smooth(0,.16,r.exit)*(1-smooth(.60,1,r.exit));}
   else{const radius=(1-q)*(1-q),turn=phase+(1-q)*1.8;x=targetX+(cx-targetX)*radius+Math.cos(turn)*radius*width*.38;y=targetY+(cy-targetY)*radius+Math.sin(turn)*radius*height*.36;alpha=smooth(.015,.18,r.enter)*(1-smooth(.38,.94,r.enter));}
   if(x<0||x>width||y<0||y>height)continue;
   ctx.globalAlpha=alpha*(.25+seed*.55);ctx.fillStyle=seed>.88?'#d5edff':seed>.45?'#86c9ff':'#9293ef';
   const size=.65+seed*.8+(exiting?q*.6:0);ctx.beginPath();ctx.arc(x,y,size,0,Math.PI*2);ctx.fill();count++;
  }
  ctx.restore();return count;
 }
 const onLocale=()=>{const key=document.documentElement.lang+'/'+document.documentElement.dir;if(key!==lastLocale){lastLocale=key;schedule();}};
 const observer=new MutationObserver(onLocale);observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang','dir']});
 addEventListener('resize',schedule,{passive:true});reduced.addEventListener('change',schedule);document.fonts.addEventListener('loadingdone',schedule);document.fonts.ready.then(schedule);
 const focus=event=>{const r=records.find(r=>r.copy.contains(event.target));if(r){if(r.index===0)age=1400;write(r,1,0,true);}};document.addEventListener('focusin',focus);
 const fallbackTimer=setTimeout(()=>{if(!window.MalGuardParticles){disposed=true;root.classList.remove('particle-story');for(const r of records){r.copy.inert=false;r.scene.classList.add('in');}window.MalGuardOpening?.finish('particle-field-unavailable');root.dataset.intro='ready';window.MalGuardParticleStory=undefined;observer.disconnect();removeEventListener('resize',schedule);document.removeEventListener('focusin',focus);}},5000);
 addEventListener('pagehide',event=>{if(event.persisted)return;disposed=true;clearTimeout(fallbackTimer);clearTimeout(measureTimer);cancelAnimationFrame(measureRAF);observer.disconnect();removeEventListener('resize',schedule);reduced.removeEventListener('change',schedule);document.fonts.removeEventListener('loadingdone',schedule);document.removeEventListener('focusin',focus);});
 window.MalGuardParticleStory={measure,update,drawDust,reset:()=>{age=0;},get records(){return records;},snapshot:()=>({epoch,age,scroll:visualY,active:frame?.index??null,chapters:records.map(r=>({index:r.index,start:r.start,height:r.height,enter:r.enter,exit:r.exit,opacity:r.opacity,points:r.points.length/4,phase:r.scene.dataset.readingPhase}))})};
 measure();
})();
