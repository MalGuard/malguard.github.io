"""Validate actual shipped HTML links, assets and product-distribution boundaries."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import re, json
ROOT=Path(__file__).resolve().parents[1]
PAGES=[ROOT/'index.html', *[p for p in ROOT.glob('*.html') if p.name!='index.html'],ROOT/'ios-preview/index.html',ROOT/'research/repackaged-mod.html']
class Document(HTMLParser):
    def __init__(self,text):
        super().__init__(); self.ids=[];self.refs=[];self.controls=[];self.feed(text)
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        for key in ['src','href']:
            if key in a:self.refs.append((tag,a[key]))
errors=[]
for page in PAGES:
    text=page.read_text();doc=Document(text)
    duplicates={x for x in doc.ids if doc.ids.count(x)>1}
    if duplicates:errors.append(f'{page.name}: duplicate IDs {duplicates}')
    for tag,ref in doc.refs:
        u=urlsplit(ref)
        if u.scheme or u.netloc or not ref:continue
        target=ROOT/unquote(u.path.lstrip('/')) if u.path.startswith('/') else page.parent/unquote(u.path)
        if not u.path:target=page
        if target.is_dir():target=target/'index.html'
        if not target.is_file():errors.append(f'{page.name}: missing {ref}');continue
        if u.fragment and target.suffix=='.html':
            if u.fragment not in Document(target.read_text()).ids:errors.append(f'{page.name}: missing anchor {ref}')
    if re.search(r'https://github\.com/MalGuard/malguard\.github\.io/releases/download/gta-guard-[^"\s]+\.exe',text):errors.append(f'{page.name}: paused GTA installer URL exposed')
release=json.loads((ROOT/'release/malguard-public-release.json').read_text())
status=json.loads((ROOT/'data/product-status.json').read_text())['products']['gtaGuard']
legacy=json.loads((ROOT/'release/gta-guard-windows.json').read_text())
assert release['status']=='public-download-ready'
assert release['build']==f"MG-{release['version']}-WIN64-{release['sourceCommit'][:12]}"
assert re.fullmatch('[a-f0-9]{64}',release['sha256'])
assert 0<release['size']<=40*1024*1024
assert release['serviceUrl']=='https://malguard-private-download.vercel.app/api/download'
assert release['verification']['nativeInstallChecks']==15
assert release['verification']['publicServiceChecks']==7
assert release['verification']['nativeWindowsVerified'] is True
assert release['verification']['corpusMetricsAvailable'] is False
assert status['currentVersion']==release['version']
assert status['distribution']['windowsX64']=='public-download-ready'
assert legacy['installer']['sha256']==release['sha256']
assert legacy['distribution']['downloadEnabled'] is True
assert 'privateDownloadCode' not in (ROOT/'download.html').read_text()
assert 'publicAccess: true' in (ROOT/'private-download-service/api/download.js').read_text()
assert 'Administrator password' in (ROOT/'index.html').read_text()
for page in PAGES:
    text=page.read_text()
    assert '/assets/i18n.mjs' in text,f'{page}: missing locale controls'
for e in errors: print(e)
if errors:raise SystemExit(f'{len(errors)} link/asset/distribution errors')
print(f'PASS: {len(PAGES)} HTML documents, links/assets/anchors, multilingual controls, verified public release and preserved admin authentication')
