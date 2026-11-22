import pages from './knowledge/pages.json' with { type: 'json' };

const stop = new Set('the a an is it on in about with of me for and how can you to are این یک را رو از به در و با که چه چیست است من می کنم لطفا سایت مالگارد malguard'.split(' '));
const synonyms = new Map(Object.entries({
  بنیانگذار:'founder', 'بنیان‌گذار':'founder', موسس:'founder', مؤسس:'founder',
  سازنده:'founder', محصولات:'products', محصول:'product', تماس:'contact',
  دانلود:'download', امنیت:'security', گزارش:'report', مستندات:'docs',
  پشتیبانی:'support', اسکن:'scan', بازی:'game', ابزار:'tools', خصوصی:'privacy',
  هوش:'ai', تقلب:'scam', مود:'mod', امضا:'signatures', هش:'hashes'
}));

function words(text) {
  const tokens = text.normalize('NFKC').toLowerCase().replace(/ي/g,'ی').replace(/ك/g,'ک')
    .match(/[\p{L}\p{N}\u200c]+/gu) ?? [];
  return tokens.filter(t => !stop.has(t)).flatMap(t => synonyms.has(t) ? [t,synonyms.get(t)] : [t]);
}

function chunks(text) {
  const pieces = [];
  const tokens = text.split(/\s+/);
  for (let i = 0; i < tokens.length; i += 90) {
    pieces.push(tokens.slice(i, i + 105).join(' '));
  }
  return pieces;
}

const index = pages.map(page => ({
  ...page, titleWords: new Set(words(page.title + ' ' + new URL(page.url).pathname)),
  passages: chunks(page.text).map(text => ({text, terms: new Set(words(text))}))
}));
const frequency = new Map();
for (const page of index) {
  const terms = new Set(page.passages.flatMap(p => [...p.terms]).concat([...page.titleWords]));
  for (const term of terms) frequency.set(term, (frequency.get(term) ?? 0) + 1);
}

export function searchSite(query, limit = 3) {
  const terms = [...new Set(words(query))];
  const scores = index.map(page => {
    const weight = term => Math.log1p(index.length / (frequency.get(term) || 1));
    let best = {text:'', score:0};
    for (const passage of page.passages) {
      const score = terms.reduce((sum, t) => sum + (passage.terms.has(t) ? weight(t) : 0), 0);
      if (!best.text || score > best.score) best = {text: passage.text, score};
    }
    const titleScore = terms.reduce((sum, t) => sum + (page.titleWords.has(t) ? 4 * weight(t) : 0), 0);
    return {score: best.score + titleScore, source:{url:page.url, title:page.title, text:best.text.slice(0,1000)}};
  });
  return scores.filter(s => s.score > 0).sort((a,b) => b.score - a.score).slice(0,limit).map(s => s.source);
}

export async function retrieveKnowledge(prompt, {webSearch=false, apiKey, fetcher=fetch}={}) {
  const sources = searchSite(prompt);
  if (!webSearch) return {sources, webStatus:'off'};
  if (/https?:\/\//i.test(prompt)) {
    const references = await retrieveReferences(prompt, {webSearch, apiKey, fetcher});
    return {sources:[...references.sources,...sources], webStatus:references.referenceStatus === 'ok' ? 'ok' : 'unavailable'};
  }
  if (!apiKey) return {sources, webStatus:'unavailable'};
  try {
    const response = await fetcher('https://api.exa.ai/search', {
      method:'POST', redirect:'error', signal:AbortSignal.timeout(5000),
      headers:{'content-type':'application/json', 'x-api-key':apiKey},
      body:JSON.stringify({query:prompt.slice(0,500), numResults:3, contents:{text:{maxCharacters:850}}})
    });
    if (!response.ok) throw new Error('Search failed');
    const result = await response.json();
    if (!Array.isArray(result.results)) throw new Error('Invalid search results');
    for (const item of result.results.slice(0,3)) {
      if (typeof item.url !== 'string' || typeof item.text !== 'string') continue;
      if (!URL.canParse(item.url) || new URL(item.url).protocol !== 'https:') continue;
      sources.push({url:item.url.slice(0,1000), title:String(item.title ?? '').slice(0,160), text:item.text.slice(0,850)});
    }
    return {sources, webStatus:'ok'};
  } catch {
    return {sources, webStatus:'unavailable'};
  }
}

// Only submit ordinary, public-looking DNS names to the provider; never follow user URLs here.
function referenceURL(value) {
  if (!URL.canParse(value)) return null;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search) return null;
  const host = url.hostname.toLowerCase();
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) return null;
  if (/(^|\.)(localhost|local|internal|test|invalid|example|onion|home\.arpa|nip\.io|sslip\.io)$/.test(host)) return null;
  url.hash = '';
  return url.href.length <= 1000 ? url.href : null;
}

export async function retrieveReferences(prompt, {webSearch=false, apiKey, fetcher=fetch}={}) {
  if (!webSearch) return {sources:[], referenceStatus:'off'};
  const candidates = prompt.match(/https:\/\/[^\s<>"'`،؛]+/gi) ?? [];
  const urls = [...new Set(candidates.map(link => referenceURL(link.replace(/[.,;)\]!?؟]+$/u,''))).filter(Boolean))].slice(0,2);
  if (!urls.length) return {sources:[], referenceStatus:'none'};
  if (!apiKey) return {sources:[], referenceStatus:'unavailable'};
  try {
    const response = await fetcher('https://api.exa.ai/contents', {
      method:'POST', redirect:'error', signal:AbortSignal.timeout(6500),
      headers:{'content-type':'application/json', 'x-api-key':apiKey},
      body:JSON.stringify({urls, text:{maxCharacters:2000}})
    });
    if (!response.ok) throw new Error('Reference lookup failed');
    const {results} = await response.json();
    const sources = [];
    for (const item of Array.isArray(results) ? results.slice(0,2) : []) {
      const url = referenceURL(String(item?.url || ''));
      if (!url || !urls.includes(url) || typeof item.text !== 'string' || !item.text.trim()) continue;
      sources.push({url, title:String(item.title ?? '').slice(0,160), text:item.text.slice(0,2000)});
    }
    return {sources, referenceStatus:sources.length ? 'ok' : 'unavailable'};
  } catch {
    return {sources:[], referenceStatus:'unavailable'};
  }
}
