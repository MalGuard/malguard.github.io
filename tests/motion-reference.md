# MalGuard reference motion reconstruction

Reference: the user-supplied 48-second mobile recording, A2FEA3C8-B509-47CF-947C-58116B4AF642.mov.

The recording supplies visible behavior, not reusable source code. These interactions are reconstructed with native DOM/CSS and one small canvas, using the site's existing MalGuard and product marks.

| Observed behavior | Implementation |
| --- | --- |
| Shield halves separate and reveal a central object and three annotations | Two clipped copies of the actual MalGuard mark separate with perspective over 1.1 seconds; notes appear at 120/210/300 ms. The same control closes it. |
| Connected background points drift and connections change | A graphite/silver field of 38 mobile or 72 desktop nodes, bounded to approximately 30 fps; sparse pulses travel along connections. |
| Analysis plates separate into a tilted stack | Four plates separate over 850 ms; selecting native Identify/Inspect/Analyze/Decide explanations highlights the corresponding plate. A separate control gathers the stack again. |
| Product cards rotate in place to reveal availability and limits | Stable-height front/back faces turn over 950 ms, with backface hiding, focus transfer, inactive-face inertness and Escape/return handling. |
| Objects drift/rotate inside the cards | Existing GTA Guard, Malware AI and Game Scam Guard icons sit within individually animated assemblies. |

Additional motion: subtle pointer response on the intact shield and background, CTA sheen, tool-icon tilt, staggered scroll entrances, reading progress, and suspension of offscreen object loops. Native scrolling is preserved.

The background material, marks, product descriptions, availability and destinations come from MalGuard. The green M shield, green ball and generic sample shapes are not used. Text stays in reserved annotation areas; product navigation remains distinct from the turn control.

Motion honors the operating-system preference and the persistent Pause motion control. The field stops while the page is hidden or the entry gate is active. With JavaScript disabled, product destinations and native analysis explanations remain available.

## Verification

- `npm run test:static`: documents, assets, local destinations and release boundaries.
- `npm run test:experience`: Chromium/WebKit, 320–1440 px, public pages and existing tools, keyboard navigation, reduced motion, no-JS, normal motion and repeated reversals.
- `npm run test:motion`: normal-motion mobile/desktop shield, annotation overlap, layer selection, stable card dimensions, focus return, pause persistence and reduced-motion changes.
- `node tests/visual-review.mjs`: screenshots of closed/open shield, plates, cards before/during/after turning and related pages.
- After publication: `GITHUB_SHA=<published revision> python3 tests/verify-published.py` compares deployed file hashes; `TEST_BASE_URL=https://malguard.github.io npm run test:motion` checks real production interactions without calling external backends.
