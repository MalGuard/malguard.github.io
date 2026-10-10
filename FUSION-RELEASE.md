# MalGuard unified public site

The approved Fusion homepage and GTA Guard cinematic journey are the visual baseline. This release applies their Inter/Sora typography, blue/violet accents, graphite surfaces, authentic MG mark, navigation, focus styles and footer to all 25 actual public HTML routes. Existing page copy and functional applications remain in place.

The approved particle positions, morph durations, easing, text holds, shaders, geometry and GTA camera journey are unchanged. Production asset URLs use an isolated `/assets/fusion/` namespace. The homepage script tolerates the replaced legacy menu. Product flips retain the same geometry, rim motion and timing, with separate native buttons for keyboard and screen-reader access.

Navigation/search remains local. Administrator authentication is available from the common menu and `/#admin-access`; the cinematic public homepage opens directly. An empty visitor role becomes public, while an existing administrator session is retained. Password verification, access-log consent and the existing fail-closed email confirmation have not been weakened.

Public GTA Guard installer distribution is marked **Download paused**. The existing password-protected path for authorized preview testers remains operational. Release metadata, update verification, SHA-256 checks, private service sources and historical encrypted packages are unchanged. No public direct EXE link is added. Game Scam Guard is informational, in development, with no public release.

The original local SHA-256 and URL-text tools, Malware AI access/chat, iPhone preview, history navigation, bilingual controls, Trust Center and privacy policies are preserved. Illustrative demos never upload, read or execute a file. Inconclusive is never represented as Safe.

## Verification and build

- `npm ci --ignore-scripts`
- `npm run build` — explicit public static artifact, excluding API/private-service/test/source folders.
- `python3 tests/validate-trust.py`
- `node tests/public-release/model.test.mjs`
- `node --test private-download-service/tests/*.test.mjs`
- `npm run test:experience`
- `node tests/public-release/browser.cjs` — inert synthetic download bytes only.
- `node tests/public-release/locale-pages.mjs`
- `npm run test:motion`
- `node tests/visual-review.mjs`

The browser suites target isolated local HTTPS and block external analysis/auth/download services. Administrator responses are mocked. Tests exercise full scroll in both directions, four pinned layers, card flips/tilt, real WebGL geometry, genuine logos, no-WebGL/load-failure/context-loss fallback, reduced motion, keyboard access, clipboard fallback, local tools, navigation, responsive layouts and locale persistence. Software-driver programs are warmed before film measurements; cold failures and weak-device fallbacks remain separately tested. Physical iPhone/iPad hardware and real-user Core Web Vitals need field review; browser emulation is not a hardware certification.

`tests/unified-source-inventory.json` records all public routes and the original commit. `tests/fusion/approved-motion-manifest.json` records the approved and transferred runtime hashes. Browser evidence is saved under `test-results/` and as CI artifacts; it is excluded from the public Pages artifact.

## Deployment and rollback

The original GitHub Pages workflow retains its explicit public-file whitelist. It adds only the informational Game Scam Guard page. The post-deployment verifier compares every public HTML route, all Fusion assets and the preserved release runtime/metadata against the deployed commit. No server service is redeployed.

Baseline for a reversible rollback: `05991be3e18b42a84aed17994ef404f0bcfe54d7`. Use an ordinary revert of the integration commit, followed by the same Pages workflow; do not force-push or remove historical release data.

The integration preserves the concurrent password rotation from `05991be3e18b42a84aed17994ef404f0bcfe54d7` exactly, including scrypt derivation, encrypted installer parts and current password fixtures. The initial page inventory remains based on `52826c9d7a6fa533b322358639cb4a8e91df41e9`; no download password is included in this release.
