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
function inlineMarkdown(node,value){
 const pattern=/`([^`\n]+)`|\*\*([^*\n]+)\*\*/g;
 let offset=0;
 for(const match of value.matchAll(pattern)){
  node.append(document.createTextNode(value.slice(offset,match.index)));
  const part=document.createElement(match[1]?'code':'strong');
  part.textContent=match[1]||match[2];
  node.append(part);
  offset=match.index+match[0].length;
 }
 node.append(document.createTextNode(value.slice(offset)));
}
function markdownProse(node,value,locale){
 const lines=value.split(/\r?\n/);
 const listItem=line=>/^\s*(?:([-+*])|(\d{1,6})\.)\s+(.+)$/.exec(line);
 const cells=line=>{
  const trimmed=line.trim();
  if(!trimmed.includes('|'))return [];
  return trimmed.replace(/^\||\|$/g,'').split('|').map(cell=>cell.trim());
 };
 const isTable=index=>{
  const headers=cells(lines[index]||''),separator=cells(lines[index+1]||'');
  return headers.length>1&&headers.length<=12&&headers.length===separator.length&&separator.every(cell=>/^:?-{3,}:?$/.test(cell));
 };
 for(let index=0;index<lines.length;){
  const line=lines[index];
  if(!line.trim()){index++;continue;}
  if(isTable(index)){
   const wrapper=document.createElement('div'),table=document.createElement('table'),head=document.createElement('thead'),body=document.createElement('tbody');
   wrapper.className='answer-table';
   wrapper.tabIndex=0;
   wrapper.setAttribute('role','region');
   wrapper.setAttribute('aria-label',locale==='fa'?'جدول پاسخ':'Response table');
   const headers=cells(line);
   function row(parent,values,tag){
    const tr=document.createElement('tr');
    for(const value of values){const cell=document.createElement(tag);if(tag==='th')cell.scope='col';inlineMarkdown(cell,value);tr.append(cell);}
    parent.append(tr);
   }
   row(head,headers,'th');
   index+=2;
   while(index<lines.length){
    const values=cells(lines[index]);
    if(values.length!==headers.length)break;
    row(body,values,'td');
    index++;
   }
   table.append(head,body);wrapper.append(table);node.append(wrapper);
   continue;
  }
  const heading=/^(#{1,6})\s+(.+)$/.exec(line);
  if(heading){
   const title=document.createElement(heading[1].length<=2?'h3':'h4');
   inlineMarkdown(title,heading[2]);node.append(title);index++;continue;
  }
  const item=listItem(line);
  if(item){
   const ordered=!!item[2],list=document.createElement(ordered?'ol':'ul');
   if(ordered)list.start=Number(item[2]);
   while(index<lines.length){
    const next=listItem(lines[index]);
    if(!next||!!next[2]!==ordered)break;
    const li=document.createElement('li');inlineMarkdown(li,next[3]);list.append(li);index++;
   }
   node.append(list);continue;
  }
  const paragraph=document.createElement('p'),content=[line];
  paragraph.className='answer-prose';
  index++;
  while(index<lines.length&&lines[index].trim()&&!/^#{1,6}\s+/.test(lines[index])&&!listItem(lines[index])&&!isTable(index))content.push(lines[index++]);
  inlineMarkdown(paragraph,content.join('\n'));node.append(paragraph);
 }
}
export function renderRichText(node,text,locale='en'){
 node.replaceChildren();const pattern=/```([\w+-]*)[^\n]*\n([\s\S]*?)```/g;let at=0;
 const prose=value=>markdownProse(node,value,locale);
 for(const match of text.matchAll(pattern)){prose(text.slice(at,match.index));const box=document.createElement('div'),head=document.createElement('div'),label=document.createElement('span'),copy=document.createElement('button'),pre=document.createElement('pre');box.className='code-block';head.className='code-block-header';label.textContent=codeLanguage(match[1]);copy.type='button';copy.textContent=locale==='fa'?'کپی کد':'Copy code';copy.onclick=async()=>{try{await navigator.clipboard.writeText(match[2]);copy.textContent=locale==='fa'?'کپی شد':'Copied';}catch{}};head.append(label,copy);highlightCode(pre,match[2],label.textContent);box.append(head,pre);node.append(box);at=match.index+match[0].length;}prose(text.slice(at));
}
