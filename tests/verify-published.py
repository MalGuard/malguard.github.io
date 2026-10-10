"""Confirm Pages serves the exact reviewed production documents and assets."""
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError
from hashlib import sha256
import os, time
root = Path(__file__).resolve().parents[1]
base = "https://malguard.github.io/"
import json
paths=[r['path'] for r in json.loads((root/'tests/unified-source-inventory.json').read_text())['routes']]
paths += ['assets/malguard-unified.css','assets/malguard-unified.js','assets/contextual-header.js','assets/site-entry.js','assets/i18n.mjs','assets/public-release.mjs','assets/public-release-model.mjs','release/malguard-current-release.json','release/malguard-release-history.json']
paths += [str(p.relative_to(root)) for p in (root/'assets/fusion').rglob('*') if p.is_file()]
revision = os.environ["GITHUB_SHA"]
for path in paths:
    expected = sha256((root / path).read_bytes()).hexdigest()
    url = base + ("" if path == "index.html" else path) + "?verified=" + revision
    deadline = time.monotonic() + 45
    while True:
        try:
            request = Request(url, headers={"Cache-Control": "no-cache", "User-Agent": "MalGuard-Pages-Verification"})
            with urlopen(request, timeout=15) as response:
                digest = sha256()
                received = 0
                for chunk in iter(lambda: response.read(1024 * 1024), b''):
                    received += len(chunk)
                    if received > (root / path).stat().st_size:
                        raise ValueError('Published file exceeds reviewed size')
                    digest.update(chunk)
                actual = digest.hexdigest()
            if actual == expected and received == (root / path).stat().st_size:
                print("PASS published", path)
                break
            error = "Content differs from reviewed checkout"
        except (URLError, TimeoutError, ValueError) as exc:
            error = str(exc)
        if time.monotonic() >= deadline:
            raise SystemExit("Published verification failed for " + path + ": " + error)
        time.sleep(3)
print("PASS: published pages, scripts, visuals and the current password-only release metadata match the reviewed commit")
