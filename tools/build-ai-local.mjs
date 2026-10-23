import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('assets/ai',{recursive:true});
await build({entryPoints:['tools/ai-local-worker.mjs'],outfile:'assets/ai/local-worker.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'eof'});
console.log('Built pinned on-device inference worker; no model weights downloaded.');
