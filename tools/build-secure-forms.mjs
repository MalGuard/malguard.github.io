import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
import {getCountries} from 'libphonenumber-js';
await mkdir('assets/flags',{recursive:true});
for(const country of getCountries())await copyFile(`node_modules/country-flag-icons/3x2/${country}.svg`,`assets/flags/${country}.svg`);
for(const [source,target]of [['libphonenumber-js/LICENSE','Phone-number-LICENSE.txt'],['country-flag-icons/LICENSE','Country-flags-LICENSE.txt'],['@noble/hashes/LICENSE','Report-proof-LICENSE.txt']])await copyFile('node_modules/'+source,'assets/flags/'+target);
for(const [source,outfile]of [['assets/phone-country-source.mjs','assets/phone-country.js'],['assets/report-proof-source.mjs','assets/report-proof.worker.js']])await build({entryPoints:[source],outfile,bundle:true,minify:true,format:'iife',target:'es2020',legalComments:'eof'});
