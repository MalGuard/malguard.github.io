# GameScam Guard Android release signing

GameScam Guard's direct Android APK must be signed with one persistent Android release keystore. It is free to use and is required so Android can verify future updates come from the same publisher.

## Required repository secrets

Add these **Actions secrets** to the `MalGuard/malguard.github.io` repository. Never add these values to source files, issues, pull requests, or public release assets.

| Secret | Purpose |
| --- | --- |
| `GSG_ANDROID_KEYSTORE_BASE64` | Base64 representation of the private `.jks` release keystore |
| `GSG_ANDROID_KEYSTORE_PASSWORD` | Password that protects the keystore |
| `GSG_ANDROID_KEY_ALIAS` | Alias of the signing key in that keystore |
| `GSG_ANDROID_KEY_PASSWORD` | Password for that signing key |

The release workflow fails closed when any secret is absent. It decodes the keystore only into the ephemeral GitHub Actions runner, signs the APK, verifies the APK signature using Android's `apksigner`, and uploads only the signed APK.

## Operational rule

Keep an encrypted backup of the keystore and its passwords outside the public repository. Losing the key means Android cannot accept an update to the existing app identity; users would have to uninstall the old app before installing a replacement.
