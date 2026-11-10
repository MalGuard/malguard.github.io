# MalGuard AI interaction standards — 2026-11-10

Research uses Exa: 25 returned results across four research workstreams
(ChatGPT, Grok, Claude, accessibility), including one targeted Grok follow-up.
Official product documentation and W3C sources were retained; third-party UI
tutorials were excluded. This is documentation research, not a signed-in visual
audit of those applications. Rollouts and account-specific controls can vary.

## Product evidence

- [ChatGPT release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes): the mobile composer consolidates individual tool icons into one tools menu to reduce clutter; capabilities are retained. Reasoning controls are contextual to supported models.
- [ChatGPT capabilities](https://help.openai.com/en/articles/9260256-chatgpt-capabilities-overview): search supports current information and source-backed responses. Its availability must be distinguished from ordinary chat.
- [OpenAI Canvas](https://openai.com/index/introducing-canvas/): separate editing surface, direct code/text edits, task-specific shortcuts, and restoring previous versions. This supports a clear boundary between conversation and project content.
- [Claude artifacts](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them): reusable content opens beside the conversation, supports iteration, direct editing and export. Code controls belong with the artifact rather than being scattered around chat.
- [Grok overview](https://docs.x.ai/grok/overview) and [consumer FAQ](https://x.ai/legal/faq): conversation, uploads and account history are distinct user capabilities; upload/privacy state needs explicit presentation.
- [Grok product page](https://x.ai/grok): chat, search, reasoning and creation are selectable tasks. The goal is explicit user intent, not copying the brand's visual treatment.
- [xAI Web Search](https://docs.x.ai/developers/tools/web-search): tool-enabled search returns citations. This is API capability evidence, not proof of a particular Grok app button arrangement.

## Implementation requirements

The values below are MalGuard product decisions except where a WCAG requirement
is explicitly named. They do not imply stronger backend capabilities.

1. **One composer hierarchy.** Message text occupies the first row. The second row has one Tools entry, the actual model selector, and one Send/Stop primary action. Keep one attachment route visible or inside Tools, never two overlapping attachment buttons. Search and Thinking remain discoverable in Tools, with current state and capability limits.
2. **Three button treatments.** Use a filled primary only for Send, consent confirmation or a clearly dominant action. Use restrained outlined secondary actions for import/export/preview. Use quiet icon or text actions for copy, navigation and settings. Avoid giving every control the same bright border or glow.
3. **Stable placement.** Keep Send at the trailing edge, Tools at the leading edge and model selection between them. Navigation must not appear/disappear merely because textarea focus changes. A pointer press must not move its target before release.
4. **Touch and keyboard.** Product target: at least 44×44 CSS px for primary touch controls, with 8px gaps where practical. WCAG 2.2 AA SC 2.5.8 is a 24×24 minimum with specified spacing/exceptions; 44px is our stronger usability target. Preserve native Tab navigation and visible focus.
5. **Contrast in both themes.** WCAG SC 1.4.3 requires normal text, including placeholder text, to reach 4.5:1; large text can use 3:1. Essential control boundaries, selected state and meaningful icons need 3:1 against adjacent colors under SC 1.4.11. Test default, hover, focus, pressed, selected and error states. Inactive-control exceptions are not a reason to make explanatory text unreadable.
6. **Readable prose.** Product defaults: 16px composer and response text, roughly 1.6 line-height, restrained 60–75 character reading width on desktop, responsive headings and paragraphs with clear spacing. These font values are design recommendations, not WCAG-mandated sizes. Long URLs and tables must remain usable without making the page overflow.
7. **No clipped text.** WCAG SC 1.4.12 requires no content/function loss when users override line-height to 1.5, paragraph spacing to 2em, letter spacing to .12em and word spacing to .16em. Avoid fixed button/card heights that crop wrapped labels. These override values are test conditions, not required author defaults.
8. **Response actions follow content.** Show copy/download/response details in a small, predictable row beneath each answer. Keep citations adjacent to claims and original sources available. Do not invent feedback collection, research completion percentages or model execution status.
9. **A compact Code workspace.** On desktop, use an editor and assistant side by side. Put file tabs above the editor, editor/preview switching together, and import/export in a project menu or compact toolbar. Separate AI task shortcuts from project operations. On mobile, offer a compact editor and collapsible project/assistant panels. Preserve review-before-apply, Undo and explicit code-sharing consent.
10. **Progressive disclosure on Work.** Show useful task entry points, then expose tool configuration when relevant. Keep security evidence and limitations distinct from generated narrative. Never label static malware scanning as document summarization; clearly describe unavailable PDF/DOCX extraction.
11. **Focus stays visible.** WCAG SC 2.4.11 requires that author-created sticky/fixed content not entirely hide focused components. Product target: the whole focused control remains visible above the dock/composer. Test keyboard traversal, open menus, mobile scrolling and the on-screen keyboard; reserve safe-area space.
12. **Theme is structural.** Light mode uses explicit light surfaces, dark text and dedicated control colors rather than a weak overlay on a dark scene. Decorative space imagery must not reduce reading contrast. Respect reduced motion; no decorative animation should delay reading or action.

## Accessibility sources

- [SC 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
- [SC 1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum)
- [SC 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast)
- [SC 1.4.12 Text Spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing)
- [SC 2.4.11 Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)

## Acceptance evidence still required

Rendered Home/Work/Chat/Code at 360, 390, 768, 1024 and 1440 px; light and dark
themes; long/short model labels; English and supported localization; keyboard
focus; text-spacing overrides; no page-level horizontal overflow; dropdown and
consent dialog reachability; real model/search availability and honest errors.
Screenshots and sampled palette contrast alone do not establish WCAG conformance.
