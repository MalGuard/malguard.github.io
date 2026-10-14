import {build} from 'esbuild';
await build({entryPoints:['assets/fusion/gta-guard-source.js'],outfile:'assets/fusion/gta-guard.js',bundle:true,minify:true,target:'es2020',format:'iife',legalComments:'eof'});
