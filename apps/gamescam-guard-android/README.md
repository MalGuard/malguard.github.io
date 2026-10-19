# GameScam Guard for Android

This is the Samsung/Android test app for `https://malguard.site/game-scam-guard/`.
It intentionally hosts the same live service in a hardened Android WebView instead
of copying API keys or scan logic into the APK.

## Security boundaries

- HTTPS-only and Android Safe Browsing enabled.
- File/content URL access and mixed HTTP content disabled.
- Only MalGuard pages stay inside the embedded browser. Other top-level links are
  handed to the phone browser.
- The APK does not contain threat-intelligence keys, mail credentials, or scan
  provider credentials.

## Test APK

GitHub Actions builds an installable **debug APK** after a push that changes this
directory. Download `gamescam-guard-android-debug` from the workflow run.
On a Samsung device, allow installation only for the app/browser used to download
that APK, install it, then disable that permission again.

A Play Store release needs a private release-signing key and a Google Play account;
this repository deliberately does not create or store either one.
