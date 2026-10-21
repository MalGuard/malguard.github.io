# Game Scam Guard 2.1 review

The existing engine has 20 distinct analysis modules, not 20 independent antivirus services. This revision strengthens those modules and adds a second static pass over embedded HTML already received. It never fabricates engines, scans per second, provider responses or a safe verdict.

Changes:
- Detect single-character gaming-brand typos, adjacent transpositions and digit lookalikes on primary pages and observed HTTP redirects; retain spelling evidence when page retrieval fails.
- Inspect iframe srcdoc and HTML data documents for the existing sensitive-form, code and other HTML rules. Recurse at most two levels, inspect at most eight unique documents and decode at most 128 KiB. Omitted/partially inspected content makes coverage visibly incomplete.
- Preserve actual document origin while inheriting relative base URLs. Never execute site code, fetch embedded resources, submit forms, collect field values or expand archives.
- Apply the same policy on submitted and linked-page scans; render the secondary-pass count and gaps in English/Persian reports, with a matching progress phase. The existing elapsed-time display updates once a second; network scans are not repeated once a second.
- Expand offline self-test from 38 to 42 synthetic checks. Keep all 20 existing detection modules and their negative fixtures.
- Include the separate local Tools/Scan URL typo correction and explicit Game Scam Guard fragment handoff.

VERIFIED: 166 service regression cases (the full suite plus the final corrected self-test API count), including eight new secondary-analysis cases; 42/42 internal synthetic self-tests; production Vite build; local browser handoff tests; English/Persian report rendering; repository 46-page static checks; 18 local-inspector assertions.

VERIFIED live target: https://malguard.site/ HTML received in one attempt; 20 modules ran; a local isolated Chromium snapshot rendered the guarded, already-received HTML, with JavaScript disabled and no external resources allowed. See verification.json. The real result remained unavailable because threat-source evidence was incomplete. This is an observed run, not a detection-rate benchmark.

REVIEWED: no new paid service, API credentials, provider inventions, rate-limit changes, network-boundary weakening, download enabling or backend architecture replacement. The existing cloud-browser VM path stays behind its explicit server cost opt-in. The local renderer used for verification does not prove cloud deployment readiness.

UNTESTED: real-world detection rate, dynamic malicious-site execution (excluded), physical devices and a new original-site/cloud-backend deployment. Existing build warning for fonts/vazirmatn.css remains unchanged.

Release state: prepared on a separate review branch; not merged or deployed to the original website. The Sites homepage remains a separate prototype.
