// Static regression for the 2026-11-01 unified monochrome deep-space pass.
// This is deliberately independent of remote providers and backend credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const home=read('index.html');
const homeCss=read('assets/precision/deep-space-home.css');
const sharedCss=read('assets/precision/shared-pages.css');
const aiCss=read('ai/style.css');
const portalCss=read('services/game-scam-guard/src/compact.css');
const chart=read('assets/precision/telemetry-chart.js');
const stars=read('assets/precision/stars.svg');

test('product cards retain the original artwork and real destinations',()=>{
 for(const asset of ['/assets/precision/gta-card-960.webp','/assets/precision/scam-card-960.webp','/assets/precision/ai-card.svg']){
  assert.ok(home.includes(asset),'Missing original product artwork: '+asset);
 }
 for(const link of ['/gta-guard.html','/game-scam-guard.html','/ai-product.html']){
  assert.ok(home.includes(link),'Missing original product route: '+link);
 }
});
test('home has no made-up published traffic or throughput',()=>{
 assert.doesNotMatch(home,/data-count="10000"|data-count="5000"|99\.4% clean|18ms p95|128 checks each minute/);
 assert.doesNotMatch(chart,/99\.4% clean|99\.9% clean|22\.0% clean|\d+ms p95/);
 assert.match(home,/totals are not verified/);
 assert.match(home,/Illustration · no live scan/);
});
test('static site-wide backdrop is lightweight and preserves reduced-motion behavior',()=>{
 for(const css of [homeCss,sharedCss,aiCss,portalCss]) {
  assert.match(css,/2026-11-01/,'Missing cross-page theme');
  assert.match(css,/radial-gradient/,'Missing depth layer');
 }
 assert.match(stars,/<svg[^>]+viewBox="0 0 1920 1080"/);
 assert.doesNotMatch(stars,/<animate|<script|<foreignObject/i);
 assert.match(homeCss,/particle-atmosphere::before[\s\S]*?animation:none/);
 assert.doesNotMatch(home,/rel="preload" href="\/assets\/precision\/obsidian-space\.webp/);
 assert.match(home,/v=20261101-obsidian/);
});
