/* Local URL-text inspection. Heuristics are review signals, never malware verdicts. */
(function(root){
'use strict';
const brands={roblox:['roblox.com'],discord:['discord.com','discord.gg','discordapp.com'],steam:['steampowered.com','steamcommunity.com'],rockstar:['rockstargames.com'],epicgames:['epicgames.com'],minecraft:['minecraft.net','microsoft.com'],modrinth:['modrinth.com'],curseforge:['curseforge.com']};
// One edit, including adjacent transposition. Bounded labels avoid quadratic work.
function oneEdit(a,b){if(a===b)return true;if(Math.abs(a.length-b.length)>1)return false;let i=0;while(i<Math.min(a.length,b.length)&&a[i]===b[i])i++;if(a.length===b.length)return a.slice(i+1)===b.slice(i+1)||(a[i]===b[i+1]&&a[i+1]===b[i]&&a.slice(i+2)===b.slice(i+2));if(a.length>b.length)return a.slice(i+1)===b.slice(i);return a.slice(i)===b.slice(i+1);}
const fold=s=>s.replace(/[013457]/g,c=>({'0':'o','1':'l','3':'e','4':'a','5':'s','7':'t'}[c]));
function inspect(raw){
 raw=String(raw).trim();if(!raw)throw new Error('Paste a URL first.');if(raw.length>8192)throw new Error('The URL is too long for this local check.');
 let u;try{u=new URL(/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)?raw:'https://'+raw)}catch{throw new Error('This is not a valid URL.');}
 const host=u.hostname.toLowerCase().replace(/\.$/,''),signals=[];
 if(!['http:','https:'].includes(u.protocol))signals.push('Non-web scheme: '+u.protocol);
 if(u.username||u.password)signals.push('Embedded credentials can disguise the real host');
 if(host.split('.').some(x=>x.startsWith('xn--')))signals.push('Punycode hostname detected; review the Unicode spelling carefully');
 const isIp=/^\d{1,3}(\.\d{1,3}){3}$/.test(host)||host.includes(':');
 if(isIp)signals.push('Destination uses a raw IP address instead of a normal domain');
 if(u.port&&!['80','443'].includes(u.port))signals.push('Unusual explicit port: '+u.port);
 if(host.split('.').length>5)signals.push('Unusually deep subdomain chain');
 const labels=host.split('.'),path=u.pathname.toLowerCase();
 for(const [brand,domains]of Object.entries(brands)){
  if(domains.some(d=>host===d||host.endsWith('.'+d)))continue;
  const names=[brand,...domains.map(d=>d.split('.')[0])];
  const lookalike=!isIp&&labels.some(label=>label.length>=5&&names.some(name=>oneEdit(fold(label),name)));
  if(lookalike||host.includes(brand)||path.includes(brand))signals.push('Possible '+brand+' lookalike: '+host+' is not an official '+brand+' domain ('+domains.join(', ')+'). Check the spelling before signing in.');
 }
 return {host,protocol:u.protocol,normalized:u.href,signals,onlineAllowed:['http:','https:'].includes(u.protocol)&&!u.username&&!u.password};
}
root.MalGuardURL={inspect,oneEdit};
})(globalThis);
