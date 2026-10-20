import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from '@babel/parser';
import {messages,t,eventText,requestError} from './messages.js';
import {accountMessages,translateText,accountError} from './account-messages.js';
test('every controlled application label has English and Persian copy and placeholders resolve',()=>{
 for(const [key,pair]of Object.entries(messages)){assert.equal(pair.length,2);assert.ok(pair.every(value=>typeof value==='string'&&value.trim()),key);assert.equal(/[\u0600-\u06ff]/.test(pair[0]),false,key);assert.equal(/\{\w+\}/.test(t('en',key,{count:1,total:20,passed:20,seconds:3,version:'2.0.0'})),false,key);}
});
test('live phases and request errors use locale-aware controlled text rather than raw server messages',()=>{
 assert.match(eventText('fa',{phase:'item_started',completed:1,total:3}),/۲|2/);
 assert.equal(/[\u0600-\u06ff]/.test(requestError('en',{status:400,message:'شبکه خصوصی'})),false);
 assert.equal(/[a-z]/i.test(requestError('fa',{status:429,message:'arbitrary English error'})),false);
});
test('all account JSX labels and placeholders have a Persian translation',()=>{
 const ast=parse(readFileSync(new URL('./AccountDialog.jsx',import.meta.url),'utf8'),{sourceType:'module',plugins:['jsx']}),queue=[ast],strings=new Set();
 while(queue.length){const node=queue.pop();if(!node||typeof node!=='object')continue;if(node.type==='JSXOpeningElement'){const names=node.attributes.filter(item=>item.type==='JSXAttribute').map(item=>item.name.name);assert.equal(names.length,new Set(names).size,'Duplicate attributes must not override field labels');}if(node.type==='JSXText'&&/[a-z]/i.test(node.value))strings.add(node.value.trim());if(node.type==='JSXAttribute'&&['placeholder','aria-label'].includes(node.name?.name)&&node.value?.type==='StringLiteral'&&/[a-z]/i.test(node.value.value))strings.add(node.value.value);for(const value of Object.values(node)){if(Array.isArray(value))queue.push(...value);else if(value&&typeof value==='object')queue.push(value);}}
 for(const text of strings)assert.ok(accountMessages[text]&&translateText(text,'fa')!==text,text);
 assert.equal(/[a-z]/i.test(accountError('Unexpected provider error','fa')),false);
});
