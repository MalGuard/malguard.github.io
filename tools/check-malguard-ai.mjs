import {readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
async function files(dir){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?files(`${dir}/${e.name}`):`${dir}/${e.name}`))).flat();}
const paths=[...await files('services/malguard-ai'),...await files('ai'),'api/malguard-ai.js','tests/malguard-ai-browser.mjs'];
for(const file of paths.filter(x=>/\.(m?js)$/.test(x))){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);const s=await readFile(file,'utf8');assert.ok(!/\b(?:eval|new Function)\s*\(/.test(s),file);if(file.startsWith('ai/'))assert.ok(!/process\.env|localStorage|innerHTML|outerHTML|insertAdjacentHTML/.test(s),file);}
const config=JSON.parse(await readFile('vercel.json','utf8'));assert.equal(config.git.deploymentEnabled['feature/malguard-ai-evidence-first'],false);
console.log(`PASS AI syntax and static safety checks (${paths.length} files). JavaScript project: TypeScript typecheck is not configured.`);
