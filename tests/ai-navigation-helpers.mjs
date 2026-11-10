export async function openSettings(page,tab){
 await page.locator('#pro-settings').waitFor({state:'attached'});
 if(tab)await page.locator('#pro-tab-'+tab).waitFor({state:'attached'});
 await page.evaluate(tab=>{
  const panel=document.getElementById('settings-panel');
  const dlg=document.getElementById('pro-settings');
  if(panel&&!panel.open)panel.open=true;
  if(dlg&&!dlg.open)dlg.showModal();
  if(!tab)return;
  for(const id of ['general','appearance','models','account','data']){
   const t=document.getElementById('pro-tab-'+id),p=document.getElementById('pro-pane-'+id);
   if(t){t.classList.toggle('is-active',id===tab);t.setAttribute('aria-selected',String(id===tab));}
   if(p)p.hidden=id!==tab;
  }
  const pane=document.getElementById('pro-pane-'+tab);
  if(!dlg?.open||!pane||pane.hidden)throw new Error('settings pane did not open');
 },tab);
}
export async function closeSettings(page){
 if(await page.evaluate(()=>!!document.getElementById('pro-settings')?.open)){
  await page.evaluate(()=>document.getElementById('pro-settings')?.close());
  await page.waitForFunction(()=>!document.getElementById('pro-settings')?.open);
 }else if(await page.locator('#settings-panel').getAttribute('open')!==null){
  await page.locator('#settings-panel').evaluate(n=>{n.open=false;});
 }
 await page.evaluate(()=>{
  const panel=document.getElementById('settings-panel');
  if(panel)panel.open=false;
  if(innerWidth<=760){
   document.body.classList.add('navigation-closed');
   const collapse=document.getElementById('navigation-toggle');
   if(collapse)collapse.setAttribute('aria-expanded','false');
  }
 });
}
export async function toggleSettings(page){
 if(await page.evaluate(()=>!!document.getElementById('pro-settings')?.open || !!document.getElementById('settings-panel')?.open)){
  await closeSettings(page);
  return;
 }
 await openSettings(page);
}
export async function toggleLanguage(page){
 if(await page.locator('#settings-panel').getAttribute('open')===null && !(await page.locator('#pro-settings').isVisible().catch(()=>false)))await toggleSettings(page);
 const lang=page.locator('#pro-language, #language');
 await lang.first().click();
 await toggleSettings(page);
}
export async function newConversation(page){
 if(!(await page.locator('#clear').isVisible()))await page.locator('#navigation-toggle').click();await page.locator('#clear').click();
}
export async function openModePicker(page){
 if(!(await page.locator('#mode-toggle').isVisible()))await page.locator('#navigation-toggle').click();
 await page.locator('#mode-toggle').click();
}
export async function selectMode(page,mode){
 const experience=page.locator('#experience-'+(mode==='worker'?'worker':mode));
 if(await experience.isVisible()){await experience.click();return;}
 const shortcut=page.locator('#navigation-mode-'+mode);
 if(!(await shortcut.isVisible()) && await page.locator('body.navigation-closed').count())await page.locator('#navigation-toggle').click();
 if(await shortcut.isVisible()){await shortcut.click();return;}
 await openModePicker(page);
 const tab={chat:'#chat-tab',worker:'#workspace-tab',build:'#build-tab'}[mode];
 await page.locator(tab).click();
}
export async function selectModel(page,value){
 await page.locator('#model').selectOption(value,{force:true});
}
export async function checkControl(page,id,on=true){
 await page.evaluate(({id,on})=>{
  const el=document.getElementById(id);
  if(!el)throw new Error('missing '+id);
  if(el.type==='checkbox'||el.type==='radio'){
   if(el.checked!==on){
    el.checked=on;
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
   }
  }else el.click();
 },{id,on});
}
export async function grantModelConsent(page){
 await openSettings(page,'data');
 await checkControl(page,'model-consent',true);
 await closeSettings(page);
}
export async function grantFileConsent(page){
 await openSettings(page,'data');
 await checkControl(page,'file-consent',true);
 await closeSettings(page);
}
export async function revokePermissions(page){
 await openSettings(page,'data');
 await checkControl(page,'revoke-permissions');
}
