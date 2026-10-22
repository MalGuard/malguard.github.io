/* Lightweight, local, fully fictional evidence demo for the static GTA Guard
   landing page. No WebGL, GSAP, network requests, file reads or heavy animation. */
(()=>{'use strict';
 const sample=document.getElementById('sample-select');
 const input=document.getElementById('sample-name');
 const form=document.getElementById('sample-form');
 if(!sample||!input||!form)return;
 const $=id=>document.getElementById(id);
 const scenarios=[
  {name:'NightDrive.asi',verdict:'Suspicious',color:'#e9c795',format:'ASI native plug-in (fictional)',
   finding:'Unexpected embedded loader (invented)',coverage:'Completed demo checks; attribution remains uncertain.',
   detail:'This invented mod contains an unexpected embedded loader. The scripted indicators call for closer inspection.',
   trace:['Identity established: fictional ASI plug-in.','Structure inspected: unexpected embedded loader.','Indicators correlated: suspicious pattern in this scenario.','Decision: Suspicious. Attribution remains uncertain.']},
  {name:'vehicle_pack.dll',verdict:'Inconclusive',color:'#e9c795',format:'DLL native library (fictional)',
   finding:'Encrypted member; required evidence unavailable (invented)',
   coverage:'Incomplete. Inconclusive must never be interpreted as Safe.',
   detail:'An invented encrypted member prevents complete analysis. Required evidence is missing; this is never a clean result.',
   trace:['Identity established: fictional DLL library.','Structure inspected: an encrypted member is present.','Coverage checked: required evidence is unavailable.','Decision: Inconclusive. Missing evidence never means safe.']},
  {name:'texture_pack.rpf',verdict:'No scripted indicators',color:'#bdd9ed',
   format:'RPF asset package (fictional)',finding:'Completed demo checks found no scripted indicators',
   coverage:'Completed within this invented scenario only.',
   detail:'Completed demo checks found no scripted indicators. This invented result makes no claim about any real file. A clean result is never a guarantee.',
   trace:['Identity established: fictional RPF package.','Structure inspected: supported demo records examined.','Coverage checked: the scripted checks are complete.','Decision: No scripted indicators. This is not a safety guarantee.']},
  {name:'loader_x.asi',verdict:'Malicious',color:'#efaab8',format:'ASI native plug-in (fictional)',
   finding:'Credential-access and loader pattern (invented)',
   coverage:'Completed demo checks; multiple invented indicators agree.',
   detail:'The fictional evidence combines credential-access and loader patterns. This scenario is scripted to produce a Malicious result.',
   trace:['Identity established: fictional ASI plug-in.','Structure inspected: credential-access and loader patterns.','Indicators correlated: multiple invented harm patterns agree.','Decision: Malicious, within this scripted scenario.']}
 ];
 const steps=[...document.querySelectorAll('.analysis-stages li')];
 let completed=false;
 const scenario=()=>scenarios[Number(sample.value)]||scenarios[1];
 function render(){
  const v=scenario();
  const demoName=input.value.trim().slice(0,48)||v.name;
  const result=$('result-title'),panel=document.querySelector('.result-panel');
  $('scan-button').firstChild.textContent=completed?'Replay example ':'Inspect example ';
  $('trace-progress').textContent=completed?'Finished':'Ready';
  $('scan-progress').setAttribute('aria-valuenow',completed?'100':'0');
  $('scan-progress').style.setProperty('--scan-progress',completed?'100%':'0%');
  $('analysis-log').textContent=completed
   ? 'Illustrative scenario: '+demoName+'\n\n'+v.trace.map((msg,i)=>['Identify','Inspect','Analyze','Decide'][i]+'\n'+msg).join('\n\n')
   : 'Choose an invented scenario to follow its evidence.';
  result.textContent=completed?v.verdict:'Evidence before confidence.';
  $('result-detail').textContent=completed?v.detail:'The demo has not started. A filename alone cannot establish safety.';
  $('coverage-label').textContent=completed?v.coverage:'Not assessed';
  $('evidence-name').textContent=demoName;
  $('evidence-format').textContent=completed?v.format:'Awaiting illustration';
  $('evidence-finding').textContent=completed?v.finding:'No evidence shown yet';
  $('evidence-coverage').textContent=completed?v.coverage:'Not assessed';
  panel.style.setProperty('--outcome-color',completed?v.color:'#dceaf7');
  panel.dataset.coverage=completed?(Number(sample.value)===1?'incomplete':'complete'):'waiting';
  document.querySelectorAll('.coverage-line i').forEach((el,i)=>{
   el.classList.toggle('done',completed&&(Number(sample.value)!==1||i<2));
   el.classList.toggle('missing',completed&&Number(sample.value)===1&&i>=2);
  });
  steps.forEach((step,i)=>{
   step.classList.toggle('done',completed);
   step.classList.toggle('active',false);
   step.classList.toggle('incomplete',completed&&Number(sample.value)===1&&i===2);
   step.querySelector('small').textContent=completed?(Number(sample.value)===1&&i===2?'Evidence missing':'Complete'):'Waiting';
   step.removeAttribute('aria-current');
  });
  $('scan-announcement').textContent=completed?'Illustrative '+v.verdict+' result. This is not a real scan.':'';
 }
 sample.addEventListener('change',()=>{input.value=scenario().name;completed=false;render()});
 input.addEventListener('input',()=>{completed=false;render()});
 form.addEventListener('submit',e=>{e.preventDefault();completed=true;render()});
 render();
 document.documentElement.dataset.gtaStaticReady='true';
})();