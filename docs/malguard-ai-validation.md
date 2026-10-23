# MalGuard AI validation — 23 October 2026

Base: `9e621e2585f8a4638d64323cb474c8cd0738bbce`, branch `feature/malguard-ai-evidence-first`.

## Executed checks

| Check | Observed result |
| --- | --- |
| `npm run test:ai` | 31 tests passed, zero failed: contracts, SSRF, consent, real static Worker, exact hashes, provider error handling, search/model fixtures, narrow CORS, limits, concurrency, redacted logs, streaming client. |
| `npm run test:game-scam-guard` | 142 existing tests passed across 15 programs, zero failed. |
| `node --test services/game-scam-guard/server/artifact-engine.test.js` | 10 existing artifact tests passed, zero failed: inert archive/script/PE fixtures only. |
| `npm run check:ai` | JavaScript syntax/static checks passed. No eval, dynamic HTML, browser secrets or persistent browser history in the AI client. |
| `TEST_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:ai:browser` | Actual browser → Express → static Worker flow passed at 360, 390, 768 and 1280 px, both directions, consent required before upload, localized verdicts, no horizontal overflow, no external network calls, clear/reload privacy; backend failure visibly disables submission. |
| Existing `tests/opaque-menu-static-gta.mjs` with local HTTPS/Chromium | Homepage and GTA page menu/demo regressions passed at 390 and 1280 px. |
| `npm run build` | React/Vite build and public artifact validation passed. Existing build warning: `./fonts/vazirmatn.css` remains a runtime path; this change does not introduce it. |
| `python3 tests/validate-trust.py` | 44 trust checks and full 48-document existing release/HTML validation passed. |
| Final public artifact boundary | Four AI client files and the existing standalone animation page present; API/server/test/env sources absent. |
| `git diff --check` | Passed. |
| Unchanged source boundaries | No feature diff in homepage, Hero assets, product pages, releases, download gates or core repository. |
| Safe provider-pattern scan | No recognized OpenAI/Google/Tavily secret patterns in the new source. This is not an exhaustive secret-detector claim. |

Total: **183 Node tests passed** (31 new + 142 existing + 10 artifact tests), plus browser scenarios above. No real malware was downloaded, stored, generated or executed. Model/search/threat response tests use explicitly injected synthetic fixtures and are not presented as live-provider success.

## Read-only live observations

- GitHub and Vercel repository/project/variable metadata inspected without retrieving secret values.
- Current production homepage fetched and matches current main source byte-for-byte.
- Existing Game Scam Guard health: `ok`, URLhaus configured, OpenPhish disabled.
- Existing assistant status: Tavily configured, free mode reported.
- Existing Cloudflare Worker health: Workers AI, Gemini and Groq configured, published Llama mode IDs observed.

These are configuration/health observations only. No live inference or authenticated new-adapter threat/search query was performed; no provider billing claim is made. No secret was copied between projects. An existing private gateway credential/hardening blocker remains tracked by its private PR.

## Not tested / release limits

No deployment, production new-API verification, authenticated live provider round trip, distributed edge quota validation, Windows x64/ARM64 build or new download verification. No WebKit/iOS engine run in this task. TypeScript typecheck and ESLint are not configured in this JavaScript repository; no pass is claimed. The added CI checks must still run on GitHub. Merge and deployment require owner approval; the feature branch disables automatic Vercel deployment and the service defaults off.

## File inventory

New and modified paths for this feature (generated from the working tree):

- `.github/workflows/site-validation.yml`
- `.github/workflows/static.yml`
- `.gitignore`
- `ai/app.js`
- `ai/client.mjs`
- `ai/index.html`
- `ai/style.css`
- `api/malguard-ai.js`
- `docs/malguard-ai-validation.md`
- `docs/malguard-ai.md`
- `package.json`
- `services/game-scam-guard/server/scanner.js`
- `services/malguard-ai/package.json`
- `services/malguard-ai/server/adapters/ai-web.js`
- `services/malguard-ai/server/adapters/game-scam-guard.js`
- `services/malguard-ai/server/adapters/gta-guard.js`
- `services/malguard-ai/server/adapters/malwarebazaar.js`
- `services/malguard-ai/server/adapters/urlhaus.js`
- `services/malguard-ai/server/app.js`
- `services/malguard-ai/server/contracts.js`
- `services/malguard-ai/server/index.js`
- `services/malguard-ai/server/model.js`
- `services/malguard-ai/server/orchestrator.js`
- `services/malguard-ai/server/workers-model.js`
- `services/malguard-ai/test/client.test.js`
- `services/malguard-ai/test/security.test.js`
- `services/malguard-ai/test/workers-model.test.js`
- `tests/malguard-ai-browser.mjs`
- `tools/build-public-site.py`
- `tools/check-malguard-ai.mjs`
- `vercel.json`
