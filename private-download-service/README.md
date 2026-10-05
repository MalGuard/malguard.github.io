# Private Windows preview download

This service authorizes every 3 MiB download part on the server. GitHub Pages
hosts the existing site; a separate Vercel project builds only this directory.
There is no public plaintext installer and no browser-side password comparison.

`sealed/` contains authenticated AES-256-GCM ciphertext. Its random key and the
SHA-256 of a separate 160-bit random access code are sensitive Vercel environment
variables named `MALGUARD_DOWNLOAD_KEY` and `MALGUARD_DOWNLOAD_CODE_HASH`. Never
commit either value, the access code, or an unencrypted installer. Missing
configuration, changed ciphertext, failed authentication or a hash mismatch
blocks delivery. The code is submitted in a POST body and is never stored in
browser storage or a URL. Responses are not cacheable. The site verifies the
complete installer hash before offering the browser download.

Three-MiB parts stay below Vercel's documented 4.5 MB response limit. Each part
requires fresh authorization. A per-instance bounded failure limiter complements
the high-entropy code; it is not a distributed rate limiter. CORS is restricted
to `https://malguard.github.io`, and no cookies are needed. CORS alone is not
authentication; the code is always checked independently.

Run the harmless tests with `npm test`. Production deployment must also verify
wrong-code denial, missing-code denial, absence of a public plaintext path and
an exact SHA-256 match for a complete authorized download. A successful build
alone does not establish those checks. The original scanner EXE is never changed
or executed by this service.

To revoke access, replace the code hash in Vercel and redeploy. To rotate the
encryption key, reseal the original verified installer, update release metadata
and sealed parts, then update the sensitive key and deploy the matching source.
Keep production secrets out of fork and untrusted pull-request deployments.
