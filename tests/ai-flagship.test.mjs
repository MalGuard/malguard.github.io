import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {renderRichText,safeMarkdownUrl} from '../ai/code-view.mjs';
import {createBuilder} from '../ai/builder.mjs';
import {createNavigation} from '../ai/navigation.mjs';
import {installFlagship,syncFlagship} from '../ai/flagship.mjs';

const dom=new JSDOM(readFileSync(new URL('../ai/index.html',import.meta.url),'utf8'),{url:'https://malguard.site/ai/'});
for(const name of ['document','navigator','Element','Event','MutationObserver'])Object.defineProperty(globalThis,name,{value:dom.window[name],configurable:true});
globalThis.addEventListener=dom.window.addEventListener.bind(dom.window);globalThis.innerWidth=1280;
const $=id=>document.getElementById(id);
const builder=createBuilder();
createNavigation({account:{open(){}},onLanguage(){}});
let route='home';
installFlagship({navigate:view=>{route=view;syncFlagship({view,busy:false});}});

test('all four navigation destinations select consistently without sending requests',()=>{
 for(const view of ['home','worker','chat','build']){
  document.querySelector('.flagship-dock [data-flagship-view="'+view+'"]').click();
  assert.equal(route,view);assert.equal(document.body.dataset.view,view);
  for(const button of document.querySelectorAll('[data-flagship-view]'))assert.equal(button.getAttribute('aria-pressed'),String(button.dataset.flagshipView===view));
 }
 syncFlagship({view:'chat',busy:true});
 assert.ok([...document.querySelectorAll('[data-flagship-view]')].every(b=>b.disabled));
 syncFlagship({view:'home',busy:false});
});

test('quick actions fill real composer without enabling sharing or submitting',()=>{
 let submitted=0;$('composer').addEventListener('submit',e=>{e.preventDefault();submitted++;});
 document.querySelector('.flagship-actions button:last-child').click();
 assert.equal(route,'worker');assert.match($('message').value,/milestones/);assert.equal(submitted,0);
 document.querySelector('.flagship-code-actions button').click();
 assert.match($('message').value,/Explain/);assert.match($('message').value,/milestones/,'choosing a template must preserve an existing draft');assert.equal($('build-share-code').checked,false);
 assert.equal($('model-consent').checked,false);assert.equal($('lookup-consent').checked,false);
 assert.match($('flagship-code-notice').textContent,/enable/);
});

test('image generation availability follows the real control',()=>{
 $('attach-media-generate').hidden=true;syncFlagship({view:'home',busy:false});assert.equal($('flagship-generate').disabled,true);
 $('attach-media-generate').hidden=false;$('attach-media-generate').disabled=false;syncFlagship({view:'home',busy:false});assert.equal($('flagship-generate').disabled,false);
 syncFlagship({view:'home',busy:true});assert.equal($('flagship-generate').disabled,true);syncFlagship({view:'home',busy:false});
});

test('file tabs select actual project files and highlight edits without parsing markup',async()=>{
 $('build-name').value='src/review.js';$('build-add').click();
 await new Promise(r=>setTimeout(r,0));
 const tab=[...document.querySelectorAll('.flagship-file-tabs button')].find(b=>b.textContent==='src/review.js');assert.ok(tab);tab.click();
 assert.equal($('build-file').value,'src/review.js');
 $('build-editor').value='const test = "<img src=x onerror=alert(1)>";';$('build-editor').dispatchEvent(new Event('input'));
 assert.match(document.querySelector('.flagship-syntax').textContent,/const test/);
 assert.equal(document.querySelector('.flagship-syntax img'),null);
 assert.ok(document.querySelector('.flagship-syntax .tok-keyword'));
 const tabEvent=new dom.window.KeyboardEvent('keydown',{key:'Tab',cancelable:true,bubbles:true});$('build-editor').dispatchEvent(tabEvent);assert.equal(tabEvent.defaultPrevented,false);
 const leave=new Event('beforeunload',{cancelable:true});dom.window.dispatchEvent(leave);assert.equal(leave.defaultPrevented,true);
 builder.reset();const afterReset=new Event('beforeunload',{cancelable:true});dom.window.dispatchEvent(afterReset);assert.equal(afterReset.defaultPrevented,false);
});

test('rich text renders headings, lists, tables, inline code and fenced code',()=>{
 const node=document.createElement('div');renderRichText(node,'## Summary\n\n**Key** `value`\n\n- First\n- Second\n\n| Name | Value |\n| --- | --- |\n| A | 42 |\n\n```js\nconst n = 1;\n```');
 assert.equal(node.querySelector('h3').textContent,'Summary');assert.equal(node.querySelectorAll('li').length,2);assert.equal(node.querySelectorAll('th').length,2);
 assert.equal(node.querySelector('td').textContent,'A');assert.equal(node.querySelector('strong').textContent,'Key');assert.equal(node.querySelector('code').textContent,'value');assert.ok(node.querySelector('pre .tok-keyword'));
});

test('untrusted model markup and unsafe links stay inert',()=>{
 const node=document.createElement('div');renderRichText(node,'<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n[bad](javascript:alert) [data](data:text/html,test) [creds](https://user:pass@example.com) [good](https://example.com/a)');
 assert.equal(node.querySelector('script,img,iframe'),null);assert.equal(node.querySelectorAll('a').length,1);
 assert.equal(node.querySelector('a').href,'https://example.com/a');assert.equal(node.querySelector('a').rel,'noopener noreferrer');
 for(const value of ['javascript:alert(1)','data:text/html,a','file:///etc/passwd','//example.com','https://u:p@example.com'])assert.equal(safeMarkdownUrl(value),null);
});

test('oversized and malformed answers remain bounded and readable',()=>{
 const node=document.createElement('div'),large='<script>'+('x'.repeat(200001));renderRichText(node,large);assert.equal(node.textContent,large);assert.equal(node.children.length,0);
 renderRichText(node,'| unmatched\n| -- |\n```js\nunclosed\n[unfinished');assert.match(node.textContent,/unclosed/);
});

test('new palette text contrast meets AA on its actual surface tokens',()=>{
 const luminance=hex=>{const [r,g,b]=hex.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b;};
 const pairs=[['f4f8ff','101c2c'],['a9bad0','18273b'],['c2cee0','101c2c'],['152b46','ffffff'],['354e6b','e9f1fb'],['48617d','edf3fb'],['ffffff','0872d3'],['ffffff','086ac6']];
 for(const [fg,bg] of pairs){const a=luminance(fg),b=luminance(bg);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,fg+' on '+bg);}
});
