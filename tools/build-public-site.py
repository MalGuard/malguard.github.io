"""Build the static Pages artifact from the reviewed explicit public boundary."""
from pathlib import Path
import json,os,shutil,subprocess,sys
root=Path(__file__).resolve().parents[1]
# Pages providers may invoke this script directly; produce both app bundles first.
npm=shutil.which('npm.cmd' if sys.platform == 'win32' else 'npm')
if not npm: raise RuntimeError('npm is required to build the public applications')
for target in ('build:ai','build:game-scam-guard'):
 subprocess.run([npm,'run',target],cwd=root,check=True)
subprocess.run([sys.executable,str(root/'tests/validate-site.py')],check=True)
out=root/'_site'
if out.exists():shutil.rmtree(out)
out.mkdir()
routes=json.loads((root/'tests/unified-source-inventory.json').read_text())['routes']
for record in routes:
 p=Path(record['path']);(out/p).parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/p,out/p)
for name in ['robots.txt','sitemap.xml','llms.txt','favicon.ico','favicon-96.png','favicon-192.png','og-image-blue.png','og-image.png','favicon-blue-96.png','favicon-blue-192.png','apple-touch-icon-blue.png']:
 shutil.copy2(root/name,out/name)
for name in ['assets','release','data','ios-preview','research']:
 shutil.copytree(root/name,out/name,dirs_exist_ok=True)
(out/'.well-known').mkdir(exist_ok=True)
shutil.copy2(root/'.well-known/security.txt',out/'.well-known/security.txt')
shutil.copytree(root/'services/game-scam-guard/dist',out/'game-scam-guard')
shutil.copytree(root/'ai',out/'ai')
shutil.copytree(root/'code-preview',out/'code-preview')
# Preserve the standalone preview added to main while this feature was developed.
shutil.copy2(root/'malguard-ai-motion.html',out/'malguard-ai-motion.html')
for forbidden in ['services','api','private-download-service','tests','tools','.git','node_modules','agent-runtime-test-v1','malware-ai-preview-v02']:
 assert not (out/forbidden).exists(),forbidden+' must never be a Pages artifact'
release=json.loads((root/'release/malguard-current-release.json').read_text())
assert sorted(out.rglob('*.exe'))==[out/release['serviceUrl'].lstrip('/')], 'Only the reviewed public installer may ship'
# Cloudflare Pages rejects assets above 25 MiB. The reviewed installer stays on
# the official GitHub Pages origin; Cloudflare builds redirect its exact URL.
if os.environ.get('CF_PAGES') == '1':
 installer=out/release['serviceUrl'].lstrip('/')
 installer.unlink()
 (out/'_redirects').write_text(release['serviceUrl']+' https://malguard.site'+release['serviceUrl']+' 302\n',encoding='utf-8')
 print('Cloudflare: public installer redirects to the official GitHub Pages origin.')
print(f'PASS build: {len(routes)} public HTML routes; public assets only; server and test sources excluded.')
