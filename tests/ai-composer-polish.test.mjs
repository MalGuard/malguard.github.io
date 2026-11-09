import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const html = read('ai/index.html');
const css = read('ai/polish-20261109.css');
const script = read('ai/polish-20261109.mjs');

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(part => parseInt(part, 16) / 255);
  const [r, g, b] = rgb.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126 * r + .7152 * g + .0722 * b;
}
function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}

test('composer polish is progressive and same-origin under CSP', () => {
  assert.match(html, /<link rel="stylesheet" href="\.\/polish-20261109\.css\?v=1">/);
  assert.match(html, /<script type="module" src="\.\/polish-20261109\.mjs\?v=1"><\/script>/);
  for (const id of ['attach-options','thinking-toggle','web-search-controls','attach-web','attach-toggle','model','send']) {
    assert.match(html, new RegExp('id="' + id + '"'), 'existing UI contract: ' + id);
  }
  assert.doesNotMatch(script, /\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|innerHTML/);
  assert.match(script, /group\.append\(web, thinking\)/);
  assert.match(script, /webAction\.hidden = true/);
  assert.match(script, /ai-composer-enhanced/);
});

test('primary foreground and secondary text pass 4.5:1 in light and dark', () => {
  for (const [text, bg] of [
    ['#18212f','#ffffff'], ['#414e60','#ffffff'],
    ['#57657a','#ffffff'], ['#f5f7fa','#14161b'],
    ['#c5cad3','#14161b'], ['#b0b8c5','#14161b']
  ]) assert.ok(contrast(text,bg)>=4.5, text+' on '+bg);
});

test('keyboard and reduced-motion safety are included', () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /max-width:440px/);
  assert.match(css, /data-theme=light/);
  assert.equal((css.match(/{/g) || []).length,(css.match(/}/g) || []).length);
});