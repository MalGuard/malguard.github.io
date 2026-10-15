# Existing GTA Guard MalwareBazaar client

`malwarebazaar-client.cjs` is copied unchanged from the user's repository:

- Repository: https://github.com/MalGuard/malguard-core
- Commit: e487ae00a61f07fc10e1fdd9b829b4e2ef8fc594
- Original path: desktop-app/threat-intel/malwarebazaar-client.js
- Direct source: https://github.com/MalGuard/malguard-core/blob/e487ae00a61f07fc10e1fdd9b829b4e2ef8fc594/desktop-app/threat-intel/malwarebazaar-client.js
- License: MIT, retained in MalGuard-LICENSE.txt

The extension is changed to `.cjs` because GameScam Guard uses ES modules. The wrapper in `server/threat-intel.js` supplies the existing client's injectable transport with this app's bounded, public-IP-pinned, no-redirect network implementation. File-hash queries use `MALWAREBAZAAR_AUTH_KEY` when supplied, otherwise `ABUSECH_AUTH_KEY` and then the original `MALGUARD_ABUSECH_AUTH_KEY` variable. No live secret was copied from GitHub or Vercel.

## GTA Guard PE engine and local rules

`gta-pe-engine.cjs` and `gta-pe-rules.json` are unchanged copies of `engine.js`
and `rules.json` from MalGuard/malguard-core at commit
`e487ae00a61f07fc10e1fdd9b829b4e2ef8fc594`, covered by the included MIT license.
Engine version 2.2.2; compatible rules 2.2.0.

SHA-256 engine: b0454e7dcabd95ba320309b1ef1c8d1ef70cf9c7febedc60c60a7c0f9a033818
SHA-256 rules: 513c67973eeb77053c8cf068dd5fb78c5a2f6d7c91b15919b1ac5857862ea43a

The adapter runs only trusted engine source in a compatibility context inside
our bounded static-parser Worker. Sample bytes are never evaluated as code.
Only local rules may be fetched; the original engine's optional online calls
return unavailable. Real hash intelligence stays in our server-only provider
adapter. DLL/ASI coverage is explicit; this reuse does not certify a Windows
execution backend or digital signatures, and an engine SAFE label is never
presented as a security guarantee.
