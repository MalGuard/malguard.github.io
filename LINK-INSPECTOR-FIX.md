Link Inspector correction (review branch)

The Tools page only searched for literal brand names. `poblox.com` therefore did not match Roblox. Both Tools and Scan URL now use one shared local inspector: one-character edits, adjacent transposition and common digit substitutions produce explained review signals. Official domains and their real subdomains are exempt for their own brand; suffix impersonation is not. A warning is not a confirmed malware classification.

The result offers an explicit Game Scam Guard continuation. The normalized HTTP(S) address is transferred in the fragment; credentials and unsupported schemes cannot be handed off. The actual Game Scam Guard app reads and validates that fragment, pre-fills its existing scan field and waits for the user's existing Scan action. No new API, automatic target request, authentication change or backend rewrite.

VERIFIED: 18 regression assertions; browser checks of tools.html and scan-url.html; actual Vite production build receives the address without starting a scan; 46-page repository static validation.
REVIEWED: DOM output uses textContent, host-boundary checks, no scan requests from local inspection.
UNTESTED: live reputation services and physical devices. Build reports the existing unresolved fonts/vazirmatn.css reference; this patch does not change fonts.
Publication: this branch has not been pushed or deployed to malguard.site.

Run `node tests/url-text-inspector.cjs`. For browser checks, serve this checkout on 127.0.0.1:4174 and build Game Scam Guard using the repository's existing build command, then run `node tests/url-inspector-browser.cjs`.
