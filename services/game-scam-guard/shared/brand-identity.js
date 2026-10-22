// Bounded spelling review, not a malicious-domain database or ownership proof.
const brands=[['steam',['steampowered.com','steamcommunity.com']],['epicgames',['epicgames.com']],['rockstar',['rockstargames.com']],['roblox',['roblox.com']],['minecraft',['minecraft.net']],['discord',['discord.com','discord.gg']]];
function oneEdit(a,b){if(a===b)return true;if(Math.abs(a.length-b.length)>1)return false;let i=0;while(i<Math.min(a.length,b.length)&&a[i]===b[i])i++;if(a.length===b.length)return a.slice(i+1)===b.slice(i+1)||(a[i]===b[i+1]&&a[i+1]===b[i]&&a.slice(i+2)===b.slice(i+2));return a.length>b.length?a.slice(i+1)===b.slice(i):a.slice(i)===b.slice(i+1);}
const fold=s=>s.replace(/[013457]/g,c=>({'0':'o','1':'l','3':'e','4':'a','5':'s','7':'t'}[c]));
export function brandIdentitySignals(value){
 const host=new URL(value).hostname.toLowerCase().replace(/\.$/,'');
 return brands.flatMap(([brand,official])=>{
  if(official.some(d=>host===d||host.endsWith('.'+d)))return [];
  const literal=new RegExp(`(?:^|[.-])${brand}(?:[.-]|$)`,'i').test(host);
  const names=[brand,...official.map(d=>d.split('.')[0])];
  const fuzzy=host.split('.').some(label=>label.length>=5&&label.length<=63&&names.some(name=>oneEdit(fold(label),name)));
  if(!literal&&!fuzzy)return [];
  const en=`The hostname ${host} resembles ${brand}, but is outside its listed official domains (${official.join(', ')}). Review the spelling; this is not proof of phishing.`;
  const fa=`نام دامنهٔ ${host} به ${brand} شباهت دارد، اما از دامنه‌های رسمی فهرست‌شده نیست (${official.join(', ')}). املای نشانی را بررسی کنید؛ این هشدار به‌تنهایی اثبات فیشینگ نیست.`;
  return [{module:'brand-domain',rule:fuzzy&&!literal?'brand_typo_host':'brand_in_unofficial_host',level:'warning',title:'شباهت به دامنهٔ برند',detail:fa,evidence:[host,brand,...official],localized:{en:{title:'Brand domain resemblance',detail:en},fa:{title:'شباهت به دامنهٔ برند',detail:fa}}}];
 });
}
