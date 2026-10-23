import {lookupUrl, urlhausAuthKey} from '../../../game-scam-guard/server/threat-intel.js';
import {fetchPublic} from '../../../game-scam-guard/server/network.js';
import {report, text} from '../contracts.js';
export function createUrlhaus({lookup=lookupUrl, transport=fetchPublic,key=urlhausAuthKey} = {}) {
  return {
    status: () => ({state:key()?'configured':'disabled',reason:key()?'live_not_verified':'missing_credential',liveVerified:false,scope:'url_metadata_only'}),
    async run(input,{signal}) {
      if (!input.url) return report('urlhaus','insufficient',{reason:'url_required'});
      if (!key()) return report('urlhaus','insufficient',{reason:'missing_credential'});
      const r = await lookup(input.url,{authKeyProvider:key,transport:(url,options)=>transport(url,{...options,signal})});
      const outcome = r.status === 'listed'?'suspicious':r.status === 'not_found'?'no_evidence':'error';
      return report('urlhaus',outcome,{sources:[{name:'URLhaus',url:'https://urlhaus.abuse.ch/api/',status:outcome==='error'?'error':'completed'}],evidence:r.status==='listed'?[{rule:'reported_url',detail:'URLhaus reported this exact URL.',observation:text(r.signature,200)}]:[],reason:outcome==='error'?'provider_unavailable':undefined,limitations:['URL reputation only. The submitted destination is not fetched by this adapter. No payload or malware sample is downloaded.']});
    }
  };
}
