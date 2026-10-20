import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parsePage} from '../services/game-scam-guard/server/scanner.js';
import {detectionFixtures,benignFixtures} from '../services/game-scam-guard/server/analysis-fixtures.js';
import {ANALYSIS_VERSION} from '../services/game-scam-guard/shared/analyzer-catalog.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
const inputs=['server/scanner.js','server/site-analysis.js','server/deep-analysis.js','server/script-facts.js','server/analysis-fixtures.js','shared/analyzer-catalog.js'];
const sourceFiles={};for(const file of inputs)sourceFiles[file]=hash(await readFile(new URL(`../services/game-scam-guard/${file}`,import.meta.url)));
const cases=[];
for(const [group,fixtures]of [['expected-observation',detectionFixtures],['benign-control',benignFixtures]]){
 for(const [index,fixture]of fixtures.entries()){
  const start=performance.now(),report=parsePage(Buffer.from(fixture.html),fixture.url),elapsedMs=performance.now()-start;
  const rules=report.signals.map(item=>item.rule).filter(Boolean),warnings=report.signals.filter(item=>['warning','danger'].includes(item.level));
  const passed=group==='expected-observation'?rules.includes(fixture.rule):warnings.length===0;
  cases.push({id:`${group}-${index+1}`,group,module:fixture.module||null,name:fixture.name||fixture.module,inputSha256:hash(fixture.html),url:fixture.url,expectedRule:fixture.rule||null,observedRules:rules,warningCount:warnings.length,passed,elapsedMs:Number(elapsedMs.toFixed(3))});
 }
}
const timings=cases.map(item=>item.elapsedMs).sort((a,b)=>a-b),observations=cases.filter(item=>item.group==='expected-observation'),controls=cases.filter(item=>item.group==='benign-control');
const result={schema:1,generatedAt:new Date().toISOString(),engineVersion:ANALYSIS_VERSION,dataset:'authored-synthetic-regression-v1',independentEvaluation:false,randomSample:false,realMalwareExecuted:false,sourceFiles,summary:{cases:cases.length,passed:cases.filter(item=>item.passed).length,failed:cases.filter(item=>!item.passed).length,expectedObservations:observations.length,observationsMatched:observations.filter(item=>item.passed).length,benignControls:controls.length,benignControlsWithoutWarnings:controls.filter(item=>item.passed).length,medianParseMs:timings[Math.floor(timings.length/2)],p95ParseMs:timings[Math.ceil(timings.length*.95)-1]},limitations:['Fixtures are selected by the developers and overlap the regression suite.','This is not a held-out, independently labeled or representative threat dataset.','These counts must not be advertised as real-world detection accuracy, a zero-day detection rate or a safety guarantee.','No reputation provider, remote VM or physical Samsung device is evaluated here.','Parser latency excludes network fetches, provider calls, browser rendering and user-device overhead.'],cases};
await writeFile(new URL('../docs/gamescam-evaluation.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result.summary));assert.equal(result.summary.failed,0);
