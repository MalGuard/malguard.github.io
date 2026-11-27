const panel = document.getElementById('private-preview');
const form = document.getElementById('privateDownloadForm');
const input = document.getElementById('privateDownloadCode');
const button = document.getElementById('privateDownloadButton');
const status = document.getElementById('privateDownloadStatus');
const progress = document.getElementById('privateDownloadProgress');
let release = null;

function message(text, error = false) {
  status.textContent = text;
  status.dataset.error = String(error);
}

async function loadRelease() {
  try {
    const response = await fetch('/release/malguard-cleanroom-preview.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('metadata');
    const data = await response.json();
    if (data.schemaVersion !== '1.0.0' || data.platform !== 'windows-x64' ||
        !Number.isSafeInteger(data.size) || data.size < 1 || data.size > 40 * 1024 * 1024 ||
        !/^[a-f0-9]{64}$/.test(data.sha256) || data.filename !== 'MalGuard-Setup-x64.exe' ||
        data.partBytes !== 3 * 1024 * 1024 || data.partCount !== Math.ceil(data.size / data.partBytes)) {
      throw new Error('metadata');
    }
    for (const [id, value] of [['privateBuild',data.build],['privateVersion',data.version],['privateSha',data.sha256]]) {
      document.getElementById(id).textContent = value;
    }
    document.getElementById('privateSize').textContent = new Intl.NumberFormat('fa-IR').format(data.size) + ' بایت';
    if (data.status !== 'private-download-ready' || !data.serviceUrl) {
      message('دانلود خصوصی در حال آماده‌سازی است.');
      return;
    }
    const url = new URL(data.serviceUrl);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app') ||
        url.pathname !== '/api/download' || url.search || url.hash || url.username || url.password) throw new Error('endpoint');
    release = data;
    button.disabled = false;
    message('برای دریافت فایل نصب، کد خصوصی دانلود را وارد کنید.');
  } catch {
    message('مشخصات دانلود قابل تأیید نیست. کمی بعد دوباره صفحه را باز کنید.', true);
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!release || button.disabled) return;
  let code = input.value.trim();
  if (!/^MG[A-Z2-7]{32}$/.test(code.replace(/[ -]/g,'').toUpperCase()) || code.length > 96) {
    message('کد خصوصی دانلود را کامل وارد کنید؛ شمارهٔ بیلد، کد دانلود نیست.', true);
    input.focus();
    return;
  }
  button.disabled = true;
  progress.hidden = false;
  progress.max = release.size;
  progress.value = 0;
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 180_000);
  let objectUrl = null;
  try {
    const parts = [];
    let received = 0;
    for (let part = 0; part < release.partCount; part++) {
      message('در حال دریافت فایل: بخش ' + new Intl.NumberFormat('fa-IR').format(part + 1) + ' از ' + new Intl.NumberFormat('fa-IR').format(release.partCount));
      const response = await fetch(release.serviceUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, part }), credentials: 'omit', cache: 'no-store',
        referrerPolicy: 'no-referrer', signal: controller.signal
      });
      if (response.status === 403) throw new Error('denied');
      if (response.status === 429) throw new Error('limited');
      if (!response.ok) throw new Error('unavailable');
      const expected = Math.min(release.partBytes, release.size - received);
      if (response.headers.get('x-part-index') !== String(part) ||
          response.headers.get('x-file-size') !== String(release.size) ||
          response.headers.get('x-file-sha256') !== release.sha256) throw new Error('integrity');
      // Content-Length describes transport bytes and may be absent or compressed.
      // Validate the bounded decoded stream below and the complete SHA-256 instead.
      const bytes = new Uint8Array(expected);
      const reader = response.body.getReader();
      let position = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (position + value.length > expected) throw new Error('integrity');
          bytes.set(value, position);
          position += value.length;
          progress.value = received + position;
        }
      } finally { reader.releaseLock(); }
      if (position !== expected) throw new Error('integrity');
      parts.push(bytes);
      received += position;
    }
    message('در حال بررسی سالم بودن فایل…');
    const combined = new Uint8Array(release.size);
    let offset = 0;
    for (const bytes of parts) { combined.set(bytes, offset); offset += bytes.length; }
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', combined)), byte => byte.toString(16).padStart(2,'0')).join('');
    if (hash !== release.sha256) throw new Error('integrity');
    objectUrl = URL.createObjectURL(new Blob([combined], { type: 'application/octet-stream' }));
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = release.filename;
    link.hidden = true;
    panel.appendChild(link);
    link.click();
    link.remove();
    const completedUrl = objectUrl;
    setTimeout(() => URL.revokeObjectURL(completedUrl), 60_000);
    objectUrl = null;
    input.value = '';
    message('فایل تأیید شد و دانلود آغاز شد. پس از نصب، نتیجهٔ تست ویندوز را بفرستید.');
  } catch (error) {
    controller.abort();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    const errors = {
      denied: 'کد دانلود نادرست یا لغوشده است.',
      limited: 'تعداد تلاش‌ها زیاد است. یک دقیقه صبر کنید و دوباره امتحان کنید.',
      integrity: 'سالم بودن فایل تأیید نشد؛ دانلود متوقف شد.',
      unavailable: 'سرویس دانلود در دسترس نیست. کمی بعد دوباره امتحان کنید.'
    };
    message(errors[error.message] || 'دریافت فایل کامل نشد. اتصال اینترنت را بررسی و دوباره تلاش کنید.', true);
  } finally {
    code = '';
    clearTimeout(deadline);
    button.disabled = false;
    progress.hidden = true;
  }
});

loadRelease();
