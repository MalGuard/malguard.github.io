import test from 'node:test';
import assert from 'node:assert/strict';
import {createLibrary,validateLibrary} from './ai-library.js';
const sample=()=>({chats:[{id:'chat-1',title:'Synthetic chat',mode:'chat',updatedAt:1,archived:false,messages:[{role:'user',text:'hello'}]}],notes:['Synthetic note']});
test('private account library never accepts a caller-selected owner or object path',async()=>{
 const objects=new Map(),paths=[];
 const fetchImpl=async(url,options)=>{paths.push(url);const path=new URL(url).pathname;if(path.includes('/bucket/'))return Response.json({public:false});if(options.method==='POST'){objects.set(path,JSON.parse(options.body));return Response.json({ok:true});}return objects.has(path)?Response.json(objects.get(path)):Response.json({error:'missing'},{status:404});};
 const auth={session:({sessionToken})=>{if(!['A','B'].includes(sessionToken))throw Object.assign(Error(),{status:401});return {email:`${sessionToken}@example.com`,expiresAt:Date.now()+60000};}};
 const library=createLibrary({auth,url:'https://synthetic.supabase.co',key:'synthetic-test-key',fetchImpl});
 await library('A',sample());assert.deepEqual(await library('B'),{chats:[],notes:[]});assert.deepEqual(await library('A'),sample());
 const b=sample();b.notes=['Account B'];await library('B',b);assert.deepEqual((await library('A')).notes,['Synthetic note']);
 await assert.rejects(()=>library('invalid'),{status:401});await assert.rejects(()=>library('B',{...sample(),owner:'A'}),{status:400});
 assert.ok(paths.every(p=>!p.includes('example.com')));
});
test('public bucket fails closed without reading or writing chat content',async()=>{
 let reads=0;const library=createLibrary({auth:{session:()=>({email:'a@example.com',expiresAt:Date.now()+60000})},url:'https://synthetic.supabase.co',key:'test',fetchImpl:async()=>{reads++;return Response.json({public:true});}});
 await assert.rejects(()=>library('A',sample()),{status:503});assert.equal(reads,1);
});
test('bounded schema excludes executable reports, attachments and excessive notes',()=>{
 assert.throws(()=>validateLibrary({...sample(),notes:Array(21).fill('x')}),{status:400});
 assert.throws(()=>validateLibrary({...sample(),chats:[{...sample().chats[0],id:'../other'}]}),{status:400});
 const value=sample();value.chats[0].messages[0].file='private';assert.equal(validateLibrary(value).chats[0].messages[0].file,undefined);
 assert.throws(()=>validateLibrary({...sample(),notes:['x'.repeat(1001)]}),{status:400});
});
