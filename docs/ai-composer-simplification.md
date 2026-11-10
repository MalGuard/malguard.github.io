# Composer and workspace simplification — 2026-11-10

The user requested Claude/Grok/ChatGPT-like clarity across every page and model
selector. This change reduces the composer to one tools trigger, one visible
model selector, and Send. The actual Work selector is moved intact into the same
composer location as Chat/Code; its existing model filtering and request handlers
remain the sole routing authority. The duplicate Attach trigger is hidden; file
attachment remains the first action in the tools menu. Local model downloads move
into that menu without changing download permission, quota or compatibility logic.

Home keeps discovery cards. Other pages use a compact mode strip; ongoing
conversations rely on the sidebar/mobile dock. Starter prompts sit below the empty
composer and disappear after a reply. Real errors, consent, source evidence and
account save status remain visible. No models or provider results are invented.

Reference: official Claude support
https://support.claude.com/en/articles/8664678-change-the-model-effort-and-thinking-settings
places model settings next to Send and progressively discloses more models.
Related official ChatGPT/Grok and W3C research is in ai-ux-standards-20261110.md.
This is documentation research, not a live signed-in competitor scan.

Verification: added a DOM regression for unified Work model placement and menu
ownership; browser regressions still check real visible controls, no overlap,
computed text contrast, consent and provider routing. Download tests now exercise
opening the menu before selecting local models. Rendered CI results must pass on
this commit; a successful build alone is not acceptance.
