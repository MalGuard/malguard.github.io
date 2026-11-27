export function apiUrl(endpoint,hostname=globalThis.location?.hostname){
 if(!['status','chat'].includes(endpoint))throw new Error('invalid_endpoint');
 const base=['malguard.site','www.malguard.site','malguard.github.io'].includes(hostname)?'https://game-scam-guard-connected.vercel.app':'';
 return `${base}/api/malguard-ai/${endpoint}`;
}
export async function readNDJSON(response,receive,{maxBytes=256*1024,terminal}){
 if(!response.headers.get('content-type')?.includes('application/x-ndjson'))throw new Error('invalid_stream_type');
 const reader=response.body?.getReader(),decoder=new TextDecoder();let buffer='',total=0,final=false;
 if(!reader)throw new Error('missing_stream_body');
 const consume=line=>{if(!line.trim())return;const item=JSON.parse(line);if(final)throw new Error('extra_stream_data');if(terminal(item))final=true;receive(item);};
 try{while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>maxBytes)throw new Error('stream_too_large');buffer+=decoder.decode(value,{stream:true});let i;while((i=buffer.indexOf('\n'))>=0){consume(buffer.slice(0,i));buffer=buffer.slice(i+1);}}buffer+=decoder.decode();if(buffer.trim())consume(buffer);if(!final)throw new Error('incomplete_stream');}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}

export function readStream(response,receive){
 return readNDJSON(response,receive,{terminal:item=>item.result||item.error});
}
