# MalGuard AI flagship — preview candidate, not production accepted

## Implemented

- Dedicated Home presentation, Work/Chat/Code cards, mobile bottom navigation and Library entry.
- Official orbital SVG unchanged; blue/graphite space styling follows the eight primary references.
- Work actions route to real research, text planning and security controls. PDF/DOCX extraction is explicitly unavailable.
- Code opens the existing editor; real file tabs, syntax overlay, Explain/Debug/Refactor/Test prompts. File sharing remains opt-in.
- Keyboard Tab exits the editor; Ctrl/Cmd+] indents. Native leave warning for unexported project changes.
- Safe Markdown headings, lists, tables, inline code, links and fenced syntax; raw HTML stays inert. Answers can download as Markdown.
- Offline notice, provider-dependent image action, light surfaces, reduced motion and visible focus.
- Authentication, model catalog/routing, quotas, reasoning, consent, account history, archive/memory, local/Ollama models, security tools, proposal/Undo and sandboxed preview are retained.

## Changes

`ai/flagship.mjs` and `ai/flagship.css`: new presentation and navigation.
`ai/app.js`: view integration and response download.
`ai/builder.mjs`: keyboard navigation and unsaved-project warning.
`ai/code-view.mjs`: bounded, text-safe Markdown renderer.
`ai/index.html`: load new layer, remove blocked inline style and unused image preloads.
`package.json`, lockfile: jsdom test-only dependency and test command integrated into `check:ai`.
`tests/ai-flagship.test.mjs`: interaction, safety, editor and contrast coverage.
Two existing test files: update the expected application asset revision.
No production backend, DNS, domains, provider credentials or unrelated product source changed.

## Verified in this session

- Production HTML exactly matches baseline SHA-256 `9202445423bf875845721c943f25492f97d8ad00ca267c8b7ccaff0abc32ce10`.
- Production logo byte-identical to repository orbital SVG.
- `npm run test:ai`: 95/95 passed after changes.
- `npm run check:ai`: syntax/static safety, 3 composer tests and 8 new DOM tests passed.
- Experience/thinking regression tests: 15/15 passed.
- `npm run build`: passed; public-boundary validator checked 52 HTML documents and build copied 51 public routes.
- `git diff --check`: passed.
- New JS: 11,257 bytes / 4,200 gzip; scoped CSS: 21,576 / 4,946 gzip at measurement time. No new production library.
- Sampled text token contrast passes 4.5:1 in light/dark; this is not a full WCAG audit.
- Live public model catalog HTTP 200 (single observation 1,095 ms), 17 advertised available options; search and reasoning advertised enabled. This does not prove successful inference.
- Live security status HTTP 200 (single observation 2,287 ms). No scan or safety verdict inferred from status.

## Outstanding acceptance checks / limitations

The session lacks the required browser execution tool. No rendered screenshot,
visual reference comparison, mobile keyboard test, real sign-in/out/refresh,
authenticated inference, end-to-end browser run, Lighthouse trace or full
accessibility audit has been completed. DOM tests are not browser visual tests.

The existing Earth image is reused at 1.9 MB; image optimization and measured LCP
remain release work. The new CSS is a scoped final layer over historical CSS;
visual QA must check cascade interactions at 360, 390, 768, 1024 and 1440 px.

Document extraction, feedback storage, arbitrary backend execution and fabricated
task progress are not implemented. Code project persistence remains memory-only
with ZIP export and leave warning. No terminal or fake completed documents.
Exact screenshot fidelity is **not verified**.

## Deployment and rollback

Branch: `feature/malguard-ai-flagship-20261109`.
Existing project: `malguard-galaxy-mobile-test` / `prj_un4mFOLyjE4nI4cAkftnlAjs7A7h`.
Verified production baseline: `85c0c6bb26a8c9c4c3c621246a6959f9baf2978a`;
deployment `dpl_27SgLA7RqVZ229YDnVgzgsSphdjV` at https://malguard.site/ai/.
Keep this deployment for rollback. Do not merge/promote this preview candidate
until the outstanding acceptance checks pass. Preview/PR identifiers are recorded
in the task handoff after creation.

### Follow-up verification — 2026-11-10

CI run 42749247691 passed the primary browser suite at 360, 390, 768 and
1280 px and produced 11 screenshots (artifact 13732922376). Home desktop,
Work mobile and Code desktop screenshots were inspected. They show the official
logo and consistent surfaces; Code is still taller than the reference and the
composer Tools group needed an explicit width to avoid overlapping Attach.
The local-model onboarding test then exposed a hidden download error while Home
was active. The follow-up changes reveal the conversation on error and correct
the Tools width. The full CI gate remains pending until that regression passes.
Real authenticated provider testing and full reference fidelity are still outstanding.

### Design refinement — 2026-11-10

User requested a calmer, more coherent interface, stronger typography, standard
button placement and complete light-theme readability. Exa research of official
ChatGPT/Grok/Claude documentation and W3C guidance is recorded in
`ai-ux-standards-20261110.md`; scoped manual security review is in
`ai-refinement-review.md`. Three collaborating agents handled research, CSS and
review. No claim of live signed-in competitor testing is made.

The refinement replaces the flagship stylesheet with a coherent design layer,
standardizes composer geometry and responsive controls, tightens navigation and
preserves drafts when choosing templates. Browser CI now captures both themes,
checks actual visible composer rectangles for overlap, and computes text and
placeholder contrast from rendered styles. Those new checks must pass on the
new commit before claiming this refinement visually verified.

All five workflows on the preceding commit `74d8bed9f2b6a3cb41af2fc3debbe9bfba94ee79`
passed, including browser Code, local models, accounts and library fixtures.
Those results establish the earlier implementation baseline, not a passing result
for subsequent styling changes. Real authenticated provider testing remains outstanding.
