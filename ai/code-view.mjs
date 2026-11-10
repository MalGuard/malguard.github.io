const labels={html:'HTML',css:'CSS',js:'JavaScript',javascript:'JavaScript',ts:'TypeScript',typescript:'TypeScript',tsx:'TSX',jsx:'JSX',py:'Python',python:'Python',json:'JSON',md:'Markdown',text:'Text'};
export function codeLanguage(value='text'){const key=String(value).split('.').at(-1).toLowerCase();return labels[key]||'Text';}
const patterns={
 JavaScript:/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:const|let|var|function|return|if|else|for|while|class|new|async|await|import|from|export|default|throw|try|catch|true|false|null|undefined)\b|\b\d+(?:\.\d+)?\b/g,
 Python:/#[^\n]*|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:def|class|return|if|else|elif|for|while|in|import|from|as|with|try|except|raise|True|False|None|async|await|print)\b|\b\d+(?:\.\d+)?\b/g,
 HTML:/<!--[\s\S]*?-->|<\/?[\w:-]+|"[^"]*"|'[^']*'|\b[\w-]+(?==)/g,
 CSS:/\/\*[\s\S]*?\*\/|"[^"]*"|'[^']*'|#[\da-fA-F]{3,8}\b|\b[\w-]+(?=\s*:)|\b\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%)?/g,
 JSON:/"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?\b/g
};
export function highlightCode(pre,source,language='Text'){
 pre.replaceChildren();pre.dir='ltr';pre.classList.add('syntax-code');
 const rule=patterns[language]||(['TypeScript','TSX','JSX'].includes(language)?patterns.JavaScript:null);
 if(!rule||source.length>60000){pre.textContent=source;return;}
 rule.lastIndex=0;let at=0;for(const match of source.matchAll(rule)){if(match.index>at)pre.append(document.createTextNode(source.slice(at,match.index)));const token=document.createElement('span'),text=match[0];token.textContent=text;token.className=/^(?:\/\/|\/\*|<!--)/.test(text)||language==='Python'&&text.startsWith('#')?'tok-comment':/^["'`]/.test(text)?'tok-string':/^\d|^-\d|^#[\da-f]/i.test(text)?'tok-number':language==='HTML'&&text.startsWith('<')?'tok-tag':'tok-keyword';pre.append(token);at=match.index+text.length;}pre.append(document.createTextNode(source.slice(at)));
}
export function safeMarkdownUrl(value){
 try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
function inline(node,value){
 // Raw HTML and images remain text. Model output is always inserted as text nodes.
 const pattern=/(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]{1,300}\]\([^\s)]{1,2048}\))/g;
 let at=0;
 for(const match of value.matchAll(pattern)){
  node.append(document.createTextNode(value.slice(at,match.index)));
  const token=match[0];let part;
  if(token.startsWith('`')){part=document.createElement('code');part.textContent=token.slice(1,-1);}
  else if(token.startsWith('**')){part=document.createElement('strong');part.textContent=token.slice(2,-2);}
  else{const link=/^\[([^\]]+)\]\((.+)\)$/.exec(token),href=safeMarkdownUrl(link[2]);part=document.createElement(href?'a':'span');part.textContent=link[1];if(href){part.href=href;part.target='_blank';part.rel='noopener noreferrer';}}
  node.append(part);at=match.index+token.length;
 }
 node.append(document.createTextNode(value.slice(at)));
}
function proseBlocks(node,value){
 const lines=value.split('\n');let i=0;
 const cells=line=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(v=>v.trim()).slice(0,24);
 const divider=line=>line?.includes('|')&&cells(line).every(c=>/^:?-{3,}:?$/.test(c));
 const startsBlock=line=>/^(?:#{1,6}\s|[-*+]\s|\d+\.\s|>\s)/.test(line);
 while(i<lines.length){
  const line=lines[i];if(!line.trim()){i++;continue;}
  if(line.includes('|')&&divider(lines[i+1])){
   const wrap=document.createElement('div'),table=document.createElement('table'),head=document.createElement('thead'),row=document.createElement('tr'),body=document.createElement('tbody');
   wrap.className='answer-table-wrap';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Response table');
   const headers=cells(line);for(const title of headers){const th=document.createElement('th');th.scope='col';inline(th,title);row.append(th);}head.append(row);i+=2;
   while(i<lines.length&&lines[i].includes('|')&&lines[i].trim()){const tr=document.createElement('tr'),values=cells(lines[i++]);for(let col=0;col<headers.length;col++){const td=document.createElement('td');inline(td,values[col]||'');tr.append(td);}body.append(tr);}
   table.append(head,body);wrap.append(table);node.append(wrap);continue;
  }
  const heading=/^(#{1,6})\s+(.+)$/.exec(line);
  if(heading){const h=document.createElement('h'+Math.min(heading[1].length+1,6));inline(h,heading[2]);node.append(h);i++;continue;}
  const item=/^([-*+]|\d+\.)\s+(.+)$/.exec(line);
  if(item){const ordered=/\d/.test(item[1]),list=document.createElement(ordered?'ol':'ul');while(i<lines.length){const next=/^([-*+]|\d+\.)\s+(.+)$/.exec(lines[i]);if(!next||/\d/.test(next[1])!==ordered)break;const li=document.createElement('li');inline(li,next[2]);list.append(li);i++;}node.append(list);continue;}
  if(/^>\s/.test(line)){const quote=document.createElement('blockquote');inline(quote,line.replace(/^>\s/,''));node.append(quote);i++;continue;}
  const content=[line];i++;while(i<lines.length&&lines[i].trim()&&!startsBlock(lines[i])&&!divider(lines[i+1]))content.push(lines[i++]);
  const p=document.createElement('p');p.className='answer-prose';inline(p,content.join('\n'));node.append(p);
 }
}
export function renderRichText(node,text,locale='en'){
 text=String(text??'');node.replaceChildren();
 // Bound expensive parsing; oversized answers remain readable and inert.
 if(text.length>200000){node.textContent=text;return;}
 const pattern=/```([\w+-]*)[^\n]*\n([\s\S]*?)```/g;let at=0;
 const prose=value=>{if(value)proseBlocks(node,value);};
 for(const match of text.matchAll(pattern)){prose(text.slice(at,match.index));const box=document.createElement('div'),head=document.createElement('div'),label=document.createElement('span'),copy=document.createElement('button'),pre=document.createElement('pre');box.className='code-block';head.className='code-block-header';label.textContent=codeLanguage(match[1]);copy.type='button';copy.textContent=locale==='fa'?'کپی کد':'Copy code';copy.onclick=async()=>{try{await navigator.clipboard.writeText(match[2]);copy.textContent=locale==='fa'?'کپی شد':'Copied';}catch{}};head.append(label,copy);highlightCode(pre,match[2],label.textContent);box.append(head,pre);node.append(box);at=match.index+match[0].length;}prose(text.slice(at));
}
