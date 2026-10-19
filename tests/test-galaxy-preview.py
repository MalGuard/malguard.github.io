"""Regression guards for the isolated MalGuard Galaxy Vercel preview."""
from html.parser import HTMLParser
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
home = (ROOT / 'index.html').read_text(encoding='utf-8')
energy = (ROOT / 'assets/fusion/energy.js').read_text(encoding='utf-8')
opening = (ROOT / 'assets/fusion/home-opening.js').read_text(encoding='utf-8')
layout = (ROOT / 'assets/fusion/galaxy-preview.css').read_text(encoding='utf-8')

class SceneParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scenes = []
        self.ids = []
        self.heading_ids = set()
    def handle_starttag(self, tag, attrs):
        props = dict(attrs)
        if 'id' in props:
            self.ids.append(props['id'])
        if tag == 'section' and 'data-scene' in props:
            self.scenes.append((props['data-scene'], props.get('id'), props.get('aria-labelledby')))
            assert tag == 'section' and props.get('aria-labelledby'), props
        if tag in ('h1', 'h2') and 'id' in props:
            self.heading_ids.add(props['id'])

parser = SceneParser()
parser.feed(home)
expected_ids = ['welcome','gta-guard','threat-radar','game-scam-guard','products']
assert len(parser.scenes) == 5, parser.scenes
assert [int(x[0]) for x in parser.scenes] == list(range(5)), parser.scenes
assert [x[1] for x in parser.scenes] == expected_ids, parser.scenes
assert all(x[2] in parser.heading_ids for x in parser.scenes), 'Missing section heading'
assert len(parser.ids) == len(set(parser.ids)), 'Duplicate IDs'
assert home.count('<h1') == 1, 'Homepage must expose one H1'
assert 'id="home-opening"' in home and 'id="home-scene"' in home
assert '/assets/fusion/home-opening.js' in home
assert '/assets/fusion/home-opening-projection.js' in home
assert '/assets/fusion/galaxy-preview.css' in home
assert '/assets/fusion/energy.js' in home
assert '<meta content="noindex,nofollow" name="robots"/>' in home
assert all(marker not in home for marker in ['id="demo"', 'id="sc3"', 'id="layers"', 'class="after"', 'data-scene="5"'])
assert all(f'href="#{anchor}"' in home or f'id="{anchor}"' in home for anchor in expected_ids)
assert all(path in home for path in ['/gta-guard.html','/threat-radar.html','/products.html#game-scam-guard','/tools.html','/trust.html'])
assert "return 4;" in energy and "canvas.dataset.formCount='5'" in energy
assert "getElementById('sc3')" not in energy and "document.querySelector('.after')" not in energy
assert "wakeUntil" in energy and "'mg-static-field'" in energy and "slowFrames>=7" in energy
assert "(navigator.deviceMemory||8)<=4" in opening
assert '@media(max-width:900px)' in layout and '@media(max-width:380px)' in layout
assert '@media(prefers-reduced-motion:reduce)' in layout and 'mg-static-field' in layout
assert 'background:linear-gradient' in layout and 'min-height:102svh' in layout
print('PASS gallery: 5 semantic scenes, preserved opening, no post-galaxy modules, mobile/low-power fallbacks')
