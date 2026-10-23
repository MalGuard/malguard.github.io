# MalGuard AI appearance update — 23 October 2026

The standalone `/ai/` page now uses a monochrome, centered chat layout inspired by the requested Grok style, with MalGuard branding. The backdrop reuses the existing homepage particle WebP assets, with grayscale and dark overlays. The homepage and its Hero are unchanged.

The composer is a single-row capsule, 56–60 px high when empty, with a white send button and file attachment control. It grows for multiline messages; the Chat/Automatic inspection selector and collapsible permission panel sit below the capsule. English is the initial language, with the existing Persian/RTL switch available at all times. Permissions and the five-tool status/selection panel remain accessible as collapsible sections. All security verdicts keep their explicit text, evidence, sources, timestamps and limitations; monochrome styling does not rely on color to communicate severity. Chat/website/file shortcuts only prepare input or open the file picker and never submit data or grant permissions.

Both languages and text directions remain supported, including English before the client script loads. The static backdrop uses the existing 47 KiB mobile / 118 KiB desktop assets without canvas, video, remote assets or continuous animation. The existing local font is reused. The development server exposes an explicit allowlist for these brand assets.

## Verification

- `npm run test:ai`: 35 passed, zero failures, with network permission for loopback test servers. An initial restricted-sandbox run could not open loopback listeners; no implementation or security changes were made to suppress that failure.
- `TEST_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:ai:browser`: passed at 360, 390, 768 and 1280 pixels. Includes real frontend → API → static artifact analysis, consent, privacy, localized verdicts, and injected benign-model conversation/inspection-only tests.
- Additional local browser review at 360, 390, 768 and 1440 pixels: landing and expanded controls fit in RTL/LTR; all brand/font/background requests succeeded; shortcut actions made zero POST requests; no browser errors. Screenshots are generated locally under ignored `test-results/malguard-ai/monochrome-*.png`.
- `npm run check:ai`, `npm run build`, `python3 tests/validate-site.py` and `git diff --check`: passed. Validation covers 48 HTML documents. The existing build warning about `./fonts/vazirmatn.css` remains.
- No new dependencies, paid resources or GitHub merges. The corrected existing private gateway was deployed on 23 October 2026 and real Workers AI chat and Tavily search requests both returned HTTP 200. Frontend deployment and end-to-end live results are tracked in PR #258; configuration/readiness alone is never presented as proof of successful inference.
