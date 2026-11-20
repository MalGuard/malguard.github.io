const form = document.querySelector('#android-version-form');
const input = document.querySelector('#android-version-code');
const result = document.querySelector('#android-version-result');

const older = new Map([
  ['GSG-ANDROID-1.1.0-FA09663', '1.1.0'],
]);

async function checkVersion(event) {
  event.preventDefault();
  const code = input.value.trim().toUpperCase();
  result.textContent = 'Checking version… / در حال بررسی نسخه…';
  try {
    const response = await fetch('/release/gamescam-guard-android.json', {cache: 'no-store'});
    if (!response.ok) throw new Error('Release metadata unavailable');
    const release = await response.json();
    if (release.platform !== 'android' || !release.releaseCode || !release.version) {
      throw new Error('Unexpected release metadata');
    }
    if (code === release.releaseCode) {
      result.textContent = `Up to date (${release.version}) / نسخهٔ نصب‌شده به‌روز است.`;
    } else if (older.has(code)) {
      result.textContent = `Update available (${older.get(code)} → ${release.version}) / نسخهٔ جدید آمادهٔ دانلود است.`;
    } else {
      result.textContent = 'Unknown release code / کد نسخه شناخته نشد.';
    }
  } catch {
    result.textContent = 'Could not check the version. Try again. / بررسی نسخه ممکن نشد. دوباره تلاش کنید.';
  }
}

form.addEventListener('submit', checkVersion);
form.hidden = false;
