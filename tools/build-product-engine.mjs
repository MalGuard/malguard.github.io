import {build} from 'esbuild';
await build({entryPoints:['tools/product-engine3d.mjs'],outfile:'assets/precision/product-engine3d.js',bundle:true,format:'esm',target:'es2022',minify:true,legalComments:'eof'});
console.log('Built the lazy-loaded local Three.js product engine.');
