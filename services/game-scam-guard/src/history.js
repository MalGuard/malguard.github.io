const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string';
const optionalText = value => value === undefined || text(value);
const count = value => Number.isInteger(value) && value >= 0;
const list = (value, valid) => Array.isArray(value) && value.every(valid);
const timestamp = value => text(value) && Number.isFinite(Date.parse(value));
const webUrl = value => {
  if (!text(value)) return false;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};
const reputation = value => value === undefined || (isObject(value) && text(value.status) && text(value.message));
const layers=value=>value===undefined||list(value,item=>isObject(item)&&text(item.id)&&text(item.title)&&text(item.detail)&&['inspected','finding','unavailable','not_requested'].includes(item.status));
const verdict=value=>['limited','warning','danger','unavailable'].includes(value);
const targetStatuses=['unscanned','queued','limited','warning','danger','unavailable','blocked','requires_access','requires_payment','budget_exceeded'];
const peEvidence=value=>value===undefined||value===null||(isObject(value)&&text(value.version)&&(value.rulesVersion===null||optionalText(value.rulesVersion))&&typeof value.peValid==='boolean');
const behavior=value=>value===undefined||(isObject(value)&&text(value.status)&&typeof value.executed==='boolean'&&text(value.reason)&&optionalText(value.untrustedOutputExcerpt)
  &&(value.execution===undefined||(isObject(value.execution)&&(value.execution.durationMs===undefined||count(value.execution.durationMs))&&(value.execution.exitCode===undefined||Number.isInteger(value.execution.exitCode))))
  &&(value.createdFiles===undefined||list(value.createdFiles,item=>isObject(item)&&text(item.name)&&count(item.size)&&(item.sha256===null||optionalText(item.sha256)))));
const artifact=(value,depth=0)=>value===undefined||(depth<=2&&isObject(value)&&text(value.engine)&&text(value.version)&&text(value.status)&&text(value.format)&&count(value.size)&&text(value.sha256)&&value.executed===false
  &&(value.layers===undefined||list(value.layers,item=>isObject(item)&&['id','title','status','detail'].every(key=>text(item[key]))))
  &&(value.observedUrls===undefined||list(value.observedUrls,text))
  &&peEvidence(value.peEngine)
  &&list(value.findings,item=>isObject(item)&&['rule','reason','evidence','location'].every(key=>text(item[key])))
  &&(value.archive===undefined||(isObject(value.archive)&&count(value.archive.inspected)&&count(value.archive.listed)&&list(value.archive.entries,item=>isObject(item)&&text(item.name)&&text(item.status)&&count(item.size)&&optionalText(item.sha256)&&(item.permissions===undefined||list(item.permissions,text))&&artifact(item.nested,depth+1)&&peEvidence(item.peEngine)))));
const routing=value=>value===undefined||(isObject(value)&&text(value.code)&&text(value.detail)&&typeof value.fallback==='boolean');
const destination=value=>isObject(value)&&['id','name','kind','status'].every(key=>text(value[key]))&&webUrl(value.url)&&optionalText(value.title)&&optionalText(value.detail)&&artifact(value.artifact)&&behavior(value.behavior)&&routing(value.routing)
  &&reputation(value.reputation)&&reputation(value.fileReputation)&&reputation(value.finalReputation)
  &&(value.finalUrl===undefined||webUrl(value.finalUrl))
  &&(value.findings===undefined||list(value.findings,item=>isObject(item)&&text(item.title)&&text(item.detail)));
const inventory = value => value === undefined || (isObject(value)
  && ['total','retained','omitted'].every(key => count(value[key]))
  && value.retained + value.omitted === value.total && ['discovered-only','checked-targets'].includes(value.status)
  && list(value.links, item => isObject(item) && count(item.position) && text(item.label)
    && targetStatuses.includes(item.status) && ['file','page','unsupported'].includes(item.kind)
    && (item.url === undefined || webUrl(item.url)) && optionalText(item.reason)
    && (item.duplicateOf === undefined || count(item.duplicateOf))) && value.links.length === value.retained);
const siteAnalysis = value => value === undefined || (isObject(value)
  && text(value.engine) && text(value.version) && value.status === 'done' && value.scope === 'received-html'
  && ['rulesChecked','sensitiveForms','externalScripts','inlineScripts','nonExecutableScripts','refreshCount','receivedBytes'].every(key => count(value[key]))
  && value.javaScriptExecuted === false && value.fileContentsRead === false
  && text(value.htmlSha256) && /^[a-f0-9]{64}$/.test(value.htmlSha256));
const file = value => isObject(value)
  && ['id', 'name', 'extension', 'status'].every(key => text(value[key]))
  && webUrl(value.url)
  && ['detail', 'format', 'sha256'].every(key => optionalText(value[key]))
  && (value.size === undefined || count(value.size))
  &&(value.finalUrl===undefined||webUrl(value.finalUrl))
  && reputation(value.reputation) && reputation(value.urlReputation) && reputation(value.finalUrlReputation) && artifact(value.artifact) && behavior(value.behavior) && routing(value.routing);

// Persisted reports may come from an older version or damaged browser storage.
// Validate everything the report view renders before allowing a report to reopen.
function report(value) {
  return isObject(value)
    && ['id', 'domain', 'title', 'description', 'excerpt', 'contentType'].every(key => text(value[key]))
    && webUrl(value.url) && webUrl(value.finalUrl) && timestamp(value.createdAt)
    && ['limited', 'warning', 'danger', 'unavailable'].includes(value.status)
    && typeof value.advanced === 'boolean' && count(value.linkCount) && count(value.fileCount)
    && (value.discoveredFileCount===undefined||count(value.discoveredFileCount))
    && layers(value.inspectionLayers)
    && (value.initialAssessment===undefined||(isObject(value.initialAssessment)&&verdict(value.initialAssessment.status)&&value.initialAssessment.scope==='submitted-page'))
    && (value.linkedAssessment===undefined||(isObject(value.linkedAssessment)&&verdict(value.linkedAssessment.status)&&text(value.linkedAssessment.reason)&&['threats','warnings','incomplete','omitted','excluded'].every(key=>count(value.linkedAssessment[key]))))
    && optionalText(value.scanToken)
    && (value.inputAdjusted === undefined || typeof value.inputAdjusted === 'boolean')
    && (value.pageFetch === undefined || (isObject(value.pageFetch) && ['done','unavailable'].includes(value.pageFetch.status) && optionalText(value.pageFetch.detail) && optionalText(value.pageFetch.reason) && count(value.pageFetch.attempts)))
    && list(value.headings, text) && list(value.limitations, text) && list(value.files, file)
    && list(value.checks, item => isObject(item) && ['title', 'status', 'detail'].every(key => text(item[key])))
    && list(value.signals, item => isObject(item) && ['level', 'title', 'detail'].every(key => text(item[key])))
    && list(value.redirects, item => isObject(item) && webUrl(item.from) && webUrl(item.to) && count(item.status))
    && reputation(value.reputation) && reputation(value.finalReputation)
    && inventory(value.linkInventory) && siteAnalysis(value.siteAnalysis)
    && (value.destinationResults===undefined||list(value.destinationResults,destination))
    && (value.destinationResults===undefined||value.jobSummary!==undefined)
    && (value.jobSummary===undefined||(isObject(value.jobSummary)&&['total','completed','omitted','bytesRead'].every(key=>count(value.jobSummary[key]))&&typeof value.jobSummary.done==='boolean'))
    && (value.preview === undefined || (isObject(value.preview) && text(value.preview.status) && text(value.preview.detail) && optionalText(value.preview.image)));
}

export function readHistory(raw) {
  try {
    const saved = JSON.parse(raw || '[]');
    if(!Array.isArray(saved))return [];
    const valid=[];let bytes=0;
    for(const item of saved.filter(report)){const size=JSON.stringify(item).length*2;if(valid.length===30||bytes+size>3*1024*1024)break;valid.push(item);bytes+=size;}
    return valid;
  } catch { return []; }
}
