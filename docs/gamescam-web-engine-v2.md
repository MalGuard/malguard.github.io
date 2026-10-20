# GameScam Guard: compact interface and web analysis engine 2

Prepared on 2026-10-20 on `codex/gamescam-scan-continuity`, following local
commit `5972dec`. This work is for review and later integration. It does not
publish a website/API, change production configuration, or issue a new APK.

## Result and product decisions

The initial screen now fits a phone. A completed scan shows a short verdict,
the observed hostname, completed-check count and one action for more detail.
Evidence, coverage, destinations, sources and browser images are opt-in panels,
with bounded panel scrolling. The earlier long hero, repeated side cards and
always-expanded evidence sections are removed from this application.

English is the initial language. A saved explicit Persian preference is
respected. UI copy is rendered from complete locale pairs rather than mutating
React's DOM with a translation observer. Account labels, placeholders, strength
messages, errors, verification-code forms, progress events, settings, history,
report tabs and diagnostics all have Persian counterparts. Website titles,
addresses and original evidence retain their source language in a clearly
identified section; they are not silently machine-translated.

The product uses **one web analysis engine with 20 distinct checks**, not twenty
independent commercial antivirus engines. The checked surface is public HTML,
inline script syntax and observed references. No numeric count or missing threat
report is promoted to a safety guarantee.

## What the research established

Exa searches covered four angles: Google URL protection, VirusTotal aggregation,
browser isolation and phishing/malware feeds. Twenty search results were screened
and six primary documentation pages were fetched. Findings used in the design:

| Source | Relevant conclusion |
| --- | --- |
| [Google Web Risk overview](https://docs.cloud.google.com/web-risk/docs/overview) | Reputation information is not comprehensive or error-free; risky pages can be missed and benign pages can be misclassified. Lookup sends the actual URL; the Update API has different privacy/implementation tradeoffs. |
| [Google Safe Browsing appropriate use](https://developers.google.com/safe-browsing/reference/Appropriate.Usage) | The free Safe Browsing API is for non-commercial use. Google directs commercial use to Web Risk and requires clear limitations. No Google integration was added. |
| [VirusTotal Public vs Premium API](https://docs.virustotal.com/reference/public-vs-premium-api) | Public API use has commercial and volume restrictions. Aggregated vendor opinions cannot be treated as a free, unlimited commercial scanning backend. No VirusTotal submission was made. |
| [Cloudflare browser isolation](https://developers.cloudflare.com/cloudflare-one/remote-browser-isolation/) | Isolation executes content away from the device and applies interaction/data policies; it complements other controls. A snapshot is not equivalent to interactive remote browsing. |
| [OpenPhish feeds](https://openphish.com/phishing_feeds.html) | Phishing data is a separate source with usage and update considerations. The optional feed adapter requires explicit operator enablement and review of applicable terms. |
| [URLhaus API](https://urlhaus.abuse.ch/api/) | URLhaus focuses on malware-distribution URLs and should not stand in for a phishing database. Community/commercial usage conditions must be respected. |

These sources do not support an absolute statement that arbitrary websites are
safe. The UI therefore reports observations, caution and missing evidence.

## Twenty implemented checks

1. Mixed-script and numeric URL identity.
2. Gaming-brand tokens outside the listed official host boundaries.
3. Sensitive form destinations.
4. Sensitive form methods that expose values in URLs.
5. Verification-code form boundaries.
6. Wallet recovery/private-key form requests.
7. Unencrypted payment forms.
8. Active script transport on encrypted pages.
9. Decoding inside dynamic script evaluation.
10. Credential-value reads combined with external request patterns.
11. Clipboard copy paired with shell-execution instructions.
12. Literal cross-origin script navigation.
13. HTML refresh destinations.
14. Displayed-URL versus actual-host mismatch.
15. External sign-in frame boundaries.
16. Legacy executable plugins and ActiveX objects.
17. Service-worker registration context.
18. Active inline/data/srcdoc documents.
19. Specific browser-mining references/protocol patterns.
20. External script integrity metadata.

Each check has a separate catalogue entry and an authored fixture. Common
features such as service workers, missing resource integrity metadata, numeric
hosts or gaming-risk words remain context unless stronger evidence is present.
There is no hostname-based exemption for MalGuard's own website.

Inline JavaScript is parsed with the existing lockfile's Babel parser, promoted
to an explicit production dependency. It is never evaluated. Comments, regex
literals, JSON data and inert string/template examples do not become executable
call findings. Computed member syntax and optional calls are covered by tests.
This is bounded static pattern analysis, not whole-program runtime dataflow.

The engine caps inline inspection at 256 scripts and 512 KiB, traversal at
100,000 nodes, and selected form/frame/plugin checks at 256 elements. The report
records omissions and marks affected checks incomplete. Incomplete syntax or
coverage cannot silently become a fully checked negative verdict. Submitted
pages and linked destinations use the same assessment policy. Known threat and
caution evidence remain visible even when other coverage is incomplete.

## External information and privacy

URLhaus remains supported through the existing server credentials. An optional
OpenPhish adapter retrieves only the fixed public feed and checks exact URLs
against it locally. Inspected URLs are not submitted to that feed provider.
Queries and fragments are not loosened into hostname-wide threat verdicts.
Refreshes coalesce, snapshots expire, malformed data is rejected and expired
data is not reused as a fresh negative result after an outage.
If required threat-source evidence fails, a page with no positive caution finding
remains incomplete. An explicitly disabled optional source is recorded separately.

OpenPhish is off unless `GUARD_OPENPHISH_ENABLED=true` is configured by the
operator after reviewing the provider's applicable terms. This change does not
enable it in production. Source results, failures and configuration states stay
separate in the exported report. Secrets remain server-side. Form values and
query tokens from sensitive form destinations are not copied into findings.

## Isolated browser implementation

The configured cloud path uses a disposable snapshot VM with deny-all egress,
no exposed ports and no copied host environment. The worker receives guarded
HTML and a URL, not provider credentials. It disables website JavaScript,
service workers, downloads, forms, frames and external resources. Only the
initial, already-received document is fulfilled, with restrictive CSP.

The shared renderer produces a JPEG and bounded isolation telemetry. The cloud
adapter requires the expected disabled-script/deny-all telemetry and JPEG
signature before reporting success, and always stops the VM. VM/command/browser
deadlines remain bounded. Existing explicit cloud opt-in and snapshot setup are
preserved; an unconfigured service is unavailable, never a simulated success.

A real local Chromium test uses harmless authored HTML containing marker code,
an image, frame, plugin and form targeting an owned loopback counter. It confirms
that the site script does not execute and no request reaches the counter. Mocked
SDK tests separately verify VM options, secret non-forwarding, telemetry checks
and cleanup. **No real remote VM was created or validated in this workspace.**
The product does not offer active JavaScript detonation or interactive remote
browsing. It does not inspect authenticated/private pages or file payloads.

## Built-in self-test

The new read-only `/api/game-scam-guard/self-test` endpoint exercises 20 detection
and context fixtures, 14 benign controls and four boundaries: private-IP
rejection, credential-bearing URL rejection, report-token integrity and secret
value redaction. The result is computed, cached briefly and displayed in the
application with individual results. No email, real URL scan, VM or code
execution is triggered by this diagnostic.

These 38 checks are selected functional tests, not an assessment of a physical
phone or a global detection accuracy measurement. The authored positive and
negative corpus is regression evidence; it is not an independent representative
benchmark and must not be advertised as a real-world detection percentage.

## Verification and remaining limits

```sh
npm run test:game-scam-guard
npm run test:static
npm run build
node apps/gamescam-guard-android/verify-project.mjs
TEST_BROWSER=chromium node tests/game-scam-preview.mjs
node tests/game-scam-extended-flow.mjs
node tests/game-scam-isolation.mjs
```

`TEST_CHROMIUM_EXECUTABLE` optionally chooses the installed local browser. CI
retains its pinned Playwright environment. The existing extended-flow CI entry
point now invokes the larger compact-UI suite, preserving the previous verdict,
progress and screenshot regressions while adding complete locale, account,
compact-height and self-test checks. The real isolated-renderer test also runs
in the experience workflow. Existing CI safety checks remain enabled.

Browser evidence is saved under `test-results/`. The source APK remains the
signed 1.1.0 first-party WebView application inspected in the prior change.
There was no physical Samsung/Android emulator or Safari/WebKit run. Remote CI
and deployment are not claimed for an unpublished branch. Additional licensed
feeds, runtime execution, anti-evasion research, independent corpora and ongoing
provider operations remain separate work; they cannot be replaced by extra
engine labels or an absolute guarantee.

### Recorded local results

- 135 service, integration, localization and analysis tests passed with no failures.
- The production build, 46-page static validation and Android source/project
  checks passed; the original APK SHA-256 remains unchanged.
- Both Chromium UI suites passed. They cover English/Persian account and code
  forms, history, settings, all report panels, the 38-case in-app self-test,
  streaming progress, navigation during work, explained verdict expansion,
  screenshot isolation on queue resume, PWA scope and private/CORS boundaries.
- Initial view height equals the viewport height at 320×740, 390×844,
  820×1080 and 1440×1000. Default completed reports remain within the compact
  height budget. Relevant account, report and diagnostic labels passed the
  contrast check, and mobile screenshots were visually reviewed.
- The real Chromium isolated-renderer test passed: no site script execution
  and zero requests received by the owned loopback counter. Cloud VM options,
  no host-secret forwarding, telemetry rejection and cleanup passed mock tests.
- These are local results for the prepared source. There is no remote CI,
  production deployment, physical Samsung, Safari/WebKit or remote-VM claim.
