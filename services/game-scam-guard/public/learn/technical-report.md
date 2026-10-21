# GameScam Guard: reproducible evidence for a bounded website inspection engine

Technical report, version 1. This is an author-produced engineering report, not a peer-reviewed paper or an independent product certification.

## Abstract

GameScam Guard combines public-page retrieval, twenty static HTML checks, URL reputation observations and optional isolated visual snapshots. Its purpose is to make evidence and coverage visible before a visitor interacts with a gaming website. This report describes an executable regression evaluation and the controls surrounding collection. It separates selected-fixture observations from claims about arbitrary websites.

## System and threat scope

The engine reads public HTTP/HTTPS pages through a guarded transport that validates resolved IP addresses, restricts web ports, pins connections and validates TLS certificates. It does not sign in, pay, retrieve direct file bodies or execute page JavaScript. The script analyzer parses syntax without evaluating it. Resource and syntax budgets become explicit incomplete coverage.

The twenty rule categories and their English/Persian descriptions are maintained in `services/game-scam-guard/shared/analyzer-catalog.js`. They cover identity, deceptive brand domains, sensitive form destinations and methods, verification codes, wallet recovery requests, payment transport, insecure script references, encoded evaluation syntax, credential/network patterns, clipboard command traps, script navigation, HTML redirects, visible-link mismatch, frames, plugins, service workers, embedded documents, mining references and resource integrity.

URLhaus observations concern known malware-related URLs. An optional OpenPhish feed provides separately configured exact-URL phishing observations. These sources have different coverage and usage terms. Negative, unavailable and unconfigured states remain distinct. The engine checks the initial, intermediate and final addresses of a completed guarded HTTP chain, at most four redirects/five distinct addresses. It retains a known intermediate threat even when both endpoints have no known report.

## Evaluation method

Run `node tools/evaluate-gamescam.mjs` from the repository root after installing the lockfile dependencies. This creates `docs/gamescam-evaluation.json` with individual case results, input SHA-256 hashes, source-file SHA-256 hashes and timing observations. Every input is harmless authored HTML. No third-party threat specimen is downloaded or executed.

The dataset contains twenty selected expected-rule/context observations and fourteen benign controls, drawn from the existing regression fixtures. An expected observation passes when its specified rule appears. A benign control passes when it produces no warning or danger finding. Informational context is permitted in a benign control. The cases were chosen by the authors and overlap the unit tests; they are not an independent holdout.

Read the accompanying generated JSON for the actual counts and parser timing from the current run. Counts describe these exact cases. Parser timing excludes retrieval, intelligence, isolated rendering and physical-device overhead. No aggregate real-world detection percentage is inferred.

## Continuity and failure handling

The submitted page and each linked destination use the same assessment policy. Linked-page work preserves the original assessment and explains newly observed threat evidence, warnings or incomplete coverage. Required source failure does not become a negative threat report. Partial syntax analysis does not count as fully inspected. URL fragments are removed before exact reputation matching; query strings remain significant.

The linked-page queue admits at most 128 observed public page destinations and excludes direct downloads. It retains bounded progress in authenticated, expiring report capabilities. The implementation has 2 MiB per-linked-page and 96 MiB aggregate receive budgets. Queue/history tests cover malformed data, assessment parity, resumed progress and screenshot association.

## Isolation evidence

`tests/game-scam-isolation.mjs` launches real local Chromium with harmless authored HTML. It checks that a marker script never runs and that image, iframe, plugin, form and script requests do not reach an owned loopback counter. This verifies the local renderer boundary. It does not verify a production VM image, an active JavaScript sandbox, physical Android behavior or a remote service's configuration.

## Reproduction commands

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run test:game-scam-guard
node tools/evaluate-gamescam.mjs
npm run build
TEST_CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/game-scam-extended-flow.mjs
TEST_CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/game-scam-isolation.mjs
node apps/gamescam-guard-android/verify-project.mjs
```

Use the installed Playwright browser instead of the system executable when appropriate. The test host must permit owned loopback HTTP listeners. Production credentials and real malware are unnecessary. A network-restricted package registry can prevent installation; it must not be worked around by disabling integrity verification.

## Limits and further evaluation

Representative accuracy requires a separately maintained, independently labeled dataset collected over time, with train/test separation and disclosure of missed threats, false positives, source freshness, geography and availability. Dynamic pages, gated content, browser fingerprinting, delayed behavior, obfuscated external scripts and new threats may not be observable in received HTML. A safe-looking snapshot cannot establish future safety. Paid-source availability, source licensing and physical Samsung tests require their own evidence.

## Primary references

1. URLhaus, API and scope: https://urlhaus.abuse.ch/api/
2. OpenPhish, feed options: https://openphish.com/phishing_feeds.html
3. Cloudflare, remote browser isolation: https://developers.cloudflare.com/cloudflare-one/remote-browser-isolation/

These sources describe the referenced technologies. They do not endorse or certify GameScam Guard.

## خلاصهٔ فارسی

این گزارش فنی، روش بررسی و آزمون قابل بازتولیدِ موتور را مستند می‌کند. دادهٔ ارزیابی، بیست نمونهٔ منتخب برای مشاهدهٔ قاعده و چهارده نمونهٔ بی‌خطر است. نتیجهٔ واقعی هر اجرا، هش ورودی‌ها و هش فایل‌های منبع در فایل همراه ثبت می‌شود. نمونه‌ها مستقل یا نمایندهٔ همهٔ تهدیدهای جهان نیستند؛ بنابراین نتیجهٔ آن‌ها، درصد تشخیص عمومی یا تضمین امنیت محسوب نمی‌شود. فیلم‌های آموزشی از رابط واقعی با محتوای بی‌خطر و پاسخ ساختگی منابع ضبط می‌شوند و نقش آموزش دارند. بررسی مرورگر محلی، بررسی سامسونگ واقعی و آزمون ماشین ایزولهٔ تولید، شواهد جداگانه می‌خواهند.


## Reproducing the narrated tutorials

The English and Persian walkthroughs contain locally generated neural narration from Piper 1.8.0. The synthesis and recording tools are `tools/generate-gamescam-narration.py` and `tools/record-gamescam-guide.mjs`; the scripts, immutable model revision and checksums are in `tools/gamescam-narration.json`. No paid speech API or browser speech-synthesis feature is required. Each language has nine measured speech chapters. The training frames use harmless authored pages and simulated URL reports.

English voice: `en_US-ljspeech-high`, trained from the public-domain LJ Speech dataset. Persian voice: `fa_IR-amir-medium`, whose model card identifies the dataset as CC0. The immutable model repository revision is `5041a7a49ae5b3a0f30e6837769eb03fdbb231bd`:

- English model card: https://huggingface.co/rhasspy/piper-voices/blob/5041a7a49ae5b3a0f30e6837769eb03fdbb231bd/en/en_US/ljspeech/high/MODEL_CARD
- Persian model card: https://huggingface.co/rhasspy/piper-voices/blob/5041a7a49ae5b3a0f30e6837769eb03fdbb231bd/fa/fa_IR/amir/medium/MODEL_CARD
- Piper software and GPL-3.0-or-later license: https://github.com/OHF-Voice/piper1-gpl
- LJ Speech dataset: https://keithito.com/LJ-Speech-Dataset/

The published `training-manifest.json` records source audio/model hashes, per-chapter timing, pointer targets and title-frame comparisons. Video is captured at 25 fps with eased pointer motion and visible click rings. MP4 uses H.264/AAC; WebM uses VP9/Opus. A recorded synchronization marker is removed from the final film. Encoded chapter titles are checked against their rendered text masks; browser tests check decoded audio signals, playback, range requests, both language switches, four viewport sizes and separate offline guide/app documents. These are media and interface checks, not evidence of general threat-detection accuracy or a human listening evaluation.
