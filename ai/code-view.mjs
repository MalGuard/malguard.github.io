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
// Safe Markdown subset: DOM nodes and textContent only, never HTML strings.
const SAFE_LINK=/^(?:https:\/\/|http:\/\/|mailto:)/i;
export function renderInline(parent,text){
 const rule=/(`+)([^`]+?)\1|\*\*([^*]+?)\*\*|__([^_]+?)__|(?<![\w*])\*([^*\s][^*]*?)\*(?!\w)|(?<![\w_])_([^_\s][^_]*?)_(?![\w])|~~([^~]+?)~~|\[([^\]\n]{1,300})\]\(([^)\s]{1,2000})\)/g;
 let at=0;
 for(const m of text.matchAll(rule)){
  if(m.index>at)parent.append(document.createTextNode(text.slice(at,m.index)));
  let node;
  if(m[2]!==undefined){node=document.createElement('code');node.className='md-inline-code';node.textContent=m[2];}
  else if(m[3]!==undefined||m[4]!==undefined){node=document.createElement('strong');renderInline(node,m[3]??m[4]);}
  else if(m[5]!==undefined||m[6]!==undefined){node=document.createElement('em');renderInline(node,m[5]??m[6]);}
  else if(m[7]!==undefined){node=document.createElement('del');renderInline(node,m[7]);}
  else if(m[8]!==undefined){
   if(SAFE_LINK.test(m[9])){node=document.createElement('a');node.href=m[9];node.target='_blank';node.rel='noopener noreferrer nofollow';node.className='md-link';renderInline(node,m[8]);}
   else node=document.createTextNode(m[0]);
  }
  parent.append(node);at=m.index+m[0].length;
 }
 if(at<text.length)parent.append(document.createTextNode(text.slice(at)));
}
function renderMarkdown(node,source){
 const lines=source.replace(/\r\n?/g,'\n').split('\n');let i=0;
 const make=(tag,cls)=>{const n=document.createElement(tag);if(cls)n.className=cls;return n;};
 const isTable=(a,b)=>/^\s*\|.*\|\s*$/.test(a||'')&&/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(b||'');
 const cells=row=>row.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(c=>c.trim());
 const listItem=/^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/;
 while(i<lines.length){
  const line=lines[i];
  if(!line.trim()){i++;continue;}
  let m;
  if((m=line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/))){const h=make('h'+Math.min(6,m[1].length+2),'md-heading');renderInline(h,m[2]);node.append(h);i++;continue;}
  if(/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)){node.append(make('hr','md-rule'));i++;continue;}
  if(isTable(line,lines[i+1])){
   const wrap=make('div','md-table-wrap'),table=make('table','md-table'),thead=make('thead'),tbody=make('tbody'),hr=make('tr');
   for(const c of cells(line)){const th=make('th');renderInline(th,c);hr.append(th);}thead.append(hr);i+=2;
   while(i<lines.length&&/^\s*\|.*\|\s*$/.test(lines[i])){const tr=make('tr');for(const c of cells(lines[i])){const td=make('td');renderInline(td,c);tr.append(td);}tbody.append(tr);i++;}
   table.append(thead,tbody);wrap.append(table);node.append(wrap);continue;
  }
  if(/^\s*>/.test(line)){const q=make('blockquote','md-quote');const buf=[];while(i<lines.length&&/^\s*>/.test(lines[i])){buf.push(lines[i].replace(/^\s*>\s?/,''));i++;}const p=make('p','answer-prose');renderInline(p,buf.join('\n'));q.append(p);node.append(q);continue;}
  if((m=line.match(listItem))){
   const ordered=/\d/.test(m[2]),list=make(ordered?'ol':'ul','md-list');
   if(ordered){const start=parseInt(m[2],10);if(start>1)list.start=start;}
   while(i<lines.length){const x=lines[i].match(listItem);if(!x||/\d/.test(x[2])!==ordered){if(lines[i]&&/^\s{2,}\S/.test(lines[i])&&list.lastElementChild){list.lastElementChild.append(document.createTextNode('\n'));renderInline(list.lastElementChild,lines[i].trim());i++;continue;}break;}
    const li=make('li');if(x[1].length>=2)li.className='md-nested';const task=x[3].match(/^\[([ xX])\]\s+(.*)$/);if(task){li.classList.add('md-task');const box=make('span','md-check');box.textContent=task[1]===' '?'☐':'☑';li.append(box,document.createTextNode(' '));renderInline(li,task[2]);}else renderInline(li,x[3]);list.append(li);i++;}
   node.append(list);continue;
  }
  const buf=[lines[i]];i++;
  while(i<lines.length&&lines[i].trim()&&!/^(#{1,6})\s+/.test(lines[i])&&!/^\s*>/.test(lines[i])&&!listItem.test(lines[i])&&!isTable(lines[i],lines[i+1])&&!/^\s*([-*_])(\s*\1){2,}\s*$/.test(lines[i])){buf.push(lines[i]);i++;}
  const p=make('p','answer-prose');renderInline(p,buf.join('\n'));node.append(p);
 }
}
export function prepareStreamingMarkdown(text){
 const src=String(text??'').replace(/\r\n?/g,'\n');
 const ticks=(src.match(/```/g)||[]).length;
 let out=ticks%2===1?src+'\n```':src;
 const lines=out.split('\n');
 let i=lines.length-1;
 while(i>=0&&!lines[i].trim())i--;
 if(i>=0&&/^\s*\|.*\|\s*$/.test(lines[i])){
  const sep=/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
  if(!sep.test(lines[i])&&!sep.test(lines[i-1]||'')){
   const cols=lines[i].trim().replace(/^\|/,'').replace(/\|$/,'').split('|').length;
   lines.push('| '+Array.from({length:Math.max(1,cols)},()=>'---').join(' | ')+' |');
   out=lines.join('\n');
  }
 }
 return out;
}
export function renderRichText(node,text,locale='en',{streaming=false}={}){
 node.replaceChildren();const source=streaming?prepareStreamingMarkdown(text):text;const pattern=/```([\w+-]*)[^\n]*\n([\s\S]*?)```/g;let at=0;
 const prose=value=>{if(!value||!value.trim())return;renderMarkdown(node,value);};
 for(const match of source.matchAll(pattern)){prose(source.slice(at,match.index));const box=document.createElement('div'),head=document.createElement('div'),label=document.createElement('span'),copy=document.createElement('button'),pre=document.createElement('pre');box.className='code-block';box.dir='ltr';head.className='code-block-header';label.textContent=codeLanguage(match[1]);copy.type='button';copy.className='code-copy';const idle=locale==='fa'?'کپی کد':'Copy code',done=locale==='fa'?'کپی شد':'Copied';copy.textContent=idle;copy.onclick=async()=>{try{await navigator.clipboard.writeText(match[2]);copy.textContent=done;copy.dataset.copied='true';setTimeout(()=>{copy.textContent=idle;delete copy.dataset.copied;},1800);}catch{}};head.append(label,copy);highlightCode(pre,match[2],label.textContent);box.append(head,pre);node.append(box);at=match.index+match[0].length;}prose(source.slice(at));
}
