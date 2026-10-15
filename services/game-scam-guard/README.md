# GameScam Guard site integration

The reviewed Persian web scanner lives here and is built with the parent site's
`npm run build`. Install dependencies from the repository root with `npm ci`.

- Public entry: `https://malguard.site/game-scam-guard.html`.
- Stable web preview: `https://game-scam-guard-connected.vercel.app/game-scam-guard/`.
- Same-origin Vercel API namespace: `/api/game-scam-guard/`.
- Existing MalGuard HTML, administrator authentication and Windows download
  workflows are preserved. The Windows client is not released by this change.

GitHub Pages hosts the public entry only. It cannot run Node functions; the
entry opens the existing Vercel project. Its unchanged `all_except_custom_domains`
protection redirects unauthenticated visitors on immutable deployment URLs to
Vercel Authentication; the stable Production alias serves the app and API
without a share link under the existing domain exception. Verify actual alias
access instead of assuming every project URL requires login. Do not embed a
share token, bypass cookie, provider key or preview password in public HTML.
Owner testing may use an independently verified expiring scoped share URL.

Production environment variables remain configured in Vercel, not in source:
`ABUSECH_AUTH_KEY`, `MALWAREBAZAAR_AUTH_KEY`, `GUARD_REPORT_SECRET`,
`URLHAUS_AUTH_KEY_SOURCE`, and the four `GUARD_CLOUD_*` activation controls.
Do not decrypt/copy them or enable paid upgrades. Sandbox readiness describes
configuration, not an audit of remaining quota. Missing hashes, provider
errors, unsupported behavior and absent consent retain honest static fallback.

The engine and pinned cloud collector are copied unchanged from the reviewed
standalone source. The integration changes only frontend base paths, PWA scope
and API dispatch. Cloud collector SHA-256:
`1886250255a8d690a362b5f6aa5a343b1c65de291e0d9bea2136b245c45b951b`.
No suspicious specimen may be executed in development, tests or CI.

Verification:

```sh
npm run test:game-scam-guard
npm run test:static
npm run build
NODE_ENV=production GUARD_BROWSER_SANDBOX=false node tests/game-scam-preview.mjs
```

The last command uses an owned loopback server, benign authored JSON and public
Example Domain. Browser binaries/libraries must match the installed Playwright.
The local service worker must stay under `/game-scam-guard/`; it must not cache
MalGuard parent pages, API responses or received file bytes. The static builder
copies built frontend assets only, excluding service sources and credentials.
