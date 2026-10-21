import {load} from 'cheerio';
import {inspectSite,documentBase} from './site-analysis.js';
import {analyzeWebsite} from './deep-analysis.js';

// Inspect only embedded HTML already received, never navigate, execute or fetch.
// Both expansion and parsing are bounded against nested/encoded document bombs.
export function analyzeEmbeddedDocuments(root,pageUrl){
 const queue=[{$:root,depth:0,base:documentBase(root,pageUrl)}],signals=[],seen=new Set();
 let analyzed=0,omitted=0,bytes=0;const maxDocuments=8,maxDepth=2,maxBytes=128*1024;
 while(queue.length){
  const parent=queue.shift();
  parent.$('iframe,frame,object,embed').each((_,el)=>{
   const node=parent.$(el),srcdoc=node.attr('srcdoc');
   const source=srcdoc!==undefined?srcdoc:node.attr('src')||node.attr('data')||'';
   if(srcdoc===undefined&&!/^data:text\/html(?:[;,])/i.test(source))return;
   if(parent.depth>=maxDepth||analyzed>=maxDocuments||Buffer.byteLength(source)>maxBytes*2){omitted++;return;}
   let html=source;
   try{if(srcdoc===undefined){const comma=source.indexOf(','),header=source.slice(0,comma),body=source.slice(comma+1);if(/;base64$/i.test(header)){if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body)){omitted++;return;}html=Buffer.from(body,'base64').toString('utf8');}else html=decodeURIComponent(body);}}catch{omitted++;return;}
   const size=Buffer.byteLength(html);if(bytes+size>maxBytes){omitted++;return;}if(seen.has(html))return;seen.add(html);bytes+=size;analyzed++;
   const child=load(html);if(!child('base[href]').length)child('head').prepend(child('<base>').attr('href',parent.base));
   const independent=inspectSite(child,pageUrl),analysis=analyzeWebsite(child,pageUrl,independent.signals);
   if(analysis.modules.some(m=>m.coverage==='limited'))omitted++;
   for(const finding of analysis.signals){
    // Hostname identity is checked once on the actual page, never on a spoofed base.
    if(['url-identity','brand-domain'].includes(finding.module))continue;
    signals.push({...finding,documentScope:'embedded',embeddedDocument:analyzed,evidence:[`Embedded HTML ${analyzed}, depth ${parent.depth+1}`,...(finding.evidence||[])].slice(0,5)});
   }
   queue.push({$:child,depth:parent.depth+1,base:documentBase(child,pageUrl)});
  });
 }
 return {signals,summary:{status:omitted?'incomplete':'done',documentsAnalyzed:analyzed,omittedDocuments:omitted,decodedBytes:bytes,maxDocuments,maxDepth,maxBytes,javaScriptExecuted:false,externalResourcesFetched:false}};
}
