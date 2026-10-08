"""Current public scanner claims, retaining unrelated AI, privacy and deploy boundaries."""
from pathlib import Path
import json,re,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def contains(path,text):
 assert text in (ROOT/path).read_text(),f'{path}: missing {text}'
 checks.append(f'{path}: {text}')
def absent(path,text):
 assert text not in (ROOT/path).read_text(),f'{path}: unexpected {text}'
 checks.append(f'{path}: absence {text}')
for path,text in [
 ('index.html','No scan can guarantee'),('index.html','bounded static analysis'),
 ('trust.html','security.txt'),('trust.html','Unsigned preview'),
 ('scan-mods.html','Scan Mods'),('ai-intelligence.html','AI Intelligence'),
 ('ai-intelligence.html','href="/malware-ai.html">Open Malware AI'),
 ('malware-ai.html','Open Windows Preview'),('malware-ai.html','rel="canonical" href="https://malguard.github.io/malware-ai.html"'),
 ('malware-ai.html','"@type": "WebApplication"'),
 ('malware-ai-windows.html','Enter to send'),('malware-ai-windows.html','unicode-bidi:plaintext'),
 ('malware-ai-windows.html','dir="auto"'),('malware-ai-windows.html','applyTextDirection'),
 ('assets/experience.css','unicode-bidi:plaintext'),('assets/experience.js',"'#malware-ai':'/malware-ai.html'"),
 ('index.html','/ai-intelligence.html'),('scan-url.html','Scan URL'),('products.html','LIVE PREVIEW'),
 ('download.html','Verify password and download EXE'),('download.html','More info'),('download.html','Run anyway'),
 ('download.html','Do not disable protection'),('gta-guard.html','No scanned code is executed'),
 ('gta-guard.html','Check your installed build'),('sandbox-help.html','does not upload scanned files'),
 ('app.html','/download.html#scanner'),('app.html','actual MalGuard / GTA Guard Windows scanner'),
 ('index.html','Administrator password'),('assets/public-release.mjs','JSON.stringify({code,part})'),
 ('assets/public-release.mjs',"crypto.subtle.digest('SHA-256'"),('assets/public-release-model.mjs','MAX_FILE_BYTES'),
 ('assets/public-release-model.mjs','reader.cancel()'),('assets/i18n.mjs',"document.documentElement.dir=locale==='fa'?'rtl':'ltr'"),
 ('research/repackaged-mod.html','data-malguard-back'),('ios-preview/index.html','data-malguard-back'),
 ('research/repackaged-mod.html','/assets/page-history.js'),('ios-preview/index.html','/assets/page-history.js')]:contains(path,text)
for path,text in [('index.html','MalGuard detects, blocks, and prevents cheats'),('ai-intelligence.html','href="https://malware-ai-gray.vercel.app">Open Malware AI'),('app.html','MalGuard-App-Preview-'),('download.html','MalGuard-App-Preview-'),('download.html','privateDownloadCode')]:absent(path,text)
release=json.loads((ROOT/'release/malguard-current-release.json').read_text())
assert release['verification']['nativeInstallChecks']==16
assert release['verification']['setupDeadlineChecks']==5
assert release['verification']['installedSyntheticFixtures']>=6
assert release['verification']['windows']['passed']>=1005
assert release['verification']['linux']['passed']>=1006
assert release['verification']['passwordServiceUnitChecks']==19
assert release['passwordRequired'] is True and release['deviceLicenseRequired'] is False and release['installerPasswordRequired'] is False
assert release['verification']['aiAdapterConfigured'] is False
assert release['verification']['corpusMetricsAvailable'] is False
assert release['authenticodeSigned'] is False
assert release['onlineUpdates']['windowsClientVerified'] is True
assert release['onlineUpdates']['verifiedRecords']>0
assert release['build']==f"MG-{release['version']}-WIN64-{release['sourceCommit'][:12]}"
assert re.fullmatch('[a-f0-9]{64}',release['sha256'])
assert json.loads((ROOT/'release/gta-guard-windows-historical-beta7.json').read_text())['version']=='0.8.0-beta.7'
assert 'Historical documentation' in (ROOT/'release/sandbox-help-historical.html').read_text()
checks.append('native/synthetic/feed provenance and preserved historical records')
subprocess.run([sys.executable,str(ROOT/'tests/validate-site.py')],cwd=ROOT,check=True)
print(f'PASS: {len(checks)} trust, product and compatibility checks plus complete release/HTML validation')
