import {performance} from 'node:perf_hooks';
import {parsePage} from './scanner.js';
import {publicAddress,normalizeUrl} from './network.js';
import {createReportTokens} from './report-token.js';
import {analyzerCatalog,ANALYSIS_VERSION} from '../shared/analyzer-catalog.js';
import {detectionFixtures,benignFixtures} from './analysis-fixtures.js';

export function runSelfTest(){
 const started=performance.now(),checks=[];
 for(const fixture of detectionFixtures){
  let passed=false;try{const report=parsePage(Buffer.from(fixture.html),fixture.url);passed=report.analysisEngine.modules.length===analyzerCatalog.length&&report.signals.some(signal=>signal.rule===fixture.rule);}catch{}
  checks.push({id:fixture.module,module:fixture.module,status:passed?'passed':'failed',kind:'detection'});
 }
 for(const fixture of benignFixtures){
  let passed=false;try{const report=parsePage(Buffer.from(fixture.html),fixture.url);passed=!report.signals.some(signal=>['danger','warning'].includes(signal.level));}catch{}
  checks.push({id:fixture.name,status:passed?'passed':'failed',kind:'false-positive'});
 }
 checks.push({id:'private-network-boundary',kind:'boundary',status:['127.0.0.1','169.254.169.254','10.0.0.1','::1','::ffff:127.0.0.1'].every(ip=>!publicAddress(ip))?'passed':'failed'});
 let credentialsBlocked=false;try{normalizeUrl('https://user:password@example.com/');}catch{credentialsBlocked=true;}
 checks.push({id:'credential-url-boundary',kind:'boundary',status:credentialsBlocked?'passed':'failed'});
 const codec=createReportTokens({secret:'self-test-fixture-only-not-a-production-secret'}),token=codec.issue({id:'fixture',files:[]});let tamperBlocked=false;
 const bytes=Buffer.from(token.slice(3),'base64url');bytes[28]^=1;try{codec.read('r1.'+bytes.toString('base64url'),'fixture');}catch{tamperBlocked=true;}
 checks.push({id:'report-token-integrity',kind:'boundary',status:tamperBlocked?'passed':'failed'});
 const report=parsePage(Buffer.from('<form method="post" action="https://other.example/?token=do-not-copy"><input type="password" value="do-not-copy"></form>'),'https://store.example/');
 checks.push({id:'secret-value-redaction',kind:'boundary',status:JSON.stringify(report).includes('do-not-copy')?'failed':'passed'});
 const passed=checks.filter(check=>check.status==='passed').length;
 return {version:ANALYSIS_VERSION,scope:'synthetic-offline',status:passed===checks.length?'passed':'failed',checkedAt:new Date().toISOString(),durationMs:Math.round(performance.now()-started),summary:{total:checks.length,passed,failed:checks.length-passed},checks};
}
let cached;
export function cachedSelfTest(){
 if(!cached||Date.now()-cached.at>60000)cached={at:Date.now(),result:runSelfTest()};
 return cached.result;
}
