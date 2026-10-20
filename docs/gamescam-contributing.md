# Contributing to GameScam Guard

The website app is in `services/game-scam-guard/`. The Android WebView wrapper is in `apps/gamescam-guard-android/`. The public website is built into `_site`; server and test sources must not be copied there.

For a detection contribution, describe the behavior you expect to observe, add a harmless authored positive case and a benign counterexample, preserve structured English/Persian finding text, and explain the observation's limits. Do not rename duplicate checks as independent antivirus engines. Keep budgets and unavailable coverage explicit.

Useful review targets include: better independent evaluation datasets; false-positive analysis; bounded static parsing; new separately identified reputation sources; complete localization; accessibility; physical Android compatibility; and measured isolation boundaries. A provider integration needs its actual usage rights, failure states and URL-sharing behavior documented.

Reproduce the current evaluation with `node tools/evaluate-gamescam.mjs`. Use `npm run test:game-scam-guard` and `npm run build` before submitting a change. Browser flows are in `tests/game-scam-compact.mjs`, `tests/game-scam-preview.mjs` and `tests/game-scam-isolation.mjs`. The technical paper lists the complete commands.

For UI changes, check at 320, 390, 820 and 1440 px and in both languages. Keep the scan progress discoverable while navigating, the initial assessment visible after expansion, and the default result compact. Page titles and URLs are original evidence and retain their source language.

Do not download, generate or execute real malware for this project's tests. Use inert HTML, mocks and synthetic observations. Do not submit private links or sensitive query strings to outside sources. Never commit credentials, local auth state or production browser traces. Report a security issue through the repository's published security contact rather than a public exploit-bearing issue.

The training recorder is `tools/record-gamescam-guide.mjs`. It needs Playwright, a local Chromium executable and FFmpeg with H.264 support. Its transport and reputation responses are authored fixtures, and the output visibly says so. Recording a tutorial does not certify detection performance.

When opening a PR, include the concrete trigger, before/after behavior, evidence retained, coverage failures, commands run and results. Detection claims need the dataset, methodology, per-case results and a clear distinction between regression data and independent evaluation.
