export async function toggleSettings(page){
 if(await page.locator('#settings-panel').getAttribute('open')!==null){await page.locator('#settings-close').click();return;}
 if(!(await page.locator('#settings-panel > summary').isVisible()))await page.locator('#navigation-toggle').click();
 await page.locator('#settings-panel > summary').click();
}
export async function toggleLanguage(page){
 if(await page.locator('#settings-panel').getAttribute('open')===null)await toggleSettings(page);
 const field=page.locator('#language-select');await field.selectOption((await field.inputValue())==='en'?'fa':'en');await page.locator('#settings-close').click();
}
export async function newConversation(page){
 if(!(await page.locator('#clear').isVisible()))await page.locator('#navigation-toggle').click();await page.locator('#clear').click();
}
export async function openModePicker(page){
 if(!(await page.locator('#mode-toggle').isVisible()))await page.locator('#navigation-toggle').click();
 await page.locator('#mode-toggle').click();
}
