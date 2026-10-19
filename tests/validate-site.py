"""Validate actual shipped HTML links, assets and product-distribution boundaries."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import re, json
from hashlib import sha256
ROOT=Path(__file__).resolve().parents[1]
PUBLIC_AI_GUIDES=[ROOT/'research/gta-5-mod-security.html', ROOT/'research/gta-mod-security-fa.html']
PAGES=[ROOT/'index.html', *[p for p in ROOT.glob('*.html') if p.name!='index.html'],ROOT/'ios-preview/index.html',ROOT/'research/repackaged-mod.html',ROOT/'research/security-motion.html',*PUBLIC_AI_GUIDES,ROOT/'research/mod-download-checklist.html',ROOT/'research/scan-result-limits.html',ROOT/'release/sandbox-help-historical.html']
# The Guard source is compiled and copied to the Pages artifact by the static
# workflow. Keep this route explicit so a typo cannot hide as a link, while
# allowing the source-only validator to run before a local build.
PUBLISHED_APP_ROUTES={'/game-scam-guard/':ROOT/'services/game-scam-guard/index.html'}
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
        target=PUBLISHED_APP_ROUTES.get(u.path,ROOT/unquote(u.path.lstrip('/')) if u.path.startswith('/') else page.parent/unquote(u.path))
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
assert release['status']=='public-download-ready'
assert release['passwordRequired'] is False and release['deviceLicenseRequired'] is False and release['installerPasswordRequired'] is False
assert release['build']==f"MG-{release['version']}-WIN64-{release['sourceCommit'][:12]}"
assert re.fullmatch('[a-f0-9]{64}',release['sha256'])
assert 0<release['size']<=40*1024*1024
assert release['serviceUrl']=='/release/MalGuard-Setup-x64.exe'
assert release['verification']['nativeInstallChecks']==18
assert release['verification']['linux']['passed']>=1030
assert release['verification']['windows']['passed']>=1029
assert release['verification']['desktopUpdateBrowserChecks']==35
assert release['verification']['setupDeadlineChecks']==5
assert release['verification']['passwordServiceUnitChecks']==21
assert release['verification']['nativeWindowsVerified'] is True
assert release['verification']['corpusMetricsAvailable'] is False
assert status['currentVersion']==release['version']
assert status['distribution']['windowsX64']=='public-download-ready'
assert status['distribution']['passwordRequired'] is False
assert legacy['installer']['sha256']==release['sha256']
assert legacy['distribution']['downloadEnabled'] is True
assert 'type="password"' not in (ROOT/'download.html').read_text()
assert 'publicAccess: true' in (ROOT/'private-download-service/api/download.js').read_text()
assert 'Administrator password' in (ROOT/'console-8d42b69fda13705cc47a.html').read_text()
assert 'siteAdminPassword' not in (ROOT/'index.html').read_text()
assert 'id="siteAdminEntry"' not in (ROOT/'console-8d42b69fda13705cc47a.html').read_text()
assert 'console-8d42b69fda13705cc47a.html' not in (ROOT/'sitemap.xml').read_text()
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
assert 'Public download, installation and launch require no password or device activation.' in download
assert 'Download paused' not in download
assert 'sealed-installer' not in download
installer=ROOT/release['serviceUrl'].lstrip('/')
assert sorted((ROOT/'release').rglob('*.exe'))==[installer], 'Only the reviewed public installer may ship'
assert installer.stat().st_size==release['size']
assert installer.read_bytes()[:2]==b'MZ'
assert sha256(installer.read_bytes()).hexdigest()==release['sha256']
assert (installer.with_suffix('.exe.sha256')).read_text()==release['sha256']+'  '+release['filename']+'\n'
server=(ROOT/'private-download-service/installer-release.mjs').read_text()
metadata=json.loads(server.removeprefix('export const metadata = Object.freeze(').strip().removesuffix(');'))
assert re.fullmatch('[a-f0-9]{64}',metadata['passwordSalt'])
sealed=[]
for part in metadata['parts']:
    assert re.fullmatch('[0-9]{3}\\.sealed',part['name']) and 0<part['size']<=4*1024*1024
    piece=(ROOT/'private-download-service/sealed-installer'/part['name']).read_bytes()
    assert len(piece)==part['size']
    sealed.append(piece)
ciphertext=b''.join(sealed)
assert ciphertext[:6]==b'MGDL1\x00' and len(ciphertext)==metadata['size']+34
assert sha256(ciphertext).hexdigest()==metadata['sealedSha256']
assert not list((ROOT/'private-download-service').rglob('*.exe'))
assert set(metadata)=={'filename','size','sha256','build','sealedSha256','passwordSalt','passwordKdf','parts'}
assert metadata['passwordKdf']=='scrypt-v1'
assert not {'password','fingerprint','license','privateKey','code'} & set(release)
for page in PAGES:
    text=page.read_text()
    if page not in PUBLIC_AI_GUIDES:
        assert '/assets/i18n.mjs' in text,f'{page}: missing locale controls'
# Keep the GTA Guard layout and schema while updating public release availability.
gta_html=(ROOT/'gta-guard.html').read_text()
assert 'id="gta-security-questions"' not in gta_html,'Do not alter the GTA Guard visual layout'
assert gta_html.count('<h1')==1,'GTA Guard must keep one primary heading'
gta_schema_blocks=re.findall(r'<script type="application/ld\+json">([\s\S]*?)</script>',gta_html)
assert len(gta_schema_blocks)==1,'Expected exactly one structured product definition'
gta_schema=json.loads(gta_schema_blocks[0])
assert gta_schema['@type']=='SoftwareApplication'
assert gta_schema['name']=='GTA Guard'
assert gta_schema['url']=='https://malguard.site/gta-guard.html'
assert gta_schema['publisher']['@id']=='https://malguard.site/#organization'
assert 'Public Windows download is available without a password.' in gta_html
# Machine-readable public source directory must be included in the Pages build.
llms=(ROOT/'llms.txt').read_text(encoding='utf-8')
assert llms.startswith('# MalGuard | Official gaming-security project')
assert 'https://malguard.site/gta-guard.html' in llms
assert 'https://malguard.site/research/gta-mod-security-fa.html' in llms
assert 'The current Windows x64 preview installer is available without a password' in llms
assert release['passwordRequired'] is False and release['status']=='public-download-ready'
assert not any(x in llms for x in ['/console-8d42b69fda13705cc47a.html', '/private-download-service/', '/release/private/'])
assert "'llms.txt'" in (ROOT/'tools/build-public-site.py').read_text()
sitemap=(ROOT/'sitemap.xml').read_text()
for page,locale in zip(PUBLIC_AI_GUIDES,['en','fa']):
    text=page.read_text()
    assert f'<html lang="{locale}"' in text,f'{page}: wrong language'
    assert text.count('<h1>')==1 and text.count('</h1>')==1,f'{page}: heading'
    assert text.count('<article class="card">')==4,f'{page}: expected four verified Q&A'
    assert f'<link rel="canonical" href="https://malguard.site/{page.relative_to(ROOT).as_posix()}">' in text
    assert f'https://malguard.site/{page.relative_to(ROOT).as_posix()}</loc>' in sitemap
    assert 'Public installer' in text if locale=='en' else 'دانلود عمومی' in text
    match=re.search(r'<script type="application/ld\+json">([\s\S]*?)</script>',text)
    assert match is not None
    article=json.loads(match.group(1))
    assert article['@type']=='Article' and article['inLanguage']==locale
assert 'مالگارد (MalGuard) چیست؟' in PUBLIC_AI_GUIDES[1].read_text()
assert 'Which app can inspect GTA 5 mods before installation?' in PUBLIC_AI_GUIDES[0].read_text()
assert 'malware-ai-windows.html' not in sitemap


# The web preview is distinct from the unreleased Game Scam Guard Windows installer.
assert 'Web preview available; Windows app in development.' in (ROOT/'index.html').read_text()
assert 'Web preview for gaming scam checks; Windows installer is still in development.' in (ROOT/'products.html').read_text()
assert 'href="/game-scam-guard/"' in (ROOT/'index.html').read_text()
assert '<a href="/malware-ai.html">Malware AI</a>' not in (ROOT/'game-scam-guard.html').read_text()
assert json.loads((ROOT/'data/product-status.json').read_text())['products']['gameScamGuard']['downloadEnabled'] is False

# Check migration metadata before publishing. Search engines must see only the custom domain.
canonical_base = "https://malguard.site/"
indexed_urls = re.findall(r"<loc>([^<]+)</loc>", (ROOT/'sitemap.xml').read_text())
assert indexed_urls and len(indexed_urls) == len(set(indexed_urls))
assert all(url.startswith(canonical_base) for url in indexed_urls), 'Sitemap includes a noncanonical host'
for indexed_url in indexed_urls:
    relpath = indexed_url[len(canonical_base):]
    published_page = ROOT / (relpath or 'index.html')
    assert published_page.is_file(), f'Sitemap points to a missing page: {indexed_url}'
    expected_canonical = f'<link rel="canonical" href="{indexed_url}">'
    assert expected_canonical in published_page.read_text(), f'Wrong canonical: {relpath}'
assert f'Sitemap: {canonical_base}sitemap.xml' in (ROOT/'robots.txt').read_text()
assert json.loads((ROOT/'data/product-status.json').read_text())['canonicalSite'] == canonical_base
assert canonical_base in (ROOT/'llms.txt').read_text()

for e in errors: print(e)
if errors:raise SystemExit(f'{len(errors)} link/asset/distribution errors')
print(f'PASS: {len(PAGES)} HTML documents, links/assets/anchors, multilingual controls, public installer size/SHA-256, historical encrypted package hash and preserved admin authentication')


# Editorial trust pack: newly indexed pages have one H1, safe local links,
# public locale controls, and are wired into the source-only public build.
editorial_paths = [
    'press.html',
    'security-evidence.html',
    'research/mod-download-checklist.html',
    'research/scan-result-limits.html',
]
inventory = json.loads((ROOT/'tests/unified-source-inventory.json').read_text())
for path in editorial_paths:
    doc = (ROOT/path).read_text(encoding='utf-8')
    assert doc.count('<h1>') == 1 and doc.count('</h1>') == 1, path
    assert f'https://malguard.site/{path}</loc>' in sitemap, path
    assert f'<link rel="canonical" href="https://malguard.site/{path}">' in doc, path
    assert '/assets/i18n.mjs' in doc, path
    assert any(route['path'] == path for route in inventory['routes']), path
    assert f'https://malguard.site/{path}' in llms, path
assert 'href="/press.html"' in (ROOT/'founder.html').read_text()
assert 'href="/security-evidence.html"' in (ROOT/'trust.html').read_text()
assert 'href="/research/mod-download-checklist.html"' in (ROOT/'labs.html').read_text()
assert 'href="/research/scan-result-limits.html"' in (ROOT/'labs.html').read_text()
assert inventory['publicRouteCount'] == len(inventory['routes'])
