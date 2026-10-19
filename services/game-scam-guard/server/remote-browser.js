import { chromium } from 'playwright-core';

const BROWSERBASE_API = 'https://api.browserbase.com/v1';
const TINYFISH_FETCH_API = 'https://api.fetch.tinyfish.ai';

const unavailable = (provider, detail) => ({ status: 'unavailable', provider, detail });

export function remoteProviderStatus(env = process.env) {
  return {
    browserbase: Boolean(String(env.BROWSERBASE_API_KEY || '').trim()),
    tinyfish: Boolean(String(env.TINYFISH_API_KEY || '').trim()),
  };
}

async function readJson(response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

async function browserbaseRequest(path, { apiKey, method = 'GET', body, fetchImpl = fetch }) {
  const response = await fetchImpl(`${BROWSERBASE_API}${path}`, {
    method,
    headers: { 'X-BB-API-Key': apiKey, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await readJson(response);
  if (!response.ok) {
    const error = new Error(data?.message || data?.error?.message || `Browserbase returned HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function sameOriginOrSubdomain(candidate, origin) {
  try {
    const host = new URL(candidate).hostname.toLowerCase();
    const expected = new URL(origin).hostname.toLowerCase();
    return host === expected || host.endsWith(`.${expected}`);
  } catch { return false; }
}

async function retryDebug(sessionId, options) {
  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return await browserbaseRequest(`/sessions/${encodeURIComponent(sessionId)}/debug?expiresIn=60`, options); }
    catch (error) { last = error; if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  throw last;
}

// Starts a short-lived, empty cloud browser. The caller receives a view-only
// URL before navigation begins, so its UI can show the live evidence stream.
// No profiles, credentials, uploads, POSTs or cross-origin navigations are used.
export async function startBrowserbaseLive(url, { onLiveReady = () => {}, fetchImpl = fetch, connect = chromium.connectOverCDP, env = process.env } = {}) {
  const apiKey = String(env.BROWSERBASE_API_KEY || '').trim();
  if (!apiKey) return unavailable('browserbase', 'Browserbase is not configured by the site administrator.');
  let browser;
  try {
    const target = new URL(url);
    const session = await browserbaseRequest('/sessions', {
      apiKey,
      fetchImpl,
      method: 'POST',
      body: {
        ...(String(env.BROWSERBASE_PROJECT_ID || '').trim() ? { projectId: String(env.BROWSERBASE_PROJECT_ID).trim() } : {}),
        timeout: 60,
        keepAlive: true,
        browserSettings: {
          blockAds: true,
          recordSession: false,
          logSession: false,
          viewport: { width: 1280, height: 800 },
          allowedDomains: [target.hostname],
        },
        userMetadata: { product: 'gamescam-guard', purpose: 'public-website-evidence' },
      },
    });
    const debug = await retryDebug(session.id, { apiKey, fetchImpl });
    const liveUrl = debug?.debuggerFullscreenUrl;
    if (!liveUrl || typeof liveUrl !== 'string') throw new Error('Browserbase did not provide a live-view URL.');
    onLiveReady({ sessionId: session.id, liveUrl });
    browser = await connect(session.connectUrl, { timeout: 8000 });
    const context = browser.contexts()[0];
    if (!context) throw new Error('Browserbase session has no browser context.');
    await context.route('**/*', route => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method())) return route.abort();
      if (!sameOriginOrSubdomain(request.url(), url)) return route.abort();
      return route.continue();
    });
    const page = context.pages()[0] || await context.newPage();
    page.on('dialog', dialog => dialog.dismiss().catch(() => {}));
    await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: 20000 });
    return { status: 'done', provider: 'browserbase', liveUrl, expiresAt: session.expiresAt, detail: 'A short-lived, view-only Browserbase session opened the public page. Sign-in, payment, downloads, uploads and cross-origin navigation were blocked.' };
  } catch (error) {
    const detail = error?.status === 402 ? 'Browserbase free browser time is exhausted.' : error?.status === 401 || error?.status === 403 ? 'Browserbase credentials or account permissions were rejected.' : 'The Browserbase live browser could not be started; the isolated preview remains available.';
    return unavailable('browserbase', detail);
  } finally {
    // keepAlive retains the short remote session; close only this server connection.
    await browser?.close().catch(() => {});
  }
}

export async function fetchWithTinyFish(url, { fetchImpl = fetch, env = process.env } = {}) {
  const apiKey = String(env.TINYFISH_API_KEY || '').trim();
  if (!apiKey) return unavailable('tinyfish', 'TinyFish Fetch is not configured by the site administrator.');
  try {
    const response = await fetchImpl(TINYFISH_FETCH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({ urls: [url], format: 'markdown', links: false, image_links: false, iframe_links: false, ttl: 0, per_url_timeout_ms: 15000, purpose: 'Read-only public website evidence for a safety report. Do not log in, submit forms, pay, or download.' }),
    });
    const data = await readJson(response);
    if (!response.ok) {
      const detail = response.status === 402 ? 'TinyFish Fetch free daily allowance is exhausted.' : response.status === 401 || response.status === 403 ? 'TinyFish credentials or account permissions were rejected.' : 'TinyFish Fetch was unavailable for this scan.';
      return unavailable('tinyfish', detail);
    }
    const page = data?.results?.[0];
    if (!page) {
      const issue = data?.errors?.[0];
      return unavailable('tinyfish', issue?.error === 'page_not_found' ? 'TinyFish reports that this public page does not exist.' : 'TinyFish could not retrieve public page evidence.');
    }
    return { status: 'done', provider: 'tinyfish', finalUrl: typeof page.final_url === 'string' ? page.final_url : url, title: typeof page.title === 'string' ? page.title.slice(0, 240) : '', description: typeof page.description === 'string' ? page.description.slice(0, 500) : '', language: typeof page.language === 'string' ? page.language : null, latencyMs: Number.isFinite(page.latency_ms) ? page.latency_ms : null, detail: 'TinyFish Fetch retrieved read-only public page evidence. It does not provide a live browser view.' };
  } catch {
    return unavailable('tinyfish', 'TinyFish Fetch was unreachable; no conclusion was inferred from that failure.');
  }
}
