# MalGuard AI: implementation and launch record

This change adds an independent `/ai/` page, an opt-in Node/Express API and five tool adapters. It does not change the home page, Hero, existing product pages, installer, release manifests or existing scan APIs. No model, service, paid plan, merge or deployment is activated by this change.

## Current two-mode behavior (owner clarification, 23 October)

- **Chat**: normal Persian/English conversation with bounded multi-turn context, general and technical questions, and automatic security checks when a file, SHA-256 or URL is sent. Explicit search intent also invokes real web search.
- **Automatic inspection**: files, hashes and public URLs only. Short greetings receive a small local greeting; general/technical questions are directed to Chat and never invoke a conversational model in this mode.
- URL inspection runs Game Scam Guard, URLhaus and Tavily in parallel when permission is present. File inspection first runs the existing static Worker, then sends only its computed SHA-256 to MalwareBazaar and web search. File bytes and private filenames are not sent to those providers or the language model.
- Sharing permissions are requested once, stored only as versioned booleans in browser preferences and automatically included on subsequent requests. All permissions can be revoked from the visible settings. Conversation content remains page-memory only.
- Existing provider connections are used whenever configured; repetitive per-message and artificial owner-confirmation flags are removed. `MALGUARD_AI_ENABLED=false` is an explicit emergency off switch; otherwise the server route is enabled.
- The default conversational provider is the existing Workers AI Llama fast mode. Gemini remains a separately selectable adapter; there is no OpenAI key requirement or implicit paid fallback.
- Because Vercel sensitive values cannot be exported, a dedicated `/api/malguard-assistant` gateway is added in the existing private `malware-ai` project. Existing Worker/Tavily secrets remain there. The scanner backend calls that fixed gateway server-to-server; the browser sees no provider key. Legacy administrator chat/auth/report routes remain unchanged.

The owner explicitly requested activation of these two modes. The reviewed branch commits can be deployed into the existing Vercel projects without merging GitHub main or changing the homepage/Hero. No new paid plan or resource is provisioned. Live provider verification is reported separately from synthetic tests.

## Repository inspection (22–23 October 2026)

| Source | Inspected commit | Existing capability |
| --- | --- | --- |
| `MalGuard/malguard-core` | `1b54698ceb231e7750aec3d38c6021b12dc7a2bd` | Node 20+ CommonJS desktop scanning, static parsers, threat metadata client, integrity/release tests, read-only MCP tools. No public online assistant API. |
| `MalGuard/malguard.github.io` | `9e621e2585f8a4638d64323cb474c8cd0738bbce` (refreshed from initial `0ea7fe9`) | Static Pages artifact, React/Vite Game Scam Guard, Express/Vercel API, guarded network transport, existing pinned GTA PE engine and bounded static artifact Worker. |
| Existing private assistant backend | Production commit `36b33dcefd4cd2b4d792009c079151e0ba920f48` | Vercel chat gateway to Cloudflare Worker; administrator session and access checks. Its open hardening work remains separate. No private implementation or credentials are copied into this public repository. |

Both main heads, recent commits, open/recent PRs and Actions were inspected. Pages deployment run `39834606562` succeeded at the inspected site commit. The fetched public homepage was byte-for-byte equal to the repository homepage. Existing Vercel Game Scam Guard health reports `ok` and URLhaus configured, OpenPhish disabled; health is not provider-query verification. The latest Vercel preview points at a separate design branch; it is not treated as production main.

The feature was rebased onto current main on 23 October, preserving its newer product artwork and standalone animation preview. The live homepage was fetched again and matches this current checkout byte-for-byte. Recent core scheduled clean-room jobs are failing upstream; recent unrelated artwork PR experience CI also fails. Those are pre-existing observations, not a claim that all organization CI is green.

Vercel metadata confirms existing **names**, without reading secret values:

- `malware-ai`: `GEMINI_API_KEY`, `TAVILY_API_KEY` (production). An OpenAI variable also exists but is unused by this implementation.
- `game-scam-guard-connected`: `MALWAREBAZAAR_AUTH_KEY`, `ABUSECH_AUTH_KEY`, `URLHAUS_AUTH_KEY_SOURCE`, `GUARD_REPORT_SECRET`.
- Existing assistant `GET /api/chat` reports a configured Tavily integration and `freeMode`. This is self-reported configuration, not proof of available quota, valid model access or zero billing.
- Existing Cloudflare Worker `GET /health` responds successfully and reports Workers AI, Gemini and Groq configured. It publishes the Llama mode IDs used by the optional server adapter. No inference was requested during inspection.

Secrets remain in their existing projects. Vercel environment variables are project-scoped; a variable in `malware-ai` does not automatically exist in `game-scam-guard-connected`. No secrets were copied, no Vercel settings were changed, and the protected legacy administrator chat was not bypassed. A previously embedded legacy gateway credential and its pending rotation are already tracked by the private backend hardening PR; do not reuse it in this public application.

## Initial implementation record (superseded where the current behavior above differs)

`/ai/` → `/api/malguard-ai/{status,chat}` → validation/consent/limits → deterministic orchestrator → independent adapters → existing static parser or guarded transport.

- GTA Guard reuses `analyzeArtifact` and its Worker, archive budgets and vendored GTA DLL/ASI static rules. Maximum input is 1 MiB; unsupported/partial coverage stays inconclusive. No sample execution, cloud execution, antivirus engine count or signature verification is invented. Hash-only requests cannot inspect file contents.
- Game Scam Guard reuses `scanSite` with cloud preview and threat-content execution disabled. Known threat checks run only with lookup consent. A network warning is a service error, not suspicious evidence.
- MalwareBazaar queries the fixed `get_info` metadata operation and requires an exact returned SHA-256. It cannot request or download samples.
- URLhaus reuses the existing exact-URL reputation adapter. It cannot fetch the submitted destination or retrieve payloads.
- AI Web implements Tavily basic search against its fixed API. It returns up to five source URLs and untrusted excerpts, without generated answers. Search results are information, not security findings.
- The independent Gemini adapter supports general text replies only, with an explicit model ID. Tool routing and security verdicts never depend on model-generated text. Neither file bytes nor tool/external evidence is passed to the model. OpenAI, silent provider fallbacks and paid-plan activation are absent.
- The optional Workers AI adapter targets the owner's existing fixed Worker endpoint with its runtime proxy credential and an explicitly selected Llama mode. It requests no auto routing, web grounding, Gemini or Groq fallback; unexpected provider metadata fails closed. It remains disabled until the owner confirms free quota and completes the existing gateway credential review/rotation. The legacy administrator route is not bypassed.

The four verdicts are `suspicious`, `no_evidence`, `insufficient`, `error`. Every tool result has `checkedAt`, `evidence`, `sources` with per-source times, `limitations` and allowlisted metadata. `no_evidence` means only that the completed checks did not find evidence. Search results always use `insufficient` for security conclusions. Source snippets retain their original language; interface controls and verdict labels support Persian RTL and English LTR.

Streaming consists of real NDJSON `tool_started`, `tool_finished` and one final response. It is not simulated token streaming. Gemini currently returns a bounded complete reply. History is page-memory only, with clear and refresh deletion; no localStorage, server chat store, accounts or new authentication are introduced.

## API contracts

`GET /api/malguard-ai/status`: returns `enabled`, `model`, `tools`, `history`, `streaming`, `retention`. `configured` means a credential/configuration exists, **not** that its live connection is verified. `liveVerified` remains false; it is never set from credential presence.

`POST /api/malguard-ai/chat`, JSON only, maximum 1,450,000 bytes:

```json
{
  "locale": "en",
  "tool": "auto",
  "message": "https://example.com/",
  "input": {},
  "consent": {"websiteFetch": true, "remoteLookup": false}
}
```

`tool`: `auto`, `gta_guard`, `game_scam_guard`, `ai_web`, `malwarebazaar`, `urlhaus`.

| Tool | Input (exactly one) | Required consent |
| --- | --- | --- |
| GTA Guard | `file: {name, base64}`; optional hash-only guidance via `sha256` | `fileUpload` for bytes |
| Game Scam Guard | `url` | `websiteFetch`; `remoteLookup` additionally allows threat-provider queries |
| AI Web | `query` (maximum 500 chars), or message when selected | `remoteLookup` |
| MalwareBazaar | `sha256` (64 hexadecimal chars) | `remoteLookup` |
| URLhaus | `url` | `remoteLookup` |
| General model conversation | `message`, `auto`, no detected tool input | `modelShare` |

Without explicit input, auto routing recognizes a SHA-256 token or HTTP(S) URL in the message. Files route to GTA Guard, hashes to MalwareBazaar, URLs to Game Scam Guard. Natural-language messages require an enabled model or return honest setup guidance. A model never grants consent or changes tool inputs.

JSON responses wrap `{locale, model, result}`; general replies use `message` or `generated` with `securityAnalysis: false`. `Accept: application/x-ndjson` streams `{event}` records then `{result: response}`. HTTP 400/403 validation/consent errors occur before streaming; 413 size, 415 content type, 429 quota and 503 disabled/busy states are explicit. Provider errors become `error` results with fixed reasons; upstream bodies/headers/errors are not returned.

## Security and privacy boundaries

- Existing SSRF controls reject private/mapped IPs, non-HTTP schemes, credentials, non-web ports and mixed private DNS. Page connections and redirects resolve, validate and pin destination IPs. Provider endpoints are constants; redirects are refused. DNS and body reads are bounded.
- Static file workers have an empty environment, memory/time limits and no sample execution. They inspect bytes in memory. This is not a claim of certified malware-execution isolation.
- Input JSON/schema, file encoding/size/name, response sizes and allowed routes are bounded. No arbitrary URL proxy, shell, eval, model-selected endpoint or tool exists.
- Explicit first-party CORS; no wildcard, Host-header origin reflection or credentials. Rate limiting never trusts caller forwarding headers.
- At most two concurrent tool requests per process, ten POSTs/minute per socket bucket, 60 total requests/minute, 2,000 buckets. Provider retries are zero; existing page retrieval allows one transient retry inside its budget. Tool timeout is 35 seconds; parser timeout is ten seconds.
- Logs contain a random request ID, fixed event and outcome only. No IP, message, URL, file, hash, key, raw error or prompt is logged by this service. Hosting/provider logs and retention are outside this application’s control and must be covered by the operator’s privacy policy.
- External text is rendered with `textContent`. Source URLs are HTTP(S)-validated. No external scripts, frontend credentials, dynamic HTML, analytics or remote fonts are required.

## Environment variables (names only; current revision)

| Variable | Purpose/default |
| --- | --- |
| `MALGUARD_AI_ENABLED` | Enabled unless explicitly `false`; emergency off switch. Status remains readable. |
| `MALGUARD_AI_PUBLIC_ORIGIN` | Optional exact first-party origin for protected review/testing. |
| `MALWAREBAZAAR_AUTH_KEY` | Existing server metadata credential. |
| `ABUSECH_AUTH_KEY` / `MALGUARD_ABUSECH_AUTH_KEY` | Existing abuse.ch credential/fallback. |
| `URLHAUS_AUTH_KEY_SOURCE` | Existing `malwarebazaar` setting explicitly reuses that key for URLhaus. |
| `GUARD_OPENPHISH_ENABLED` | Existing opt-in feed flag; default off. |
| `GUARD_REPORT_SECRET` | Existing Game Scam Guard report-token secret required on Vercel; retain its current setting. |
| `GEMINI_API_KEY` | Existing server Gemini key; never OpenAI. |
| `MALGUARD_AI_MODEL_PROVIDER` | Explicit `gemini` or `workers_ai`; no implicit fallback. |
| `MALGUARD_WORKER_PROXY_TOKEN` | Existing server Worker credential; never copy an embedded legacy value. |
| `MALGUARD_AI_WORKERS_MODE` | Explicit `fast`, `strong` or `fallback` Llama mode, matching current Worker health. |
| `MALGUARD_AI_WORKERS_FREE_CONFIRMED` | Obsolete: no repeated activation flag. |
| `MALGUARD_AI_WORKERS_REVIEWED` | Obsolete: new gateway uses the existing runtime credential directly and does not copy the embedded legacy value. |
| `MALGUARD_AI_GEMINI_MODEL` | Exact authorized model ID; no guessed default or fallback. |
| `MALGUARD_AI_GEMINI_FREE_CONFIRMED` | Obsolete: current owner-authorized reuse does not require this flag. |
| `TAVILY_API_KEY` | Existing server search key. |
| `MALGUARD_AI_TAVILY_FREE_CONFIRMED` | Obsolete: existing Tavily connection is used when configured. |

Confirmation flags express operator approval; they cannot establish or enforce provider billing. Keep them off unless the provider account itself prevents paid overage. No live billable request was made during this work.

Local development without provider credentials:

```sh
npm ci --ignore-scripts --cache /tmp/malguard-npm-cache
MALGUARD_AI_ENABLED=true npm run start:ai
# http://127.0.0.1:8787/ai/
npm run test:ai
npm run check:ai
TEST_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:ai:browser
npm run test:game-scam-guard
npm run build
```

## Release gates — no deployment performed

1. Review the PR, test results and screenshots. The feature branch explicitly disables automatic Vercel deployment in `vercel.json`; Pages deploys main only.
2. Select the existing backend project. The UI currently follows the existing Game Scam Guard canonical API host. Keep existing threat keys there. Reuse Gemini/Tavily on the same authorized server project or have the owner configure appropriate server-scoped secrets; never expose/copy values through chat or commit them. Changing the canonical backend requires updating `ai/client.mjs`, CORS and CSP together.
3. Before any public enablement, configure edge-wide rate/concurrency quotas and hard provider-side spending limits. In-memory quotas are per instance, conservative behind shared proxies and reset on cold starts; they are insufficient for a public distributed service. No new datastore or paid resource is provisioned here.
4. Verify authenticated provider access, exact model availability, free quota/billing, production host logs/retention, malformed responses, failures and same-origin/CORS behavior on an owner-approved protected deployment. Existing legacy chat session protection must remain intact. Do not merge private backend hardening or enable cloud execution as part of this release.
5. Obtain owner approval for merge and deployment separately. After approved deployment, verify `/ai/`, API status, benign file/hash/URL checks, all four verdict states, phone/tablet/desktop, unchanged homepage/Hero and downloads. Keep `MALGUARD_AI_ENABLED` off until those checks and external gates are satisfied. Roll back by setting it off; the homepage and old APIs remain independent.

Remaining limitations: no verified live model/Tavily/MalwareBazaar/URLhaus request from the new code; no access to production secret values; no deployment or public end-to-end claim; no persistent chat/auth; no model token stream; no corpus accuracy claim; no Windows x64/ARM64 build or download change. Full existing core tests are unnecessary for unchanged core source and were not run. The project is JavaScript; TypeScript and ESLint are not configured. Syntax/static safety checks and runtime tests are supplied rather than claiming a nonexistent typecheck/lint pass.
