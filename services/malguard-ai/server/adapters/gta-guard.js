import {analyzeArtifact} from '../../../game-scam-guard/server/artifact-analysis.js';
import {report, text} from '../contracts.js';
export function createGtaGuard(inspect = analyzeArtifact) {
  return {
    status: () => ({state:'available', scope:'static_file_analysis', maxFileBytes:1048576, liveVerified:false}),
    async run(input) {
      if (!input.file) return report('gta_guard','insufficient',{reason:'file_required', metadata:input.sha256 ? {sha256:input.sha256} : {}, limitations:['A hash alone does not provide file contents. Choose MalwareBazaar for a reputation lookup.']});
      const r = await inspect(input.file.bytes, input.file.name, {timeout:10000});
      const evidence = (r.findings || []).slice(0,32).map(f => ({rule:text(f.rule,80), detail:text(f.reason), observation:text(f.evidence), location:text(f.location,180)}));
      return report('gta_guard', evidence.length ? 'suspicious' : r.status === 'complete' ? 'no_evidence' : 'insufficient', {
        evidence, sources:[{name:'MalGuard static artifact engine',url:'https://github.com/MalGuard/malguard.github.io/tree/main/services/game-scam-guard/server',status:r.status === 'complete'?'completed':'partial'}],
        metadata:{sha256:r.sha256,size:r.size,format:text(r.format,80),engineVersion:r.version,executed:false},
        limitations:[...r.details.map(x=>text(x)), 'Static inspection only. Worker limits protect parsing resources; they are not malware-execution isolation certification. Files remain in memory and are not sent to reputation services.']
      });
    }
  };
}
