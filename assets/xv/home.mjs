const form = document.getElementById('xv-analysis-form');
const field = document.getElementById('xv-input');
const fileField = document.getElementById('xv-file');
const attach = document.getElementById('xv-attach');
const result = document.getElementById('xv-result');
const message = document.getElementById('xv-result-message');
const next = document.getElementById('xv-result-link');
const announcement = document.getElementById('xv-announcement');
const maxFileBytes = 32 * 1024 * 1024;
let revision = 0;

function showResult(text, link) {
  result.hidden = false;
  message.textContent = text;
  announcement.textContent = link ? `${text} ${link[0]}.` : text;
  next.hidden = !link;
  if (link) {
    [next.textContent, next.href] = link;
  } else {
    next.removeAttribute('href');
  }
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function inspectText(value) {
  if (!value) {
    return showResult('Enter a URL, IP address, hash, or incident, or choose a file.', ['Browse analysis tools', '/tools.html']);
  }

  const hashes = { 32: 'MD5', 40: 'SHA-1', 64: 'SHA-256', 96: 'SHA-384', 128: 'SHA-512' };
  if (hashes[value.length] && /^[\da-f]+$/i.test(value)) {
    return showResult(`This matches the format of a ${hashes[value.length]} digest. Compare it with a trusted reference to verify integrity.`,
      ['Open File Fingerprint', '/tools.html#file-fingerprint']);
  }

  if (/^https?:\/\//i.test(value)) {
    const url = parseUrl(value);
    if (!url?.hostname) {
      return showResult('This URL could not be parsed. Enter a complete HTTP or HTTPS address.');
    }
    return showResult(`Parsed hostname: ${url.hostname}. The destination was not opened or checked for reputation.`,
      ['Open URL text inspector', '/scan-url.html']);
  }

  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(value)
    && value.split('.').every(part => String(Number(part)) === part && Number(part) <= 255);
  const ipv6 = /^[0-9a-f:.]+$/i.test(value) && value.includes(':') && parseUrl(`http://[${value}]/`);
  if (ipv4 || ipv6) {
    return showResult(`This matches an IPv${ipv4 ? 4 : 6} address. No network or reputation check was performed.`,
      ['Explore Threat Radar', '/threat-radar.html']);
  }

  return showResult('For incident guidance, open MalGuard AI and share only the details you choose. This text stays on this page.',
    ['Open MalGuard AI', '/ai/']);
}

attach.addEventListener('click', () => fileField.click());
fileField.addEventListener('change', () => {
  if (!fileField.files.length) return;
  field.value = '';
  form.requestSubmit();
});
field.addEventListener('input', () => {
  revision += 1;
  fileField.value = '';
  result.hidden = true;
  announcement.textContent = '';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const current = ++revision;
  const file = fileField.files[0];
  if (!file) {
    inspectText(field.value.trim());
    return;
  }
  if (file.size > maxFileBytes) {
    showResult('This homepage tool can fingerprint files up to 32 MiB.', ['Open File Fingerprint', '/tools.html#file-fingerprint']);
    return;
  }
  showResult('Calculating the file fingerprint in your browser…');
  try {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    if (revision !== current) return;
    const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    showResult(`SHA-256 · ${file.name}\n${fingerprint}\nThe file stayed in this browser. A fingerprint alone does not determine safety.`,
      ['Open File Fingerprint', '/tools.html#file-fingerprint']);
  } catch {
    if (revision === current) showResult('The browser could not fingerprint this file.', ['Open File Fingerprint', '/tools.html#file-fingerprint']);
  }
});

const narrow = matchMedia('(max-width: 600px)');
function updatePlaceholder() {
  field.placeholder = narrow.matches ? 'File, URL, IP, hash…' : 'Analyze a file, URL, IP, hash, or incident…';
}
narrow.addEventListener('change', updatePlaceholder);
updatePlaceholder();

const productMenu = document.querySelector('.xv-product-menu');
document.addEventListener('click', event => {
  if (productMenu.open && !productMenu.contains(event.target)) productMenu.open = false;
});
productMenu.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !productMenu.open) return;
  productMenu.open = false;
  productMenu.querySelector('summary').focus();
  event.preventDefault();
});

const overview = document.querySelector('.xv-overview');
const observer = new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) return;
  overview.dataset.xvInView = '';
  observer.disconnect();
}, { threshold: .18 });
observer.observe(overview);

const reportLauncher = document.getElementById('mg-report-launcher');
if (reportLauncher) document.querySelector('.xv-utilities').append(reportLauncher);
