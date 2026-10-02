"""Confirm Pages serves the exact reviewed production documents and assets."""
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError
from hashlib import sha256
import os, time
root = Path(__file__).resolve().parents[1]
base = "https://malguard.github.io/"
paths = ["index.html", "products.html", "tools.html", "gta-guard.html", "assets/experience.css", "assets/experience.js", "assets/brand-motion.css", "assets/brand-motion.js", "assets/malguard-core-mark.svg", "assets/product-gta-guard.svg", "assets/product-malware-ai.svg", "assets/product-game-scam-guard.svg", "assets/evidence-guard.svg", "assets/evidence-ai.svg", "assets/evidence-link.svg", "assets/fonts/manrope.ttf", "assets/fonts/space-grotesk.ttf"]
revision = os.environ["GITHUB_SHA"]
for path in paths:
    expected = sha256((root / path).read_bytes()).hexdigest()
    url = base + ("" if path == "index.html" else path) + "?verified=" + revision
    deadline = time.monotonic() + 45
    while True:
        try:
            request = Request(url, headers={"Cache-Control": "no-cache", "User-Agent": "MalGuard-Pages-Verification"})
            with urlopen(request, timeout=15) as response:
                actual = sha256(response.read()).hexdigest()
            if actual == expected:
                print("PASS published", path)
                break
            error = "Content differs from reviewed checkout"
        except (URLError, TimeoutError) as exc:
            error = str(exc)
        if time.monotonic() >= deadline:
            raise SystemExit("Published verification failed for " + path + ": " + error)
        time.sleep(3)
print("PASS: published homepage, key public pages, scripts, typography and sculptures match the reviewed commit")
