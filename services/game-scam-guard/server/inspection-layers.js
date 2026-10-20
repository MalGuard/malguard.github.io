// These are evidence categories, not fifteen independent antivirus engines.
// "Inspected" describes coverage and never certifies a website as harmless.
export function inspectionLayers(report) {
  const html=report.siteAnalysis;
  const received=report.pageFetch?.status==='done'&&!!html;
  const signals=report.signals||[];
  const rows=[];
  const row=(id,title,status,detail)=>rows.push({id,title,status,detail});
  const local=(id,title,rules,detail)=>row(id,title,!received?'unavailable':signals.some(signal=>rules.includes(signal.rule))?'finding':'inspected',received?detail:'HTML was not received; this check was not completed.');
  row('address','Address validation','inspected','HTTP/HTTPS URL syntax, credentials and allowed web ports were checked.');
  row('network','Public network boundary',received?'inspected':'unavailable',received?'Resolved addresses and redirect connections passed public-IP validation.':'A complete public-page connection was not established.');
  row('transport','Connection encryption',received?'inspected':'unavailable',received?(report.finalUrl.startsWith('https:')?'HTTPS certificate validation remained enabled.':'The final page uses unencrypted HTTP.'):report.pageFetch?.detail||'Connection evidence is unavailable.');
  row('redirects','HTTP redirect chain',received?'inspected':'unavailable',received?`${report.redirects?.length||0} HTTP redirects recorded.`:'A complete redirect chain was not observed.');
  const providers=[report.reputation,report.finalReputation].filter(Boolean);
  row('reputation','URLhaus threat intelligence',providers.some(item=>item.status==='listed')?'finding':providers.length&&providers.every(item=>['not_found','listed'].includes(item.status))?'inspected':'unavailable',providers.map(item=>item.message).join(' ')||'The threat database was not queried.');
  row('identity','Received HTML evidence',received?'inspected':'unavailable',received?`${html.receivedBytes} bytes received; SHA-256 ${html.htmlSha256}.`:'No HTML body was available to hash or inspect.');
  local('form-destinations','Sensitive form destinations',['sensitive_form_unreadable','sensitive_form_http','sensitive_form_external'],`${html?.sensitiveForms||0} sensitive forms inspected; no values collected or submitted.`);
  local('form-methods','Sensitive form methods',['sensitive_form_get'],'Observed sensitive form methods were checked for data exposure through GET.');
  local('mixed-scripts','Script transport',['active_mixed_content'],`${html?.externalScripts||0} external script references inspected without executing them.`);
  local('encoded-code','Encoded dynamic script patterns',['encoded_dynamic_code'],`${html?.inlineScripts||0} inline scripts inspected for combined decoding and dynamic execution patterns.`);
  local('html-redirects','HTML redirect destinations',['html_external_redirect'],`${html?.refreshCount||0} meta-refresh destinations inspected without following them.`);
  row('links','Public link inventory',!received?'unavailable':signals.some(item=>item.rule==='link_destination_mismatch')?'finding':'inspected',received?`${report.linkInventory?.retained||0} link rows retained; ${report.linkInventory?.omitted||0} omitted by limits; ${html?.deceptiveLinks||0} displayed URL mismatches. Downloads are excluded.`:'No link inventory was available.');
  row('headers','Response security headers',report.responseHeaders?'inspected':'unavailable',report.responseHeaders?`CSP: ${report.responseHeaders.csp?'present':'absent'}; HSTS: ${report.responseHeaders.hsts?'present':'absent'}; MIME sniffing protection: ${report.responseHeaders.noSniff?'present':'absent'}. Presence alone is not a safety verdict.`:'Security-header evidence was not retained.');
  row('browser','Isolated browser snapshot',report.preview?.status==='done'?'inspected':report.preview?.status==='skipped'?'not_requested':'unavailable',report.preview?.detail||'No browser snapshot was requested.');
  row('linked-pages','Linked public page inspection',report.jobSummary?(report.jobSummary.done&&!report.jobSummary.omitted&&!report.linkedAssessment?.incomplete?'inspected':'unavailable'):'not_requested',report.jobSummary?`${report.jobSummary.completed} of ${report.jobSummary.total} queued pages inspected. ${report.linkedAssessment?.reason||''}`:'Linked pages are inspected after your confirmation.');
  return rows;
}
