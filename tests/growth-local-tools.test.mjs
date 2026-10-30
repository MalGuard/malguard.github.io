import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const homepage = readFileSync(new URL('index.html', root), 'utf8');
const tools = readFileSync(new URL('tools.html', root), 'utf8');

test('homepage offers a visible, no-signup tool and public source', () => {
  assert.match(homepage, /href="\/tools\.html#link-inspector">Try free link check/);
  assert.match(homepage, /href="https:\/\/github\.com\/MalGuard\/malguard-core"/);
});

test('the browser-only link inspector exposes a sample and a shareable URL', () => {
  for (const id of ['urlInput', 'inspectButton', 'demoLinkButton', 'shareToolsButton', 'shareToolsStatus', 'urlResult']) {
    assert.ok(tools.includes(`id="${id}"`), id);
  }
  assert.match(tools, /The destination was not opened and no network request was made by this tool/);

  const begin = tools.indexOf('<script>\nconst hashFile=');
  assert.ok(begin >= 0, 'inline browser tool script exists');
  const finish = tools.indexOf('</script>', begin);
  assert.ok(finish > begin);
  const script = tools.slice(begin + '<script>'.length, finish);

  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {
      value: '', textContent: '', innerHTML: '', files: [], listeners: {},
      addEventListener(type, callback) { this.listeners[type] = callback; },
      click() { return this.listeners.click?.(); }
    });
    return nodes.get(id);
  };
  let copied = '';
  const navigator = {clipboard: {writeText: async value => {copied=value;}}};
  const document = {getElementById: node};
  vm.runInNewContext(script, {document, navigator, URL, crypto: globalThis.crypto});

  node('demoLinkButton').click();
  assert.equal(node('urlInput').value, 'https://discord.com@mods.example.com/download');
  assert.match(node('urlResult').innerHTML, /mods\.example\.com/);
  assert.match(node('urlResult').innerHTML, /Embedded credentials or @ symbol/);
  assert.match(node('shareToolsStatus').textContent, /Synthetic example only/);
  return node('shareToolsButton').click().then(() => {
    assert.equal(copied, 'https://malguard.site/tools.html#link-inspector');
    assert.ok(!copied.includes('discord.com'));
    assert.match(node('shareToolsStatus').textContent, /Link copied/);
  });
});

test('tool never advertises a safe verdict or automatic network scan', () => {
  assert.match(tools, /This does not prove the destination is safe/);
  assert.match(tools, /without silently uploading your input/);
  assert.doesNotMatch(tools, /fetch\s*\(\s*(?:raw|u\.href|urlInput)/);
});
