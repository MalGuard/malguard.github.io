# Password before the Windows installer download

The current `api/installer` endpoint checks the owner's download password on
**every request**, before returning installer bytes. The website sends the code
in a POST body over HTTPS. It never saves it in a URL or browser storage. The
ordinary Windows EXE has no archive password, installation password or device
license. Anyone with the downloaded EXE can copy and install it, as requested.

Only AES-256-GCM ciphertext is committed in `sealed-installer/`. The release
build and random public salt derive a key using scrypt (N=65536, r=8, p=1), with
the build included in the salt context. Chosen passwords preserve case, spaces
and punctuation exactly. Historical releases without `passwordKdf` retain
HKDF-SHA256 for their uniformly random 160-bit codes. A successful GCM authentication verifies the password on the
server; a changed ciphertext or final installer SHA-256 mismatch blocks delivery.
The code and derived key are absent from Git, Pages, release JSON and logs. This
Current chosen passwords use a memory-hard derivation rather than the historical fast code derivation.
The existing Vercel Git connection deploys this directory without adding a new
production secret. `installer-release.mjs` contains public metadata only.

Each response is at most 3 MiB, below Vercel's 4.5 MB response limit. CORS is
restricted to `https://malguard.github.io`; CORS alone is not authentication.
Responses are private and not cacheable. Cached plaintext still requires the
matching key for each part. Concurrent work, request size and failed-code state
are bounded. The per-instance limiter is not a distributed rate limiter. The
browser verifies the complete size and SHA-256 before offering the EXE to save.

Run `npm test` for harmless cryptographic and HTTP regressions. The browser tests
exercise the actual handler using inert fixtures, including wrong codes before
and after an authorized download, cancellation and corrupt transfers. Live
verification uses an ephemeral RSA recipient in CI: only its public key, the
wrapped code and a bounded verification receipt enter Git. The recipient's
private key and owner's code are never published. The live download is hashed,
not executed or uploaded as a CI artifact.

To rotate access, use the owner's new password and a fresh random salt, reseal the verified EXE,
update `installer-release.mjs` and `sealed-installer/`, and redeploy. Ciphertext
already downloaded from an older revision remains decryptable by its old code.
Changing website HTML does not revoke copies of a downloaded EXE.

`X-Release-Seal-SHA256` is a public deployment identity available on the empty
OPTIONS response. Live verification waits for the reviewed seal before sending
passwords. `tools/wrap-verification-password.mjs` accepts the proof checkout,
reviewed run ID, source commit, and private current/previous password file paths.
It binds the encrypted payload to the run, installer and seal. Verification also
rejects the previous password before and after downloading the verified EXE.

The older `api/download` endpoint serves only historical public 1.2.0 ciphertext
from `sealed/` using its existing environment key. It cannot decrypt or deliver
the current 1.3.1 installer. Its historical metadata remains separate.
