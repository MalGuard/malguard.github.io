import test from 'node:test';
import assert from 'node:assert/strict';
import {ZipReader,Uint8ArrayReader,TextWriter} from '@zip.js/zip.js';
import {starterFiles,validateFiles,parseProposal,codingPrompt,projectZip} from '../../../ai/build-project.mjs';
test('coding proposals require a bounded complete-file object and never accept unsafe paths',()=>{
 assert.equal(parseProposal('A text answer'),null);assert.equal(parseProposal('{"summary":"hi","files":{"../../x.js":"bad"}}'),null);
 for(const files of [{'/tmp/x.py':''},{'x.exe':''},{'x.js':'a'.repeat(262145)},{'x.js':'ع'.repeat(131073)}])assert.throws(()=>validateFiles(files));
 assert.throws(()=>validateFiles(Object.fromEntries(Array.from({length:33},(_,i)=>[`f${i}.js`,'']))));
 const p=parseProposal('```json\n'+JSON.stringify({summary:'A small change',files:{'app.js':'alert(1)'}})+'\n```');assert.equal(p.files['app.js'],'alert(1)');assert.equal(globalThis.alert,undefined);
});
test('coding prompt includes only explicitly supplied code and refuses silent truncation',()=>{
 const text=codingPrompt('Build a counter');assert.ok(!text.includes(starterFiles['app.js']));assert.match(text,/Do not claim tests/);assert.throws(()=>codingPrompt('x'.repeat(4000)));
 assert.match(codingPrompt('Edit',{name:'app.js',content:'PRIVATE_MARKER'}),/PRIVATE_MARKER/);assert.throws(()=>codingPrompt('edit',{name:'app.js',content:'x'.repeat(4000)}));
});
test('export is a real ZIP readable by an independent ZIP implementation',async()=>{
 const files=validateFiles({...starterFiles,'src/hello.py':'print("سلام")\n'}),bytes=new Uint8Array(await projectZip(files).arrayBuffer());
 const reader=new ZipReader(new Uint8ArrayReader(bytes));try{const entries=await reader.getEntries();assert.equal(entries.length,4);for(const entry of entries)assert.equal(await entry.getData(new TextWriter()),files[entry.filename]);}finally{await reader.close();}
});
