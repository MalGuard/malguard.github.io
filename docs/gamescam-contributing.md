# Contributing to GameScam Guard

The website app is in `services/game-scam-guard/`. The Android WebView wrapper is in `apps/gamescam-guard-android/`. The public website is built into `_site`; server and test sources must not be copied there.

For a detection contribution, describe the behavior you expect to observe, add a harmless authored positive case and a benign counterexample, preserve structured English/Persian finding text, and explain the observation's limits. Do not rename duplicate checks as independent antivirus engines. Keep budgets and unavailable coverage explicit.

Useful review targets include: better independent evaluation datasets; false-positive analysis; bounded static parsing; new separately identified reputation sources; complete localization; accessibility; physical Android compatibility; and measured isolation boundaries. A provider integration needs its actual usage rights, failure states and URL-sharing behavior documented.

Reproduce the current evaluation with `node tools/evaluate-gamescam.mjs`. Use `npm run test:game-scam-guard` and `npm run build` before submitting a change. Browser flows are in `tests/game-scam-compact.mjs`, `tests/game-scam-preview.mjs` and `tests/game-scam-isolation.mjs`. The technical paper lists the complete commands.

For UI changes, check at 320, 390, 820 and 1440 px and in both languages. Keep the scan progress discoverable while navigating, the initial assessment visible after expansion, and the default result compact. Page titles and URLs are original evidence and retain their source language.

Do not download, generate or execute real malware for this project's tests. Use inert HTML, mocks and synthetic observations. Do not submit private links or sensitive query strings to outside sources. Never commit credentials, local auth state or production browser traces. Report a security issue through the repository's published security contact rather than a public exploit-bearing issue.

The training recorder is `tools/record-gamescam-guide.mjs`. It needs Playwright (including its FFmpeg browser dependency), Chromium, and system FFmpeg/FFprobe with H.264, AAC, VP9 and Opus support. Set `TEST_CHROMIUM_EXECUTABLE` only when using a separately installed local browser; leave it unset for the Playwright browser in CI. Its transport and reputation responses are authored fixtures, and the output visibly says so. Recording a tutorial does not certify detection performance.

The reviewed English and Persian narration scripts and stock voice selections are in `tools/gamescam-narration.json`. Generate one complete narration per language, retain the provider's timing alignment, and review pronunciation before release. Do not substitute browser speech synthesis or describe a silent recording as narrated.

For a visual rehearsal, run `node tools/record-gamescam-guide.mjs --visual-preview`. This produces a visibly labelled **silent preview** in `test-results/narrated-training/`. The pointer moves with an 850 ms easing curve, clicks have a visible ring, and the actual browser is recorded at 25 fps. Both language flows must finish their UI assertions. `GSG_TRAINING_OUTPUT` can select another review directory; recording directly into the published `public/learn/` directory is rejected.

For the final recording, set `GSG_NARRATION_MANIFEST` to a local JSON file with `en` and `fa` entries. Each entry contains `language`, `file` (relative to the manifest), `transcript` (the nine script paragraphs joined by two newlines), and nine `chapters: [{start, end}]` in seconds. Use the returned speech alignment to split the entire audio at paragraph boundaries, starting at zero and ending at the measured clip duration, with no gaps or overlaps. For example, an entry begins `{"language":"en","file":"english.mp3","transcript":"…","chapters":[{"start":0,"end":8.4},…]}`. Timing values in that example are illustrative; use the actual recording's alignment.

The recorder leaves room for each spoken chapter and each real interaction, inserts a short lead-in and any required pauses, and normalizes the assembled audio to -16 LUFS with a -1.5 dB true-peak target. It produces H.264/AAC MP4, VP9/Opus WebM, captions and `training-manifest.json` in the review directory. Inspect the complete audio, synchronization and pointer visibility in **both** languages before copying all seven generated public files together into `services/game-scam-guard/public/learn/` (two MP4, two WebM, two VTT, and the manifest). Do not copy intermediate WAV files or the raw recording directory.

The guide builder enables the narrated description and the cache-busting media URLs only when a final bilingual manifest is present. It rejects preview and synthetic-test manifests. The language links beside the player open the corresponding localized guide at the player, stop the previous document's media through navigation, and persist that language for the return to the app. Run `TEST_CHROMIUM_EXECUTABLE=/path/to/local/chromium node tests/game-scam-learning.mjs` locally after `npm run build`, or omit the environment override in CI.

When opening a PR, include the concrete trigger, before/after behavior, evidence retained, coverage failures, commands run and results. Detection claims need the dataset, methodology, per-case results and a clear distinction between regression data and independent evaluation.
