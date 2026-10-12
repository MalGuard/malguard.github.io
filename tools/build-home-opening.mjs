import {build} from 'esbuild';
for(const name of ['scene','projection'])await build({
  entryPoints:[`assets/fusion/home-opening-${name}-source.js`],
  outfile:`assets/fusion/home-opening-${name}.js`,bundle:true,minify:true,
  format:'iife',target:'es2020',loader:{'.svg':'text'},legalComments:'eof'
});
