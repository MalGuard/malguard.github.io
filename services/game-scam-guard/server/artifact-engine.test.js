import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ZipWriter,Uint8ArrayWriter,TextReader} from '@zip.js/zip.js';
import {analyzeArtifact} from './artifact-analysis.js';
import {analyzeArtifactRaw} from './artifact-engine.js';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function zip(entries,options={}){
  const out=new Uint8ArrayWriter(),writer=new ZipWriter(out,{useWebWorkers:false});
  for(const [name,text]of entries)await writer.add(name,new TextReader(text),options);
  await writer.close();return Buffer.from(await out.getData());
}

test('independent script evidence is cautious, location-specific and does not execute samples',async()=>{
  const sample=Buffer.from('const fixture="Cookies"; const fixtureUrl="https://example.com/";');
  const report=await analyzeArtifact(sample,'fixture.js');
  assert.equal(report.sha256,sha(sample));assert.equal(report.executed,false);assert.equal(report.findings[0].rule,'credentials_and_transfer');
  assert.equal(report.findings[0].location,'fixture.js');
  const benign=await analyzeArtifact(Buffer.from('console.log("harmless fixture")'),'benign.js');assert.equal(benign.findings.length,0);
});

test('ZIP members are read, hashed and analyzed in memory without execution or disk extraction',async()=>{
  const content='print("harmless fixture")';const bytes=await zip([['mod.lua',content],['package.json','{"scripts":{"postinstall":"echo harmless"}}']]);
  const report=await analyzeArtifact(bytes,'mod.zip');assert.equal(report.archive.inspected,2);assert.equal(report.archive.complete,true);
  assert.equal(report.archive.entries[0].sha256,sha(Buffer.from(content)));assert.ok(report.findings.some(f=>f.rule==='install_script'));
  assert.equal(report.executed,false);
});

test('AES-encrypted ZIP supports an ephemeral password and never serializes it in evidence',async()=>{
  const password='fixture-password-only';const bytes=await zip([['mod.lua','print("fixture")']],{password,encryptionStrength:3});
  const locked=await analyzeArtifact(bytes,'locked.zip');assert.equal(locked.status,'needs_password');
  const opened=await analyzeArtifact(bytes,'locked.zip',{password});assert.equal(opened.archive.inspected,1);assert.equal(opened.archive.entries[0].status,'inspected');assert.ok(!JSON.stringify(opened).includes(password));
  const wrong=await analyzeArtifact(bytes,'locked.zip',{password:'wrong'});assert.notEqual(wrong.status,'complete');
});

test('archive traversal and inflated-size budgets block members rather than extracting them',async()=>{
  const bytes=await zip([['../escape.lua','print("fixture")']]);
  const blocked=await analyzeArtifact(bytes,'unsafe-path.zip');assert.notEqual(blocked.status,'complete');assert.equal(blocked.archive.inspected,0);assert.ok(blocked.findings.some(f=>f.rule==='archive_unsafe_path'));
  const bomb=await zip([['large.lua','fixture']]);const central=bomb.indexOf(Buffer.from('504b0102','hex'));assert.ok(central>=0);bomb.writeUInt32LE(3*1024*1024,central+24);
  const capped=await analyzeArtifact(bomb,'size-fixture.zip');assert.equal(capped.archive.entries[0].status,'budget_exceeded');assert.equal(capped.archive.inspected,0);
});

test('invalid PE, active PDF and unsupported formats never gain a complete clean verdict',async()=>{
  const pe=await analyzeArtifact(Buffer.from('MZsynthetic invalid fixture'),'bad.exe');assert.equal(pe.status,'partial');assert.ok(pe.findings.some(f=>f.rule==='invalid_pe'));
  const pdf=await analyzeArtifact(Buffer.from('%PDF-1.7 /JavaScript /OpenAction'),'active-fixture.pdf');assert.equal(pdf.status,'partial');assert.ok(pdf.findings.some(f=>f.rule==='pdf_active_content'));
  const unknown=await analyzeArtifact(Buffer.from('fixture'),'unknown.bin');assert.equal(unknown.status,'unsupported');
});

test('malformed archives and worker timeout produce an inconclusive outcome',async()=>{
  const malformed=await analyzeArtifactRaw(Buffer.from('PK\x03\x04fixture'),'bad.zip');assert.equal(malformed.status,'partial');
  await assert.rejects(analyzeArtifact(Buffer.from('fixture'),'test.js',{timeout:1}),/زمان تحلیل/);
});

test('nested ZIP content is inspected with a shared depth/byte/member budget',async()=>{
  const child=await zip([['nested.lua','print("harmless nested fixture")']]);
  const {Uint8ArrayReader}=await import('@zip.js/zip.js');const out=new Uint8ArrayWriter(),writer=new ZipWriter(out,{useWebWorkers:false});
  await writer.add('inner.zip',new Uint8ArrayReader(child));await writer.close();
  const result=await analyzeArtifact(Buffer.from(await out.getData()),'outer.zip');
  assert.equal(result.archive.entries[0].status,'nested_inspected');assert.equal(result.archive.entries[0].nested.archive.entries[0].name,'nested.lua');assert.equal(result.executed,false);
});

test('existing GTA Guard rules are actually reused for DLL inspection, without network or sample execution',async()=>{
  const bytes=Buffer.alloc(1024);bytes.write('MZ');bytes.writeUInt32LE(0x80,0x3c);bytes.write('PE\0\0',0x80);bytes.writeUInt16LE(0x14c,0x84);bytes.writeUInt16LE(1,0x86);bytes.writeUInt16LE(0xe0,0x94);bytes.writeUInt16LE(0x2102,0x96);
  const optional=0x98;bytes.writeUInt16LE(0x10b,optional);bytes.writeUInt32LE(0x1000,optional+16);bytes.writeUInt32LE(0x400000,optional+28);bytes.writeUInt32LE(0x1000,optional+32);bytes.writeUInt32LE(0x200,optional+36);bytes.writeUInt32LE(0x2000,optional+56);bytes.writeUInt32LE(0x200,optional+60);bytes.writeUInt32LE(16,optional+92);
  const section=optional+0xe0;bytes.write('.text',section);bytes.writeUInt32LE(512,section+8);bytes.writeUInt32LE(0x1000,section+12);bytes.writeUInt32LE(512,section+16);bytes.writeUInt32LE(512,section+20);bytes.writeUInt32LE(0x60000020,section+36);
  const result=await analyzeArtifact(bytes,'synthetic.dll');assert.equal(result.peEngine.version,'2.2.2');assert.equal(result.peEngine.rulesStatus,'official');assert.equal(result.peEngine.peValid,true);assert.equal(result.executed,false);assert.equal(result.sha256,sha(bytes));
});


test('layered fallback decodes only literal data and exposes real coverage and network strings',async()=>{
  const literal=Buffer.from('Cookies https://example.com/fixture').toString('base64');
  const report=await analyzeArtifact(Buffer.from('const encoded="'+literal+'";'),'literal.js');
  assert.equal(report.version,'1.1.0');assert.equal(report.executed,false);
  assert.ok(report.findings.some(item=>item.rule==='credentials_and_transfer'&&item.location.includes('base64 literal')));
  assert.ok(report.layers.some(layer=>layer.id==='encoded_literals'&&layer.detail.includes('1')));
  assert.ok(report.layers.some(layer=>layer.id==='identity'));
  assert.ok(!report.observedUrls.length);
  const mismatch=await analyzeArtifact(Buffer.from('print("fixture")'),'document.pdf');
  assert.ok(mismatch.findings.some(item=>item.rule==='signature_mismatch'));assert.equal(mismatch.status,'unsupported');
});
test('ELF header bounds and unsupported machine-code coverage remain explicit',async()=>{
  const bytes=Buffer.alloc(64);Buffer.from('7f454c46','hex').copy(bytes);bytes[4]=2;bytes[5]=1;bytes[6]=1;
  bytes.writeUInt16LE(62,18);bytes.writeBigUInt64LE(4096n,32);bytes.writeUInt16LE(56,54);bytes.writeUInt16LE(1,56);
  const report=await analyzeArtifact(bytes,'fixture.elf');
  assert.equal(report.status,'partial');assert.ok(report.findings.some(item=>item.rule==='invalid_elf'));
  assert.equal(report.layers.find(layer=>layer.id==='structure').status,'partial');assert.equal(report.executed,false);
});
