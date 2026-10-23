import express from 'express';
import {fileURLToPath} from 'node:url';
import app from './app.js';
const server=express();
server.use('/api/malguard-ai',app);
server.get('/assets/fusion/assets/malguard-logo.svg',(req,res)=>res.sendFile(fileURLToPath(new URL('../../../assets/fusion/assets/malguard-logo.svg',import.meta.url))));
server.use('/ai',express.static(fileURLToPath(new URL('../../../ai/',import.meta.url)),{setHeaders:res=>{
  res.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
}}));
server.listen(8787,'127.0.0.1',()=>console.info('MalGuard AI local: http://127.0.0.1:8787/ai/'));
