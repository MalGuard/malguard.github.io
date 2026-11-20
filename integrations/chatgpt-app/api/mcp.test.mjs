import test from 'node:test';
import assert from 'node:assert/strict';
import {makeChatGPTServer} from './mcp.mjs';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';

async function createPair(scanner){
  const server=makeChatGPTServer(scanner);
  const client=new Client({name:'malguard-test-client',version:'0.1.0'});
  const [a,b]=InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a),client.connect(b)]);
  return {server,client};
}
test('MCP initializes, advertises read-only link tool and returns evidence',async()=>{
  const {server,client}=await createPair(async ()=>({status:'warning',pageFetch:{status:'done'},signals:[{level:'warning',title:'Observed warning',detail:'Redirect observed'}]}));
  try {
    const {tools}=await client.listTools();
    assert.equal(tools.length,1);
    assert.equal(tools[0].name,'check_public_link');
    assert.equal(tools[0].annotations.readOnlyHint,true);
    const r=await client.callTool({name:'check_public_link',arguments:{url:'https://example.org/'}});
    assert.equal(r.isError,undefined);
    assert.equal(r.structuredContent.status,'warning_signs');
    assert.equal(r.structuredContent.reputation_checked,false);
  }finally {await client.close();await server.close();}
});
test('MCP rejects private or credential-bearing URL',async()=>{
  const {server,client}=await createPair(async()=>{throw new Error('must not be called')});
  try {
    const r=await client.callTool({name:'check_public_link',arguments:{url:'http://127.0.0.1/'}});
    assert.equal(r.isError,true);
  }finally {await client.close();await server.close();}
});
test('MCP does not expose scanner error details',async()=>{
  const {server,client}=await createPair(async()=>{throw new Error('secrets cannot appear here')});
  try {
    const r=await client.callTool({name:'check_public_link',arguments:{url:'https://example.org/'}});
    assert.equal(r.isError,true);assert.doesNotMatch(JSON.stringify(r),/secrets cannot appear here/);
  }finally {await client.close();await server.close();}
});
