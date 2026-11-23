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
