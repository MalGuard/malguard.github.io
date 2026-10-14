"""Current public scanner and advisory product claims, retaining privacy and deployment boundaries."""
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
 ('index.html','No scan can guarantee'),('gta-guard.html','Static analysis / No scanned code execution'),
 ('trust.html','security.txt'),('trust.html','Unsigned preview'),
 ('scan-mods.html','Scan Mods'),('threat-radar.html','Threat Radar'),
 ('ai-intelligence.html','Now replaced by Threat Radar.'),
 ('malware-ai.html','Now replaced by Threat Radar.'),('threat-radar.html','rel="canonical" href="https://malguard.site/threat-radar.html"'),
 ('malware-ai.html','noindex,follow'),
 ('malware-ai-windows.html','noindex,follow'),('threat-radar.html','No invented attack locations.'),
 ('assets/threat-radar.js','document.createElement'),('assets/threat-radar.js','Public advisory data is unavailable'),
 ('assets/experience.css','unicode-bidi:plaintext'),('assets/experience.js',"'#malware-ai':'/threat-radar.html'"),
 ('index.html','/threat-radar.html'),('scan-url.html','Scan URL'),('products.html','PUBLIC ADVISORY FEED'),
 ('download.html','Download Windows EXE'),('download.html','More info'),('download.html','Run anyway'),
 ('download.html','Do not disable protection'),('gta-guard.html','No scanned code is executed'),
 ('gta-guard.html','Check your installed build'),('sandbox-help.html','does not upload scanned files'),
 ('app.html','/download.html#scanner'),('app.html','actual MalGuard / GTA Guard Windows scanner'),
 ('console-8d42b69fda13705cc47a.html','Administrator password'),('assets/public-release.mjs',"method:'GET'"),
 ('assets/public-release.mjs',"crypto.subtle.digest('SHA-256'"),('assets/public-release-model.mjs','MAX_FILE_BYTES'),
 ('assets/public-release-model.mjs','reader.cancel()'),('assets/i18n.mjs',"document.documentElement.dir=locale==='fa'?'rtl':'ltr'"),
 ('research/repackaged-mod.html','data-malguard-back'),('ios-preview/index.html','data-malguard-back'),
 ('research/repackaged-mod.html','/assets/page-history.js'),('ios-preview/index.html','/assets/page-history.js')]:contains(path,text)
for path,text in [('index.html','MalGuard detects, blocks, and prevents cheats'),('ai-intelligence.html','href="https://malware-ai-gray.vercel.app">Open Malware AI'),('app.html','MalGuard-App-Preview-'),('download.html','MalGuard-App-Preview-'),('download.html','privateDownloadCode')]:absent(path,text)
release=json.loads((ROOT/'release/malguard-current-release.json').read_text())
assert release['verification']['nativeInstallChecks']==18
assert release['verification']['setupDeadlineChecks']==5
assert release['verification']['installedSyntheticFixtures']>=6
assert release['verification']['windows']['passed']>=1029
assert release['verification']['linux']['passed']>=1030
assert release['verification']['desktopUpdateBrowserChecks']==35
assert release['verification']['passwordServiceUnitChecks']==21
assert release['passwordRequired'] is False and release['deviceLicenseRequired'] is False and release['installerPasswordRequired'] is False
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
