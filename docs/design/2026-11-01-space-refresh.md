# Public site space refresh

Approved direction: deep space, immediate content, individual product art and lightweight motion. User requested removal of typewriter gating first. AI runtime and backend files are out of scope.

Changes: retire the shared typewriter and early hiding controller; expose source text and art immediately; replace telemetry and illustrative activity counters with a CSS planetary horizon; refresh GTA VI, gaming worlds and AI provider card artwork; add an explicitly in-development Agent Guard concept; apply a static space background to public editorial pages. Product motion uses transform/opacity and respects reduced motion.

Options considered: continuous full-screen WebGL (higher mobile cost), fully static art (less motion), static layers plus limited CSS motion (selected). No autoplay video or runtime image service is required.

Validation: static validator passed for 49 HTML documents, links/assets/anchors and release integrity. Chromium checked 1440px/390px, reduced motion on/off, four loaded product images, immediate visibility, menu open and five public routes with no horizontal overflow. AI, API, service and private-download source directories have no diff. These checks do not establish field Core Web Vitals or Safari support.

Full project dependency installation failed in the initial environment's npm cache. Isolated Playwright tooling was used for public UI verification. Repository CI must pass before production release. Agent Guard is a product concept, not an implemented enforcement engine.
