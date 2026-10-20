# GameScam Guard site integration

GameScam Guard is a website-only scanner served at
`https://malguard.site/game-scam-guard/`. The signed Android 1.1.0 app loads this
first-party interface in a restricted WebView; UI and server fixes reach the
installed app without replacing its APK. The public APK is linked from
`https://malguard.site/gamescam-guard-android.html`.

Install dependencies at the repository root. `npm run build` builds the React
interface and copies only approved public assets to `_site`. GitHub Pages hosts
the interface; the existing `game-scam-guard-connected` Vercel project serves the
API at `/api/game-scam-guard/`. Never embed server/provider/signing secrets in
public assets.

## Inspection scope

- Website scan: guarded public DNS/connections, URLhaus, received HTML identity,
  sensitive forms, script patterns, redirects and link inventory. A clean
  observation does not verify a seller or guarantee safety.
- Advanced website scan: an isolated, JavaScript-disabled browser snapshot and,
  after explicit confirmation, a bounded queue of observed public page targets.
  A basic-to-advanced upgrade preserves the original verdict. Fresh HTML must
  match its signed SHA-256 before generating an upgrade snapshot.
- Fifteen report categories describe **coverage**, not fifteen antivirus engines.
  Unavailable or unrequested checks stay visible. Original page and broader
  linked-page verdicts are displayed separately, with reasons for a change.
- Files, downloads, uploads, file hashing and file execution are excluded. Files
  belong to GTA Guard. MalwareBazaar is not a website reputation engine.
- Email/password or email-code accounts use the existing Brevo/account store.
  Google OAuth and its routes are removed. Previously created Google accounts
  can use their email-code sign-in. No automatic email is sent by these tests.
- Browser preview remains behind its existing server opt-in and snapshot setup.
  No paid upgrade or new provider is required. Missing browser infrastructure
  reports unavailable and does not invent a screenshot or execution result.

## Verification

```sh
npm run test:game-scam-guard
npm run test:static
npm run build
TEST_BROWSER=chromium node tests/game-scam-preview.mjs
node tests/game-scam-extended-flow.mjs
node apps/gamescam-guard-android/verify-project.mjs
```

The UI tests use an owned loopback server and authored fixtures, with private
address/CORS checks against the local API. Set `PLAYWRIGHT_BROWSERS_PATH` for the
installed browser location when needed. They test responsive account/report
layouts and the complete initial-to-extended report flow, including independent
threat and coverage outcomes. No suspicious specimen may be executed in
development, tests or CI. Browser emulation does not replace physical Samsung
installation/WebView or Safari testing.

The service worker is scoped to `/game-scam-guard/` and uses network-first fetches.
It must never cache parent pages, APIs, credentials or scanned content. The pinned
legacy collector remains server-only; its source SHA-256 is
`1886250255a8d690a362b5f6aa5a343b1c65de291e0d9bea2136b245c45b951b`.
