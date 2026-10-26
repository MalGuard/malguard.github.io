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
export function renderRichText(node,text,locale='en'){
 node.replaceChildren();const pattern=/```([\w+-]*)[^\n]*\n([\s\S]*?)```/g;let at=0;
 const prose=value=>{if(!value)return;const p=document.createElement('p');p.textContent=value;p.className='answer-prose';node.append(p);};
 for(const match of text.matchAll(pattern)){prose(text.slice(at,match.index));const box=document.createElement('div'),head=document.createElement('div'),label=document.createElement('span'),copy=document.createElement('button'),pre=document.createElement('pre');box.className='code-block';head.className='code-block-header';label.textContent=codeLanguage(match[1]);copy.type='button';copy.textContent=locale==='fa'?'کپی کد':'Copy code';copy.onclick=async()=>{try{await navigator.clipboard.writeText(match[2]);copy.textContent=locale==='fa'?'کپی شد':'Copied';}catch{}};head.append(label,copy);highlightCode(pre,match[2],label.textContent);box.append(head,pre);node.append(box);at=match.index+match[0].length;}prose(text.slice(at));
}
