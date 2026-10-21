# Contributing to GameScam Guard

The website app is in `services/game-scam-guard/`. The Android WebView wrapper is in `apps/gamescam-guard-android/`. The public website is built into `_site`; server and test sources must not be copied there.

For a detection contribution, describe the behavior you expect to observe, add a harmless authored positive case and a benign counterexample, preserve structured English/Persian finding text, and explain the observation's limits. Do not rename duplicate checks as independent antivirus engines. Keep budgets and unavailable coverage explicit.

Useful review targets include: better independent evaluation datasets; false-positive analysis; bounded static parsing; new separately identified reputation sources; complete localization; accessibility; physical Android compatibility; and measured isolation boundaries. A provider integration needs its actual usage rights, failure states and URL-sharing behavior documented.

Reproduce the current evaluation with `node tools/evaluate-gamescam.mjs`. Use `npm run test:game-scam-guard` and `npm run build` before submitting a change. Browser flows are in `tests/game-scam-compact.mjs`, `tests/game-scam-preview.mjs` and `tests/game-scam-isolation.mjs`. The technical paper lists the complete commands.

For UI changes, check at 320, 390, 820 and 1440 px and in both languages. Keep the scan progress discoverable while navigating, the initial assessment visible after expansion, and the default result compact. Page titles and URLs are original evidence and retain their source language.

Do not download, generate or execute real malware for this project's tests. Use inert HTML, mocks and synthetic observations. Do not submit private links or sensitive query strings to outside sources. Never commit credentials, local auth state or production browser traces. Report a security issue through the repository's published security contact rather than a public exploit-bearing issue.

The training recorder is `tools/record-gamescam-guide.mjs`. It needs Playwright (including its FFmpeg browser dependency), Chromium, and system FFmpeg/FFprobe with H.264, AAC, VP9 and Opus support. Set `TEST_CHROMIUM_EXECUTABLE` only when using a separately installed local browser; leave it unset for the Playwright browser in CI. Its transport and reputation responses are authored fixtures, and the output visibly says so. Recording a tutorial does not certify detection performance.

The English and Persian narration scripts and pinned neural voice sources are in `tools/gamescam-narration.json`. The optional authoring tool uses Piper 1.8.0 locally; it needs no API key, paid account or per-video generation credits. English uses LJ Speech (public-domain dataset), and Persian uses Amir (CC0 dataset according to its pinned model card). The model/configuration/card hashes are verified before loading. Models and the Python environment stay outside the public website.

```sh
python3 -m venv /tmp/gamescam-voice-env
/tmp/gamescam-voice-env/bin/pip install -r tools/requirements-gamescam-voice.txt
/tmp/gamescam-voice-env/bin/python tools/generate-gamescam-narration.py --models /tmp/gamescam-voices --output /tmp/gamescam-narration --download-models --download-only
/tmp/gamescam-voice-env/bin/python tools/generate-gamescam-narration.py --models /tmp/gamescam-voices --output /tmp/gamescam-narration
GSG_NARRATION_MANIFEST=/tmp/gamescam-narration/narration-manifest.json node tools/record-gamescam-guide.mjs
```

Only the explicit download step needs network access for the voice files. Synthesis generates nine measured WAV chapters per language and an exact sample-based timing manifest. Review pronunciation before release; a transcript or successful mux is not a human listening test. Do not substitute browser speech synthesis or describe a silent recording as narrated. Piper's software license is GPL-3.0-or-later; the website distributes the rendered training audio, not the synthesis runtime or voice weights. Source model cards and dataset licenses are linked in the technical report.

For a visual rehearsal, run `node tools/record-gamescam-guide.mjs --visual-preview`. This produces a visibly labelled **silent preview** in `test-results/narrated-training/`. The pointer moves with an 850 ms easing curve, clicks have a visible ring, and the actual browser is recorded at 25 fps. Both language flows must finish their UI assertions. `GSG_TRAINING_OUTPUT` can select another review directory; recording directly into the published `public/learn/` directory is rejected.

For the final recording, set `GSG_NARRATION_MANIFEST` to a local JSON file with `en` and `fa` entries. Each entry contains `language`, `file` (relative to the manifest), `transcript` (the nine script paragraphs joined by two newlines), and nine `chapters: [{start, end}]` in seconds. The local generator writes these boundaries from the actual WAV sample counts. For externally supplied narration, use its measured alignment to split the entire audio at paragraph boundaries, starting at zero and ending at the measured clip duration, with no gaps or overlaps. For example, an entry begins `{"language":"en","file":"english.mp3","transcript":"…","chapters":[{"start":0,"end":8.4},…]}`. Timing values in that example are illustrative; use the actual recording's alignment.

The recorder leaves room for each spoken chapter and each real interaction, inserts a short lead-in and any required pauses, and normalizes the assembled audio to -16 LUFS with a -1.5 dB true-peak target. An explicit green synchronization frame is recorded and removed before the exported film starts; page loading and browser startup are excluded from the narration clock. Full-viewport reference screenshots are cropped only after recording; taking clipped screenshots during a screencast can disturb its frame size. Each chapter's rendered title mask is compared with a decoded frame near the end of that chapter using SSIM, so a clock offset that advances the captions fails the recording. Reference images stay in the private raw-recording directory.

The recorder produces H.264/AAC MP4, VP9/Opus WebM, captions and `training-manifest.json` in the review directory. Inspect the complete audio, synchronization and pointer visibility in **both** languages before copying all seven generated public files together into `services/game-scam-guard/public/learn/` (two MP4, two WebM, two VTT, and the manifest). Do not copy intermediate WAV files or the raw recording directory.

The guide builder enables the narrated description and the cache-busting media URLs only when a final bilingual manifest is present. It rejects preview and synthetic-test manifests. The language links beside the player open the corresponding localized guide at the player, stop the previous document's media through navigation, and persist that language for the return to the app. Run `TEST_CHROMIUM_EXECUTABLE=/path/to/local/chromium node tests/game-scam-learning.mjs` locally after `npm run build`, or omit the environment override in CI.

When opening a PR, include the concrete trigger, before/after behavior, evidence retained, coverage failures, commands run and results. Detection claims need the dataset, methodology, per-case results and a clear distinction between regression data and independent evaluation.
