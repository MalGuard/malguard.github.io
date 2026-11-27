import { fetchCFModels } from '../cloudflare-models.mjs';

const el = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const view = params.get('view');
const reportView = view === 'report';
const maxFileBytes = 32 * 1024 * 1024;
const storageKey = 'malguard.xv.reports.v1';
const demo = Object.freeze({ name: 'example.zip', size: null, type: 'ZIP Archive', hash: null, demo: true });

function safeReport(entry) {
  return entry && typeof entry.name === 'string' && entry.name.length <= 255 &&
    typeof entry.type === 'string' && entry.type.length <= 128 &&
    /^[a-f\d]{64}$/.test(entry.hash) && Number.isSafeInteger(entry.size) && entry.size >= 0;
}

let recent = [];
try {
  const saved = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
  if (Array.isArray(saved)) recent = saved.slice(0, 8).filter(safeReport);
} catch { /* An unavailable client store leaves the workspace usable. */ }

function showReport(report) {
  el('xvc-dashboard').hidden = true;
  el('xvc-report').hidden = false;
  el('xvc-report-kind').hidden = !report;
  el('xvc-report-kind').textContent = report?.demo ? 'DEMO REPORT' : 'LOCAL REPORT';
  el('xvc-report-name').textContent = report?.name || 'No report selected';
  el('xvc-report-type').textContent = report?.demo ? 'ZIP Archive · Analysis UI demo' : report ? report.type : 'Choose a file to calculate a fingerprint.';
  el('xvc-verdict').hidden = !report;
  el('xvc-file-metadata').textContent = Number.isSafeInteger(report?.size) ? `${report.size.toLocaleString('en-US')} bytes` : 'Not provided';
  el('xvc-sha').textContent = report?.hash || 'Not provided';
  el('xvc-evidence-limit').textContent = report?.demo ? 'No verified verdict in this demo. This report illustrates the interface.' : 'No verified verdict. Local fingerprinting does not determine whether a file is safe.';
  el('xvc-download').disabled = !report;
  el('xvc-download').onclick = () => {
    if (!report) return;
    const data = { ...report, scope: report.demo ? 'Interface demonstration only' : 'Local SHA-256 and file metadata only', verdict: 'Inconclusive', staticAnalysis: 'Not run', behaviorAnalysis: 'Not run' };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = report.demo ? 'malguard-demo-report.json' : 'malguard-local-report.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };
}

function renderRecent() {
  el('xvc-recent-empty').hidden = recent.length > 0;
  for (const [index, item] of recent.entries()) {
    const row = document.createElement('li');
    const link = document.createElement('a');
    link.href = `?view=report&item=${index}`;
    link.textContent = item.name;
    const state = document.createElement('small');
    state.textContent = 'Fingerprint only';
    row.append(link, state);
    el('xvc-recent').append(row);
  }
}

async function inspect(file) {
  const status = el('xvc-upload-status');
  const choose = el('xvc-choose');
  if (choose.disabled) return;
  if (!file || file.size > maxFileBytes || !globalThis.crypto?.subtle) {
    status.textContent = !globalThis.crypto?.subtle ? 'Local fingerprinting requires a secure browser context.' : 'Choose one file up to 32 MiB.';
    return;
  }
  choose.disabled = true;
  status.textContent = 'Calculating SHA-256 in this browser…';
  try {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    const hash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
    const report = { name: file.name.slice(0, 255), size: file.size, type: (file.type || 'Unknown file type').slice(0, 128), hash };
    recent = [report, ...recent.filter(item => item.hash !== hash || item.name !== report.name)].slice(0, 8);
    try { sessionStorage.setItem(storageKey, JSON.stringify(recent)); } catch { /* Keep result in memory. */ }
    history.replaceState(null, '', '?view=report');
    showReport(report);
    el('xvc-report-title').tabIndex = -1;
    el('xvc-report-title').focus();
    document.querySelector('[data-page=dashboard]').removeAttribute('aria-current');
    document.querySelector('[data-page=report]').setAttribute('aria-current', 'page');
    status.textContent = '';
  } catch {
    status.textContent = 'Fingerprinting failed. Try again with a readable file.';
  } finally {
    choose.disabled = false;
    el('xvc-file').value = '';
  }
}

el('xvc-local-status').textContent = globalThis.crypto?.subtle ? 'Available locally' : 'Unavailable';
el('xvc-choose').addEventListener('click', () => el('xvc-file').click());
el('xvc-file').addEventListener('change', event => inspect(event.currentTarget.files[0]));
const drop = el('xvc-upload');
drop.addEventListener('dragover', event => {
  if (!event.dataTransfer.types.includes('Files')) return;
  event.preventDefault();
  drop.classList.add('xvc-drag');
});
drop.addEventListener('dragleave', () => drop.classList.remove('xvc-drag'));
drop.addEventListener('drop', event => {
  event.preventDefault();
  drop.classList.remove('xvc-drag');
  inspect(event.dataTransfer.files[0]);
});
el('xvc-search').addEventListener('submit', event => {
  event.preventDefault();
  const query = el('xvc-query').value.trim().toLowerCase();
  if (query) location.assign(/^https?:\/\/|\b(url|link)\b/.test(query) ? '/scan-url.html' : /\b(ai|assistant|model)\b/.test(query) ? '../?view=xv' : '/tools.html');
});
el('xvc-check-models').addEventListener('click', async event => {
  const button = event.currentTarget;
  const status = el('xvc-catalog-status');
  const list = el('xvc-catalog');
  button.disabled = true;
  status.textContent = 'Checking the model catalog…';
  list.replaceChildren();
  try {
    const models = (await fetchCFModels({ signal: AbortSignal.timeout(8000) })).filter(item => item.available);
    status.textContent = models.length ? 'Available from the model catalog' : 'No available models reported.';
    for (const model of models.slice(0, 6)) {
      const row = document.createElement('li');
      row.textContent = model.label;
      list.append(row);
    }
  } catch {
    status.textContent = 'The model catalog is temporarily unavailable.';
  } finally {
    button.disabled = false;
  }
});

document.querySelector(`[data-page="${reportView ? 'report' : 'dashboard'}"]`).setAttribute('aria-current', 'page');
if (reportView) {
  const item = params.get('item');
  showReport(params.get('demo') === '1' ? demo : recent[item !== null && /^[0-7]$/.test(item) ? Number(item) : 0]);
} else {
  renderRecent();
}
