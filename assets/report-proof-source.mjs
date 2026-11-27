import {sha256} from '@noble/hashes/sha256';
import {bytesToHex,utf8ToBytes} from '@noble/hashes/utils';
self.onmessage=event=>{
  const {challenge,payload,difficulty}=event.data;if(difficulty!==15){self.postMessage({error:'Unsupported verification'});return;}
  const bodyHash=bytesToHex(sha256(utf8ToBytes(JSON.stringify([payload.kind,payload.message,payload.name,payload.email]))));
  const prefix=challenge+'\n'+bodyHash+'\n';
  for(let nonce=0;nonce<10000000;nonce++){const proof=sha256(utf8ToBytes(prefix+nonce));if(proof[0]===0&&proof[1]<2){self.postMessage({nonce:String(nonce)});return;}}
  self.postMessage({error:'Verification expired'});
};
