# MalGuard AI flagship audit — 2026-11-09

Baseline: `85c0c6bb26a8c9c4c3c621246a6959f9baf2978a`.
Evidence: current repository, HTTP 200 production HTML and byte-identical
`/ai/malguard-ai-orbit.svg`. Browser capture is blocked: the required browser
runtime execution tool is not exposed in this session. This is a source audit,
not a completed interactive production audit or usability study.

## Inventory before implementation

| Area | Existing implementation | Gap / decision |
| --- | --- | --- |
| Identity | Genuine white sparkle and orbital arcs SVG | Preserve exact SVG; reference images use an incorrect M |
| Navigation | Chat, Work, Code; independent histories and drafts | Add Home presentation and mobile bottom navigation |
| Authentication | Account sign-in/up, restore/retry, sign-out gate | Preserve gate and account endpoints; no guest bypass |
| Models | Live catalog, quotas, free fallback consent, local WebGPU and Ollama | Reuse all routing and capability controls; no invented Pro model |
| Thinking | Per-mode capabilities, explicit consent | Preserve; expose through existing tools menu |
| Research | Search/research depth, consent, numbered citations, source cards | Add discoverable Work entry; do not fabricate research progress |
| Work | Seven security tools, static checks and separate isolated execution consent | Preserve; text planning through actual Work model; document ingestion is not equivalent to malware scanning |
| Media | Server-advertised image analysis/generation and consent | Preserve; quick action unavailable when provider unavailable |
| Code | File import/add/select, textarea editor, proposal review/apply/undo, ZIP export, sandboxed HTML preview/output | Expose editor on Code entry, file tabs, syntax display, task shortcuts |
| Messages | Text-safe prose and fenced syntax blocks, copy, citations | Add safe headings/lists/tables/inline formatting; no raw HTML |
| Persistence | Account chat library, archive, memory; project files only in page memory | Keep truthful save status; warn before leaving edited projects |
| Theme | Global light/dark/auto; layered local overrides | Add scoped, coherent tokens and explicit light surfaces |
| Mobile | Sidebar collapse, editor/preview switch | Add safe-area bottom navigation, 44px controls, compact hero |

## Source findings

1. No dedicated Home exists. The default empty Chat doubles as entry.
2. Code project panel starts closed; useful import, preview and export are hidden.
3. Markdown prose is a single text paragraph. Tables/headings in real answers are not rendered.
4. Multiple CSS generations conflict; reference layout requires a final scoped layer.
5. Reference document cards, progress percentages, notifications and terminals cannot be copied as real data.
6. Project edits are memory-only; leaving can lose content. Existing UI says export first but lacks a dirty-project leave guard.
7. Existing authentication, preview isolation, model consent and external-search consent are boundaries to retain.

## Research and design rationale

Public documentation researched this session (not signed-in app testing):

- [ChatGPT projects](https://help.openai.com/en/articles/10169521-projects-in-chatgpt) and [deep research](https://help.openai.com/en/articles/10500283-deep-research-in-chatgpt): persistent context and source-backed reports. Preserve the real library and source evidence.
- [Claude artifacts](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them): separate artifact workspace. Keep code and assistant distinct.
- [Gemini Canvas](https://support.google.com/gemini/answer/16047321?hl=en&co=GENIE.Platform%3DDesktop): direct code editing alongside prompts. Expose existing editor/preview.
- [Grok Think](https://x.ai/news/grok-3): explicit reasoning interaction. Keep capability-gated Thinking, without promising private reasoning traces.
- [Perplexity citations](https://www.perplexity.ai/help-center/en/articles/10352895-how-does-perplexity-work): numbered links to original sources. Retain verified source metadata and safe links.
- [Cursor worktrees](https://cursor.com/docs/configuration/worktrees): isolated changes and review. Retain proposal review and Undo; no arbitrary terminal simulation.

User's blue desktop/mobile references are the visual target. Use the existing
space imagery, orbital logo, blue selection states, glass-like opaque panels,
left desktop rail and bottom mobile navigation. Do not invent account names,
conversations, completed documents, security verdicts or provider availability.

## Release gate

Use branch `feature/malguard-ai-flagship-20261109`. Production domain was verified
on existing Vercel project `malguard-galaxy-mobile-test` (`prj_un4mFOLyjE4nI4cAkftnlAjs7A7h`).
No DNS, routing or hosting changes. Keep baseline commit as rollback reference.
Do not promote until rendered preview, authentication/provider integration,
desktop/mobile and light/dark checks are verified. Record incomplete checks honestly.
