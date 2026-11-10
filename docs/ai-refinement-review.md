# Scoped MalGuard AI refinement review — 2026-11-10

Baseline: `85c0c6bb26a8c9c4c3c621246a6959f9baf2978a`.
Reviewed committed head: `74d8bed9f2b6a3cb41af2fc3debbe9bfba94ee79`.
This is a manual diff review, not a completed formal Codex Security scan. The
security-diff-scan skill loaded, but its required config-preflight resource could
not be read through the available skill provider. No security scan ID was created.

## Result

No confirmed new exploitable security vulnerability was found in the reviewed
source changes. This does not establish whole-product security or WCAG compliance.

Reviewed the changed application/view integration, builder, Markdown renderer,
flagship module and styles, HTML/CSP, package changes, CI artifact upload and test
changes. Followed the relevant existing model-consent, Code-share, file validation,
preview isolation and sign-out cleanup paths without changing them.

### Functional issue corrected during refinement

`ai/flagship.mjs:40`: quick-action `fill()` assigns the template directly to the
composer, discarding any unsent draft. This also discards the target Work draft
restored by mode switching. Plan, document and Code shortcuts reach this helper.
The parent refinement now appends the selected instruction and includes a DOM
assertion preserving existing input. Also retain a browser regression for an
existing draft in the destination mode. Do not auto-submit or auto-enable sharing.

### Accessibility verification gap

`tests/ai-flagship.test.mjs`: the contrast test computes hardcoded foreground and
background pairs rather than reading the rendered controls. It cannot catch
legacy CSS overriding a light-theme button, placeholder, selected model option,
focus indicator or disabled text. New browser coverage checks actual composer
rectangles for overlap and horizontal overflow and captures both themes. This
helps layout verification but computed contrast for hover/focus/selected states
still requires a rendered-style check.

### Smaller issues

- The Ctrl/Cmd+] editor indentation shortcut has no visible help or
  `aria-keyshortcuts`; keep Tab available to exit the editor.
- The dirty-project warning treats creating a ZIP download as a completed export.
  Browsers do not tell the page whether the user ultimately saved it. Phrase export
  status as a prepared download; avoid promising durable persistence.

## Boundaries preserved in reviewed code

- Markdown creates text nodes and explicit elements; raw HTML stays inert.
  URL parsing limits links to HTTP(S), rejects credentials and uses noopener.
- New Work/Code quick actions fill local input. They do not call providers or
  check model-share, external-search or Code-share consent automatically.
- Code prompts explain that the user must opt into sharing the selected file.
- The original sandboxed web preview and no-network policy remain in place.
- Account sign-out still clears conversations, drafts, project files and consent.
- No provider credentials, API keys or new client-side secrets were introduced.
- CI screenshots are synthetic fixture outputs, retained for seven days.

## Verification

`node --test tests/ai-flagship.test.mjs`: 8/8 passed, including inert-markup,
unsafe-link, explicit-sharing and editor-keyboard checks.

All five GitHub workflows for reviewed head completed successfully, including
[production-site validation](https://github.com/MalGuard/malguard.github.io/actions/runs/42750472407)
and [experience validation](https://github.com/MalGuard/malguard.github.io/actions/runs/42750472411).
These runs use synthetic accounts/providers and do not prove real authenticated
inference, production credentials, or all browser/device behavior.

## Regression requirements for the next refinement

Preserve unsent drafts across shortcuts and mode switches; verify no request is
sent by navigation; test consent cancellation and sign-out isolation; rerun
Markdown XSS/link tests; test keyboard order, editor Tab exit and modal focus;
inspect light/dark controls at 360, 390, 768, 1024 and 1440 px; verify the mobile
composer and navigation remain stable across focus changes.
