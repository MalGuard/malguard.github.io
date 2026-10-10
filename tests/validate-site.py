"""Validate actual shipped HTML links, assets and product-distribution boundaries."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import re, json
from hashlib import sha256
ROOT=Path(__file__).resolve().parents[1]
PAGES=[ROOT/'index.html', *[p for p in ROOT.glob('*.html') if p.name!='index.html'],ROOT/'ios-preview/index.html',ROOT/'research/repackaged-mod.html',ROOT/'research/security-motion.html',ROOT/'release/sandbox-help-historical.html']
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
historical=json.loads((ROOT/'release/malguard-public-release.json').read_text())
release=json.loads((ROOT/'release/malguard-current-release.json').read_text())
status=json.loads((ROOT/'data/product-status.json').read_text())['products']['gtaGuard']
legacy=json.loads((ROOT/'release/gta-guard-windows.json').read_text())
assert historical['status']=='public-download-ready'
assert release['status']=='password-download-ready'
assert release['passwordRequired'] is True and release['deviceLicenseRequired'] is False and release['installerPasswordRequired'] is False
assert release['build']==f"MG-{release['version']}-WIN64-{release['sourceCommit'][:12]}"
assert re.fullmatch('[a-f0-9]{64}',release['sha256'])
assert 0<release['size']<=40*1024*1024
assert release['serviceUrl']=='https://malguard-private-download.vercel.app/api/installer'
assert release['verification']['nativeInstallChecks']==16
assert release['verification']['setupDeadlineChecks']==5
assert release['verification']['passwordServiceUnitChecks']==19
assert release['verification']['nativeWindowsVerified'] is True
assert release['verification']['corpusMetricsAvailable'] is False
assert status['currentVersion']==release['version']
assert status['distribution']['windowsX64']=='password-download-ready'
assert legacy['installer']['sha256']==release['sha256']
assert legacy['distribution']['downloadEnabled'] is True
assert 'type="password"' in (ROOT/'download.html').read_text()
assert 'publicAccess: true' in (ROOT/'private-download-service/api/download.js').read_text()
assert 'Administrator password' in (ROOT/'index.html').read_text()
assert 'createPasswordDownloadHandler' in (ROOT/'private-download-service/api/installer.js').read_text()
private=json.loads((ROOT/'release/malguard-private-release.json').read_text())
assert private['status']=='private-package-ready'
assert private['build']==f"MG-{private['version']}-WIN64-{private['sourceCommit'][:12]}"
assert private['passwordRequired'] is True and private['deviceLicenseRequired'] is True
assert private['authenticodeSigned'] is False and private['ownerWindowsTested'] is False
assert private['url']==f"/release/private/{private['filename']}"
package=ROOT/private['url'].lstrip('/')
assert package.stat().st_size==private['size']
assert sha256(package.read_bytes()).hexdigest()==private['sha256']
assert package.read_bytes()[:6]==b'7z\xbc\xaf\x27\x1c'
assert sorted(p.name for p in package.parent.iterdir())==[private['filename']], 'Only ciphertext may be published'
assert not {'password','fingerprint','license','privateKey'} & set(private)
download=(ROOT/'download.html').read_text()
assert private['url'] not in download
assert 'device activation is required' in download
assert 'sealed-installer' not in download
assert not list((ROOT/'release').rglob('*.exe'))
server=(ROOT/'private-download-service/installer-release.mjs').read_text()
assert release['sha256'] in server and release['build'] in server
metadata=json.loads(server.removeprefix('export const metadata = Object.freeze(').strip().removesuffix(');'))
assert metadata['size']==release['size'] and metadata['sha256']==release['sha256']
assert re.fullmatch('[a-f0-9]{64}',metadata['passwordSalt'])
sealed=[]
for part in metadata['parts']:
    assert re.fullmatch('[0-9]{3}\\.sealed',part['name']) and 0<part['size']<=4*1024*1024
    piece=(ROOT/'private-download-service/sealed-installer'/part['name']).read_bytes()
    assert len(piece)==part['size']
    sealed.append(piece)
ciphertext=b''.join(sealed)
assert ciphertext[:6]==b'MGDL1\x00' and len(ciphertext)==release['size']+34
assert sha256(ciphertext).hexdigest()==metadata['sealedSha256']
assert not list((ROOT/'private-download-service').rglob('*.exe'))
assert set(metadata)=={'filename','size','sha256','build','sealedSha256','passwordSalt','passwordKdf','parts'}
assert metadata['passwordKdf']=='scrypt-v1'
assert not {'password','fingerprint','license','privateKey','code'} & set(release)
for page in PAGES:
    text=page.read_text()
    assert '/assets/i18n.mjs' in text,f'{page}: missing locale controls'
for e in errors: print(e)
if errors:raise SystemExit(f'{len(errors)} link/asset/distribution errors')
print(f'PASS: {len(PAGES)} HTML documents, links/assets/anchors, multilingual controls, website password release, historical encrypted package hash and preserved admin authentication')
