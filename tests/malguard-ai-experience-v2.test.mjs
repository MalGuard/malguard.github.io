import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EXPERIENCE_PROMPTS,MODE_LINKS} from '../ai/experience-v2.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('ai/index.html');
const app=read('ai/app.js');
const navigation=read('ai/navigation.mjs');
const styles=read('ai/experience-v2.css');
const client=read('ai/experience-v2.mjs');

test('three modes remain separate with an always-visible accessible switcher',()=>{
 assert.deepEqual(MODE_LINKS,{chat:'chat-tab',worker:'workspace-tab',build:'build-tab'});
 for(const mode of ['chat','worker','build']){
  assert.match(html,new RegExp('id="experience-'+mode+'"'));
  assert.match(navigation,new RegExp("navigation-mode-"));
 }
 assert.match(html,/id="experience-tabs"[^>]*role="group"/);
 assert.match(html,/id="experience-chat"[^>]*aria-pressed="true"/);
 assert.match(client,/setAttribute\('aria-pressed'/);
 assert.match(client,/MODE_LINKS\[mode\]/);
 assert.doesNotMatch(client,/fetch\s*\(/,'visual navigation must not call a provider API');
});

test('Thinking is prominent, off by default, and retains the existing consent gate',()=>{
 assert.match(html,/id="thinking-toggle"[^>]*aria-pressed="false"[^>]*aria-describedby="thinking-state"/);
 assert.match(html,/id="thinking-state"[^>]*aria-live="polite"/);
 assert.match(client,/Thinking off/);
 assert.match(client,/Thinking on/);
 assert.match(app,/thinkingReady:thinkingCloudReady/);
 assert.match(app,/thinkingOn:thinkingCloudReady&&thinkingEnabled/);
 assert.match(app,/requestModelShare/);
 assert.match(app,/callCFModel\(\{mode:'code'/);
 assert.match(styles,/body\.mg-ai-v2 #thinking-toggle\[aria-pressed=true\]/);
});

test('starter prompts are localized, mode-specific and never auto-submitted',()=>{
 for(const mode of ['chat','worker','build']){
  for(const language of ['fa','en']){
   const prompts=EXPERIENCE_PROMPTS[mode][language];
   assert.equal(prompts.length,3);
   for(const [label,body] of prompts){
    assert.ok(label.length>3&&body.length>10&&body.length<=4000);
   }
  }
 }
 for(let i=0;i<3;i++)assert.match(html,new RegExp('data-quick-index="'+i+'"'));
 assert.match(client,/textarea\.value=entry\[1\]/);
 assert.match(client,/textarea\.dispatchEvent\(new Event\('input'/);
 assert.doesNotMatch(client,/\.requestSubmit\(/);
 assert.doesNotMatch(client,/\.submit\(/);
});

test('visual tokens support both themes, mobile, keyboard and reduced motion',()=>{
 assert.match(html,/class="mg-deep-space mg-ai-v2 auth-required"/);
 assert.match(html,/experience-v2\.css\?v=/);
 assert.match(html,/app\.js\?v=experience-v3-/);
 assert.ok(html.indexOf('mg-theme.css')<html.indexOf('experience-v2.css'));
 assert.match(styles,/html:is\(\.theme-light,\[data-theme=light\]\)/);
 assert.match(styles,/@media\(max-width:440px\)/);
 assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(styles,/body\.mg-ai-v2\.navigation-closed/);
 assert.match(client,/event\.key\.toLowerCase\(\)==='k'/);
 assert.match(client,/event\.altKey/);
 assert.match(client,/event\.preventDefault\(\)/);
 assert.match(navigation,/id='chat-search'/);
});

test('NEW badges are tiny emerald text chips, with no emoji in model selectors',()=>{
 const source=read('ai/app.js');
 assert.doesNotMatch(source,/🆕/);
 assert.match(source,/label\+' · NEW'/);
 assert.match(source,/m\.label\+' · NEW'/);
 assert.match(html,/id="composer-model-new"[^>]*class="mg-model-new"[^>]*>NEW</);
 assert.match(html,/id="workspace-model-new"[^>]*class="mg-model-new"[^>]*>NEW</);
 assert.match(html,/id="experience-new"[^>]*>NEW</);
 assert.match(source,/\$\('composer-model-new'\)\.hidden=/);
 assert.match(source,/\$\('workspace-model-new'\)\.hidden=/);
 assert.match(styles,/#experience-new/);
 assert.match(styles,/rgba\(34,197,94/);
 assert.match(styles,/\.mg-model-new:not\(\[hidden\]\)/);
 assert.match(styles,/html:is\(\.theme-light,\[data-theme=light\]\).*\.mg-model-new/);
});


test('UX v3 keeps model selection stable while exposing faster, safer input behavior',()=>{
 assert.match(app,/function updateModelSelectIfChanged\(select,choices\)/);
 assert.match(app,/if\(same\)return false/);
 assert.match(app,/function resizeComposerInput\(\)/);
 assert.match(app,/Math\.min\(field\.scrollHeight,185\)/);
 assert.match(app,/function refreshComposerInputState\(\)/);
 assert.match(app,/dataset\.modelReady=String\(ready\)/);
 assert.match(app,/hasWorkFile=activeMode==='worker'/);
 assert.match(app,/matchMedia\('\(pointer:fine\) and \(min-width: 761px\)'\)/);
 assert.match(app,/event\.ctrlKey\|\|event\.metaKey/);
 assert.match(app,/field\.style\.height='auto'/);
 assert.match(html,/id="composer-keyboard-hint"/);
 assert.match(html,/id="jump-latest"[^>]*hidden/);
 assert.match(html,/class="entry-capabilities"/);
 assert.match(styles,/\.model-select-wrap\[hidden\]/);
 assert.match(styles,/\.entry-capabilities/);
 assert.match(styles,/\.composer-area>\.jump-latest/);
});

test('UX v3 labels connections accurately and provides accessible sidebar dismissal',()=>{
 const nav=read('ai/navigation.mjs');
 assert.match(nav,/aria-controls','navigation'/);
 assert.match(nav,/Only the live service can confirm a connection/);
 assert.doesNotMatch(nav,/GitHub'[,]?'Not connected'/);
 assert.doesNotMatch(nav,/Not connected/);
 assert.match(nav,/hide\(false\)/);
 assert.match(nav,/if\(settings\.open\)/);
 assert.match(client,/new MutationObserver\(refreshJump\)/);
 assert.match(client,/Jump to latest message/);
 assert.match(client,/prefers-reduced-motion/);
 assert.match(html,/app\.js\?v=experience-v3-20261108/);
});
