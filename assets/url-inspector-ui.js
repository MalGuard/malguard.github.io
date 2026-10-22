/* Shared by Tools and Scan URL. No destination request is made locally. */
(()=>{
const button=document.getElementById('inspectButton')||document.getElementById('scanUrl');
const field=document.getElementById('urlInput'),box=document.getElementById('urlResult');
if(!button||!field||!box)return;
function node(tag,text,cls){const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;}
function run(){
box.replaceChildren();let result;try{result=MalGuardURL.inspect(field.value)}catch(error){box.textContent=error.message;return;}
const facts=node('dl','','facts');for(const[label,value]of[['Hostname',result.host],['Protocol',result.protocol],['Normalized',result.normalized]]){const row=node('div','','fact');row.append(node('dt',label),node('dd',value,'mono'));facts.append(row);}box.append(facts);
if(result.signals.length)for(const signal of result.signals)box.append(node('div','REVIEW · '+signal,'signal review'));
else box.append(node('div','No obvious URL-text warning signals were found. This does not prove the destination is safe.','signal'));
box.append(node('p','Local text inspection only. The destination was not opened; reputation and page content have not been checked.'));
if(result.onlineAllowed){const link=node('a','Continue with Game Scam Guard →','btn secondary');link.href=(button.dataset.onlineBase||'/game-scam-guard/')+'#inspect='+encodeURIComponent(result.normalized);box.append(link,node('small','The address is passed to the online scanner. Review it there and press Scan to send it for online analysis.'));}
}
button.addEventListener('click',run);field.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();run();}});
})();
