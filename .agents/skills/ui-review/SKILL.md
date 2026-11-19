---
name: ui-review
description: Run after every MalGuard UI change to review affected screens in Playwright at mobile, tablet, and desktop widths in dark and light themes, then fix and verify visual, accessibility, and Persian RTL issues.
---

# Review MalGuard UI

1. Read the root `AGENTS.md` and the `rtl-persian` skill. Identify the affected routes and their realistic normal, empty, loading, and error states. Use safe fixtures or stubbed responses to exercise states that require external data.
2. Start the affected app with its documented development command. For a static app, serve the normal build or source directory using its documented flow. Wait for the relevant route to respond.
3. Use Playwright MCP, or the repository's Playwright runner if MCP is unavailable. Capture PNG screenshots for each affected route at 390×844, 768×1024, and 1440×900 CSS pixels in both dark and light. Set the app's theme explicitly when it has a setting, otherwise emulate the browser color scheme. Verify the effective theme through rendered styles. Wait for fonts and deterministic app state before capture. Include screenshots for relevant state variants and use filenames that identify route, state, width, theme, and round.
4. Check spacing, typography and hierarchy, alignment, text wrapping and overflow, and empty, loading, and error states. Inspect WCAG AA contrast using rendered colors, including hover and focus. Test keyboard navigation and visible focus. Verify the Persian route's direction, mixed Persian and Latin content, and mirrored directional icons using the RTL skill.
5. Fix findings using existing components and the root design tokens. Prefer shadcn/ui components where the surface supports them. Give interactive elements visible hover and `:focus-visible` states. Use the approved 150–250 ms transitions and honor reduced motion.
6. Repeat the screenshots and checks after fixes. Run at most three review rounds, including the initial pass. If findings remain after the third round, report them. If a browser, route, state, or effective theme is unavailable, report that gap explicitly.
7. Report in at most three lines covering the changes, the verified matrix and evidence location, and any unresolved issue or coverage gap.
