import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeCsv } from '../../../ai/agent/data-analysis.mjs';

test('CSV summary retains quoted delimiters and line breaks and skips missing measurements', () => {
  const result = summarizeCsv('\uFEFFname,value\r\n"a,b",1\r\n"line\nbreak",3\r\n"q""z",\r\n');
  assert.equal(result, '3 rows · 2 columns\nname — 0 missing\nvalue — 1 missing, min 1, max 3, mean 2');
});
test('CSV summary rejects incomplete or inconsistent rows', () => {
  for (const invalid of ['a,b\n1', 'a\n"bad', 'a\n"bad"tail', 'header\n']) {
    assert.throws(() => summarizeCsv(invalid));
  }
});
