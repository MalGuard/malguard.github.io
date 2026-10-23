import {scanSite} from '../../../game-scam-guard/server/scanner.js';
import {lookupReputation,lookupUrl} from '../../../game-scam-guard/server/threat-intel.js';
import {fetchPublic} from '../../../game-scam-guard/server/network.js';
import {report,text} from '../contracts.js';
export function createGameScamGuard(scan = scanSite) {
  return {
    status: () => ({state:'available',scope:'guarded_public_html',liveVerified:false}),
    async run(input,{signal,consent}) {
      if (!input.url) return report('game_scam_guard','insufficient',{reason:'url_required'});
      const guardedTransport=(url,options={})=>fetchPublic(url,{...options,signal:options.signal?AbortSignal.any([signal,options.signal]):signal});
      const r = await scan(input.url, {
        transport:guardedTransport,allowThreatContent:false,allowCloudPreview:false,retainReport:false,
        lookup:consent.remoteLookup ? value=>lookupReputation(value,{urlhaus:v=>lookupUrl(v,{transport:guardedTransport})}) : async()=>({status:'unconfigured',sources:[],message:'Threat providers were not contacted: consent not given.'})
      });
      // A network-failure warning is a coverage gap, not suspicious evidence.
      const findings = (r.signals || []).filter(s=>s.level==='danger'||r.pageFetch?.status==='done'&&s.level==='warning');
      const sources = [{name:'Game Scam Guard HTML analysis',url:'https://github.com/MalGuard/malguard.github.io/tree/main/services/game-scam-guard/server',status:r.pageFetch?.status === 'done'?'completed':'error'}];
      const reputations = r.urlReputations?.map(item=>item.reputation) || [r.reputation];
      for (const reputation of reputations) for (const s of reputation?.sources || []) sources.push({name:s.provider==='urlhaus'?'URLhaus':'OpenPhish',url:s.provider==='urlhaus'?'https://urlhaus.abuse.ch/api/':'https://github.com/openphish/public_feed',status:s.status,checkedAt:s.checkedAt});
      const incomplete = r.status === 'unavailable';
      return report('game_scam_guard',findings.length?'suspicious':r.pageFetch?.status!=='done'?'error':incomplete?'insufficient':'no_evidence',{
        evidence:findings.slice(0,24).map(s=>({rule:text(s.rule || s.level,80),detail:text(s.detail),observation:text(s.title,160)})),sources,
        metadata:{pageReceived:r.pageFetch?.status === 'done',fileAnalysis:false},
        limitations:[...(r.limitations || []).map(x=>text(x)), 'Only public HTML and observed redirects are inspected. JavaScript, login, purchases, previews and downloads are not executed.',...(!consent.remoteLookup?['Threat databases were not queried because consent was not given.']:[])]
      });
    }
  };
}
