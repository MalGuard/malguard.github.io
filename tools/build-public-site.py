"""Build the static Pages artifact from the reviewed explicit public boundary."""
from pathlib import Path
import json,shutil,subprocess,sys
root=Path(__file__).resolve().parents[1]
subprocess.run([sys.executable,str(root/'tests/validate-site.py')],check=True)
out=root/'_site'
if out.exists():shutil.rmtree(out)
out.mkdir()
routes=json.loads((root/'tests/unified-source-inventory.json').read_text())['routes']
for record in routes:
 p=Path(record['path']);(out/p).parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/p,out/p)
for name in ['robots.txt','sitemap.xml','favicon.ico','favicon-96.png','favicon-192.png']:
 shutil.copy2(root/name,out/name)
for name in ['assets','release','data','ios-preview','research']:
 shutil.copytree(root/name,out/name,dirs_exist_ok=True)
(out/'.well-known').mkdir(exist_ok=True)
shutil.copy2(root/'.well-known/security.txt',out/'.well-known/security.txt')
for forbidden in ['api','private-download-service','tests','tools','.git','node_modules','agent-runtime-test-v1','malware-ai-preview-v02']:
 assert not (out/forbidden).exists(),forbidden+' must never be a Pages artifact'
assert not list(out.rglob('*.exe')),'An installer must not become a public direct download'
print(f'PASS build: {len(routes)} public HTML routes; public assets only; server and test sources excluded.')
