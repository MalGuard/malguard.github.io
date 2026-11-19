import {createServer} from 'node:http';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {z} from 'zod';
import {performScan} from './scan-core.mjs';

export async function scanUsingExistingEngine(url, options) {
  const {scanSite} = await import('../../services/game-scam-guard/server/scanner.js');
  return scanSite(url, options);
}
export function makeMcpServer(scanner = scanUsingExistingEngine) {
  const server = new McpServer({name:'malguard-link-inspector',version:'0.1.0'}, {
    instructions:'Inspect public links only when a user requests it. Present observed evidence, uncertainty, and coverage limits. Never say a URL is safe or verified based on a clean scan. Never ask for passwords, login tokens, or private URLs.'
  });
  server.registerTool('check_public_link', {
    title: 'Check a public website link with MalGuard',
    description: 'Passive security inspection of a public website URL using MalGuard Game Scam Guard. Reads guarded public HTML only; no login, file download, code execution, browser interaction, or reputation-service requests. Returns evidence and uncertainty, never a safety guarantee.',
    inputSchema: {url: z.string().min(1).max(2048).describe('Public HTTP(S) URL; never provide private links or authentication tokens.')},
    annotations: {readOnlyHint:true,openWorldHint:true,destructiveHint:false},
  }, async ({url}) => {
    try {
      const result = await performScan(url, scanner);
      return {content:[{type:'text',text: result.message+'\n'+result.evidence.map(e=>'- '+e.finding+': '+e.detail).join('\n')+'\nLimits: '+result.limitations.join(' ')}],structuredContent:result};
    } catch (error) {
      const msg = (error?.message || '').slice(0,250);
      return {isError:true,content:[{type:'text',text: 'Inspection not completed: '+(msg || 'service error')+'. Do not infer this URL is safe.'}]};
    }
  });
  return server;
}
export function createHttpServer(scanner=scanUsingExistingEngine) {
  const seen = new Map(); // Preview-only throttle; use a distributed rate limiter before release.
  return createServer(async (req,res) => {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    if (req.method==='GET' && req.url==='/health') {
      res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({status:'ok',purpose:'preview-only'}));
      return;
    }
    if (req.url!=='/mcp' || !['POST','GET','DELETE'].includes(req.method)) {res.writeHead(404).end('Not found');return;}
    const origin=req.headers.origin;
    if(origin && origin!=='https://chatgpt.com') {res.writeHead(403).end('Origin not allowed');return;}
    const client=req.socket.remoteAddress || 'unknown', now=Date.now(),entry=seen.get(client);
    if(!entry || entry.until<=now) seen.set(client,{count:1,until:now+60000});
    else if(++entry.count>12) {res.writeHead(429).end('Rate limited');return;}
    if(seen.size>1000) for(const [key,value] of seen)if(value.until<=now)seen.delete(key);
    if(Number(req.headers['content-length']||0)>65536) {res.writeHead(413).end('Request too large');return;}
    const mcp=makeMcpServer(scanner);
    const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
    res.on('close',()=>{void transport.close();void mcp.close();});
    try {await mcp.connect(transport);await transport.handleRequest(req,res);}
    catch(error){console.error('MCP request failed',error?.name || 'Unknown');if(!res.headersSent)res.writeHead(500).end('MCP request failed');}
  });
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
  const port=Number(process.env.PORT||8787);
  createHttpServer().listen(port,()=>console.log('MalGuard MCP preview listening on http://localhost:'+port+'/mcp'));
}
