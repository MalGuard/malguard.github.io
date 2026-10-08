"""Confirm Pages serves the exact reviewed production documents and assets."""
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError
from hashlib import sha256
import os, time
root = Path(__file__).resolve().parents[1]
base = "https://malguard.github.io/"
paths = ["index.html", "products.html", "tools.html", "gta-guard.html", "assets/experience.css", "assets/experience.js", "assets/brand-motion.css", "assets/brand-motion.js", "assets/malguard-core-mark.svg", "assets/product-gta-guard.svg", "assets/product-malware-ai.svg", "assets/product-game-scam-guard.svg", "assets/evidence-guard.svg", "assets/evidence-ai.svg", "assets/evidence-link.svg", "assets/fonts/manrope.ttf", "assets/fonts/space-grotesk.ttf"]
paths += ["download.html", "assets/public-release.css", "assets/public-release.mjs", "assets/i18n.mjs", "assets/i18n-catalog.mjs", "assets/public-release-model.mjs", "release/malguard-current-release.json", "release/malguard-release-history.json"]
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
