/** Evidence-first adapter for the existing MalGuard guarded URL inspector. */
const SECRET_QUERY_KEYS = /^(?:token|access_token|id_token|api_key|apikey|key|secret|password|passwd|auth|authorization|session|sessionid|code|signature|sig)$/i;
export function validatePublicUrl(input) {
  if (typeof input !== 'string' || input.length > 2048 || !input.trim()) throw new Error('Provide one public website URL (max 2048 characters).');
  let url;
  try { url = new URL(/^[a-z][\w+.-]*:/i.test(input.trim()) ? input.trim() : `https://${input.trim()}`); }
  catch { throw new Error('The URL is invalid.'); }
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS website URLs are accepted.');
  if (url.username || url.password) throw new Error('URLs containing credentials are not accepted.');
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('Only standard website ports are accepted.');
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host.includes('.') || host === 'localhost' || /\.(?:localhost|local|internal|test|invalid)$/.test(host)) throw new Error('Only publicly accessible hostnames are accepted.');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) throw new Error('IP address URLs are not accepted in this preview.');
  for (const key of url.searchParams.keys()) if (SECRET_QUERY_KEYS.test(key)) throw new Error('Do not submit private or token-bearing URLs.');
  url.hash = '';
  return url.href;
}
const clean = (value, limit = 240) => String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, limit);
export function summarizeScan(report, submittedUrl) {
  if (!report || typeof report !== 'object') throw new Error('The scanner returned an invalid response.');
  const raw = report.status;
  const status = raw === 'danger' ? 'suspicious_evidence' : raw === 'warning' ? 'warning_signs' : raw === 'limited' ? 'limited_no_threat_evidence' : 'inconclusive';
  const signals = (Array.isArray(report.signals) ? report.signals : []).filter(s => s && ['danger','warning'].includes(s.level)).slice(0, 12);
  const evidence = signals.map(s => ({severity: clean(s.level, 20), finding:clean(s.title, 120), detail:clean(s.detail, 240)}));
  const limitations = (Array.isArray(report.limitations) ? report.limitations : []).slice(0, 6).map(s=>clean(s,240));
  if (!limitations.some(s=>s.includes('not guarantee'))) limitations.push('No scan can guarantee that a URL is safe. The absence of reported threats is not proof of safety.');
  return {
    status, checked_url: submittedUrl,
    final_url: typeof report.finalUrl === 'string' ? clean(report.finalUrl, 2048) : submittedUrl,
    page_fetched: report.pageFetch?.status === 'done',
    evidence, limitations,
    reputation_checked: false,
    files_scanned: false,
    message: status === 'suspicious_evidence' ? 'Suspicious indicators were observed.' : status === 'warning_signs' ? 'Potential warning signs were observed.' : status === 'inconclusive' ? 'Inspection was incomplete; no safety determination is possible.' : 'No confirmed threat evidence was observed within the limited checks.'
  };
}
export async function performScan(input, scanner) {
  const url = validatePublicUrl(input);
  const report = await scanner(url, {
    retainReport: false, allowThreatContent: false, allowCloudPreview: false,
    lookup: async () => ({status: 'unconfigured', sources: [], message: 'Third-party reputation not queried in ChatGPT preview.'})
  });
  return summarizeScan(report, url);
}
