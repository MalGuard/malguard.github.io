import test from 'node:test';
import assert from 'node:assert/strict';
import {searchSite} from '../knowledge.mjs';

test('Farsi founder question retrieves official source', () => {
  assert.ok(searchSite('بنیان‌گذار مالگارد کیست؟').some(s => s.url.endsWith('/founder.html')));
});

test("English privacy question retrieves the official policy", () => {
  const sources = searchSite("MalGuard privacy policy");
  assert.ok(sources.some(source => /privacy/.test(source.url)));
});
