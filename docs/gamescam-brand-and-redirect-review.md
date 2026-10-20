# GameScam Guard: official artwork and redirect intelligence

Status: local review only. Nothing has been pushed, merged, deployed or released.
This change follows local commit `1c950f0`; it preserves the earlier compact bilingual UI and 20 static HTML analysis checks.

## Official artwork

The source is the blue shield/controller image already referenced by the official Android page: `assets/gamescam-guard-android.png` (1254 × 1254).
Its SHA-256 is `2a735108ff915383069eb1dfec25c6685fe542057a3e29a2163bd3b6c481bb0a`.
The existing Android drawable is byte-identical to this source. No new artwork was generated.

The app header, help/confirmation dialog, favicon, 192/512 px install icons and 180 px Apple icon now use this artwork. Web icon sizes were produced by deterministic Lanczos resizing of the source without cropping or recoloring. The manifest uses `purpose: any` so the full square artwork is not advertised as an independently designed maskable icon.

The scoped service worker cache advances to v5 and includes the install icons. Native Android artwork and the existing signed APK are unchanged.

## Added detection coverage

Previously, reputation checks considered the submitted and final URL. An intermediate address with a known threat report could be overlooked if both endpoints had no known report.

The root scan and linked-page scan now share a bounded redirect intelligence helper. After a completed network fetch has validated the connections, it checks every distinct observed HTTP-chain address: at most four redirects and five unique URLs. Additional lookups run concurrently. It does not crawl new links or submit unvisited destinations. Fragments are removed before exact URL reputation queries and duplicate observations are reused; query strings remain intact.

A listed intermediate address retains a danger verdict, even if the final page has no known threat report or is a direct file. Failed required lookups remain explicit coverage gaps. Partial provider failures remain visible even when another provider returns a negative observation. These rules also govern the reputation coverage row and completed-check metadata.

The report retains per-address source evidence in `urlReputations`. The compact Threat sources panel renders each observed address and its source statuses. English and Persian labels cover the new panel text and progress phase. Browser history validation rejects malformed redirect evidence in both root and destination reports.

URLhaus calls retain certificate/public-network validation and disallow redirects, with a 7-second request timeout and 10-second overall budget. Optional OpenPhish configuration remains unchanged and disabled unless explicitly configured.

## Verification

- Full GameScam Guard suite: **142 passed, 0 failed**, including six new redirect intelligence tests and one history validation test.
- Production build and public-site validation: passed; 46 public HTML routes and installer hashes checked.
- Android project security/configuration verifier: passed.
- Chromium compact flow: passed at 320, 390, 820 and 1440 px, including real loaded logo, intermediate source rows, both languages, progress, saved queues and assessment continuity.
- Chromium preview/integration flow: passed, including responsive account screens, private-address and CORS checks, language persistence, and scoped v5 PWA cache behavior.
- Inert 128-target queue exercise with four redirects/five observed addresses per target: completed successfully; the final signed state reopened, with 866,672 bytes of unpacked state, below the 1 MiB codec limit.
- Favicon embedded PNG matches the new 192 px app icon; native full-size logo matches the original site source exactly.

The first full-suite attempt hit the execution sandbox's loopback socket restriction. Rerunning with network permission for the owned test servers passed. Test data consisted of authored HTML, synthetic threat responses and owned loopback servers. No malware was executed, no external threat was submitted, and no production source configuration changed.

These results verify this implementation and its fixtures. They do not establish worldwide detection superiority or a guarantee that arbitrary sites are safe. Physical Samsung testing, remote browser VM execution, and a fresh signed APK build were not performed in this change. The existing detailed engine/renderer limits remain in `gamescam-web-engine-v2.md`.
