export async function openSettings(page,tab){
 const already=await page.evaluate(()=>!!document.getElementById('pro-settings')?.open);
 if(!already){
  if(!(await page.locator('#settings-panel > summary').isVisible()))await page.locator('#navigation-toggle').click();
  await page.locator('#settings-panel > summary').click();
  await page.waitForFunction(()=>document.getElementById('pro-settings')?.open);
 }
 if(tab)await page.evaluate(id=>document.getElementById('pro-tab-'+id)?.click(),tab);
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
export async function grantModelConsent(page){
 await openSettings(page,'data');
 await page.locator('#model-consent').check({force:true});
 await closeSettings(page);
}
export async function grantFileConsent(page){
 await openSettings(page,'data');
 await page.locator('#file-consent').check({force:true});
 await closeSettings(page);
}
