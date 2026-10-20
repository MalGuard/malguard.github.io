# GameScam Guard: scan continuity review

This change is prepared for later integration. It does not merge to main,
publish the website/API, or create a new Android release.

## Source and installed Android app

- Repository: `MalGuard/malguard.github.io`.
- Base main: `fc9939e2ba7d0a4bcfdc75d7b5bdf90a3b710012`.
- Working branch: `codex/gamescam-scan-continuity`.
- Android artifact: `release/GameScam-Guard-1.1.0-android.apk`.
- The APK's ZIP integrity and SHA-256 match the release metadata. The manifest
  and DEX were extracted for inspection; the DEX contains the expected
  `https://malguard.site/game-scam-guard/` application URL.
- `MainActivity.java` confirms that the app loads this first-party WebView UI.
  Hosted UI/API changes require deployment before an installed app sees them.
  No physical Samsung device or Android emulator execution was performed.

## Confirmed issues and changes

1. The submitted-page scanner warned about cross-domain HTTP redirects, but
   linked-page scans omitted this warning. Both paths now use the same evidence
   assessment function and retain redirect/threat findings with their verdict.
2. Linked-page progress stayed at the previous batch's count until the entire
   next batch completed. Each start/finish event now carries processed/total
   counts. The UI updates a determinate progress bar from these server events;
   processing failures remain failures in the report.
3. The scan's animation and activity became invisible when navigating to another
   application section. A return-to-progress button now remains available. The
   elapsed timer uses the original start time when the activity view remounts.
4. Resuming an older queue could copy the currently open, unrelated website's
   screenshot into the resumed report. Screenshots are now reused only for the
   matching parent report. Persisted continuation tokens do not retain images;
   after a reload an image may be absent, which is preferable to false evidence.
5. History selection and queue resume now reject overlapping scan operations.
   The shield animation also reflects linked-page work. Pending-queue text gains
   its missing English dynamic translation.
6. When mounted behind an API prefix, continuation calls could consume the
   ordinary scan rate budget. Route matching now preserves the existing separate
   limits (12 scans and 40 continuation calls per minute); regression tests also
   verify that both limits still reject excess requests. Stale Google OAuth
   entries were removed from the API adapter allowlist as well.

## Existing behavior verified

- Google sign-in buttons and OAuth routes are absent; the email account flow
  remains. Harmless historical callback-fragment cleanup does not enable OAuth.
- The original assessment remains visible beside the broader linked assessment.
- Fifteen report rows describe inspection coverage, not fifteen antivirus
  engines. A missing browser or provider is not an observed successful check.
- GameScam Guard currently inspects public websites, not uploaded files.
  URLhaus is its configured external URL source; the independent HTML analyzer
  inspects content. MalwareBazaar's hash lookup belongs to file analysis and
  is not presented as website reputation.

## Validation

Run from the repository root:

```sh
npm run test:game-scam-guard
npm run test:static
npm run build
node apps/gamescam-guard-android/verify-project.mjs
TEST_BROWSER=chromium node tests/game-scam-preview.mjs
node tests/game-scam-extended-flow.mjs
```

`TEST_CHROMIUM_EXECUTABLE` optionally selects an installed Chromium binary for
local verification; CI keeps its pinned Playwright browser. Browser tests use
authored HTML, synthetic threat responses and an owned loopback API. They cover
320px/390px mobile, tablet, desktop, English/Persian, account forms, scan results,
streamed progress, navigation during scanning and cross-site queue resumption.

Verified in this workspace: 82 service/integration tests passed; static checks,
the production build and Android project verification passed. Both Chromium UI
suites passed. The live-progress screenshot was visually reviewed, and the
cross-site continuation test confirmed that an unrelated screenshot is absent.
No Safari/WebKit or physical-device result is claimed. Dependency tarballs were
installed at the exact lockfile versions with their integrity hashes verified;
the local npm downloader had failed integrity retries through the proxy.

On 2026-10-20, one live basic scan of the owner's `https://malguard.site/`
completed through the existing production API. The HTML was received and
URLhaus returned `not_found`; this is not a safety guarantee. The production
health endpoint reported URLhaus configured. These observations verify the
existing deployment, not deployment of this patch. No external threat specimens,
paid sandbox execution, files or credentials were submitted during verification.

## Follow-up scope

Additional file engines, file uploads, execution sandboxes and a separate
ultra tier require an explicit product/backend design and configured, verified
infrastructure. They have not been added or simulated by this patch. Stronger
claims must follow measured coverage and detection quality rather than labels
or layer counts. Existing repository CI had failures before this change; local
validation does not establish a green remote CI run for an unpublished branch.
