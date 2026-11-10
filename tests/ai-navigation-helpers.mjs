export async function toggleSettings(page){
 const pro=page.locator('#pro-settings');
 if(await pro.isVisible().catch(()=>false)){
  await page.locator('#pro-settings .pro-settings-close').click();
  await pro.waitFor({state:'hidden'});
  await page.evaluate(()=>{
   const panel=document.getElementById('settings-panel');
   if(panel)panel.open=false;
   if(innerWidth<=760){
    document.body.classList.add('navigation-closed');
    const collapse=document.getElementById('navigation-toggle');
    if(collapse)collapse.setAttribute('aria-expanded','false');
   }
  });
  return;
 }
 if(await page.locator('#settings-panel').getAttribute('open')!==null){
  await page.locator('#settings-panel').evaluate(n=>{n.open=false;});
  return;
 }
 if(!(await page.locator('#settings-panel > summary').isVisible()))await page.locator('#navigation-toggle').click();
 await page.locator('#settings-panel > summary').click();
 await page.locator('#pro-settings').waitFor({state:'visible'});
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
export async function selectModel(page,value){
 await page.locator('#model').selectOption(value,{force:true});
}
export async function grantModelConsent(page){
 await toggleSettings(page);
 const dataTab=page.locator('#pro-tab-data');
 if(await dataTab.count())await dataTab.click();
 else if(await page.locator('#permissions').getAttribute('open')===null)await page.locator('#permissions summary').click({force:true});
 await page.locator('#model-consent').check({force:true});
 await toggleSettings(page);
}
