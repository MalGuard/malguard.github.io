# GameScam Guard assurance record

This document maps implementation controls to reproducible evidence. It is not an ISO certificate, a penetration-test attestation, peer review or a guarantee of universal threat detection.

| Control | Implementation | Reproducible evidence |
| --- | --- | --- |
| Public network boundary | URL normalization, public-IP resolution, pinned connections, redirect validation, TLS verification | `server/network.js`, scanner and app private-address tests |
| Bounded HTML analysis | Received HTML only; script syntax parsed without evaluation; byte, node and element budgets; omissions visible | `server/site-analysis.test.js`, `server/deep-analysis.test.js` |
| Credential privacy | Form values excluded from evidence; sensitive endpoint parameters redacted in findings | Synthetic redaction check in `server/self-test.js`; form-analysis fixtures |
| Reputation provenance | Source statuses and per-address observations retained, with optional-source configuration distinct from failure | `server/redirect-intel.test.js`, `server/phishing-feed.test.js` |
| Failure semantics | Missing required evidence remains incomplete; a source report is not discarded by a benign final page | Root/linked parity and intermediate-URL failure tests |
| Isolated visual snapshot | Scripts, service workers, downloads and outbound requests disabled; strict telemetry allowlist | `server/cloud-browser.test.js`, `tests/game-scam-isolation.mjs` |
| Report continuity | Original assessment preserved when scope expands; expiring authenticated report capabilities; malformed history rejected | `server/scan-jobs.test.js`, `server/report-token.test.js`, `src/history.test.js` |
| User-facing disclosure | Distinct negative, caution, reported-threat and incomplete states; actual source configuration visible | `tests/game-scam-compact.mjs`, `tests/game-scam-preview.mjs` |
| Accessible bilingual guidance | English default, Persian controls, responsive guide, videos, transcript and report downloads | `tests/game-scam-learning.mjs` at 320/390/820/1440 px |
| Selected-fixture evaluation | Authored inputs, source/input SHA-256 hashes, per-case observations and bounded parser timing | `node tools/evaluate-gamescam.mjs`, `docs/gamescam-evaluation.json` |

The implementation follows the defensive principles of restricting server-side requests, validating every redirect connection, keeping sensitive data out of logs and treating external telemetry as untrusted. These controls can be reviewed against the [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html). This reference is guidance, not an OWASP endorsement of this application.

Release verification must identify the actual Git commit, PR checks and deployed source revision. A successful build alone is not evidence of a healthy runtime. The live service's health and synthetic self-test must be checked separately from the browser UI and media assets. Production credentials are not part of test artifacts.

Remaining independent evidence includes physical Samsung testing, operation of any enabled remote VM image, representative independently labeled threat evaluation, and external review of the published code. Optional sources require an operator's usage-rights review and explicit configuration. The selected fixture results and training videos do not substitute for those activities.

## خلاصهٔ فارسی

این سند برای هر کنترل، محل پیاده‌سازی و راه آزمون را مشخص می‌کند. مرز شبکهٔ عمومی، سقف پردازش، حذف دادهٔ حساس، حفظ پاسخ منابع، ناقص‌ماندن صادقانهٔ بررسی، تصویر ایزوله، یکپارچگی گزارش و راهنمای دوزبانه، شواهد جداگانه دارند. گواهی استاندارد، داوری علمی و دقت تشخیصِ مستقل، با اجرای تست داخلی ایجاد نمی‌شوند و باید با ارزیابی مربوط به خودشان اثبات شوند. پیش از اعلام انتشار، شناسهٔ منبع، نتیجهٔ تست و وضعیت واقعی سرویس و رابط باید با هم تطبیق داده شوند.
