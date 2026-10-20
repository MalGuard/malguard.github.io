# MalGuard one-day readiness sprint

Date: 2026-10-20. This is a source-grounded readiness checklist, **not** a claim that product security, Google rankings, user adoption or revenue are established.

## Evidence available at sprint start

- Google Search Console has properties for `https://malguard.site/` and `https://malguard.github.io/`.
- The new domain's homepage was recorded as `Submitted and indexed`; its URL Inspection result showed Google crawling it successfully on 2026-10-17.
- URL Inspection had not recognized `/gta-guard.html` and `/trust.html` at the time of checking. This does **not** prove blocking or a site-wide indexing defect; both pages returned HTTP 200 in a separate live crawl.
- The live on-page audit of `/`, `/gta-guard.html`, `/docs.html`, `/trust.html`, and `/download.html` reported five indexable pages, zero critical/high issues and ten low-priority suggestions.
- Some empty image alt attributes are intentional on decorative logos that sit beside accessible brand text; an SEO crawler warning is not sufficient grounds to replace these with repeated alternative text.
- The existing public material acknowledges that no independently verified malware detection rate, external certification or consumer insurance is established. Public Windows preview signing and product assertions must be checked against the exact current release and CI before outreach.

## Delivery gates

1. **Source and security:** Review the exact release commit, Windows installation tests, CI status, provenance, update handling, data egress and privacy requirements. Do not promote a build as verified while critical evidence is missing. Do not use real malware.
2. **Discoverability:** Maintain canonical URLs, robots.txt, and sitemap. Improve a clearly short documentation title without changing layout. Recheck deep-page indexing after Google recrawls; request indexing manually in Search Console where appropriate, without promising that Google will accept the page.
3. **Feedback infrastructure:** Provide a reproducible benign-fixture issue form and link it from README. Security vulnerability reports go through the private policy path.
4. **Credible global outreach:** Prepare a short English public description of current *documented* functionality, attach an authentic benign demo, and invite voluntary testers only when release safety gates pass. No bought traffic, false reviews, fabricated benchmarks or cold-message spam.
5. **Scientific credibility:** Publish an experiment only with a dated, reproducible protocol, fixture hashes, exact build, coverage limits, results and failure cases. Report what was *not* tested.
6. **Revenue:** Keep core safety warnings available without payment. Evaluate pricing only after real user feedback and clear licensing, privacy and support arrangements.

## Evidence-based English outreach copy

> MalGuard is an open-source defensive security project exploring static inspection of supported GTA V mods and signals around potentially deceptive gaming links. We publish limitations and source material, and we welcome reproducible feedback on harmless test cases. A clean scan does not guarantee safety. Product availability and security claims should be verified against the current official release information.

Source links: https://malguard.site/ · https://malguard.site/trust.html · https://malguard.site/security-evidence.html · https://github.com/MalGuard/malguard-core

## Done means

Changes land only after review and required CI passes. This plan does not claim that testers have joined, outreach has been sent, Google has completed migration, code is signed, scanners have been independently audited, or revenue exists.
