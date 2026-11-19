---
name: rtl-persian
description: Implement or verify Persian right-to-left layout, typography, directional icons, and mixed-direction text on every affected MalGuard page and component.
---

# Persian RTL

- Set `<html lang="fa" dir="rtl">` on Persian pages. When locale changes, update both attributes together from the active locale. Propagate direction into dialogs, menus, tooltips, and other portal content, including the shadcn direction provider where the application uses one.
- Use logical CSS properties such as `margin-inline-start`, `padding-inline-end`, `inset-inline-start`, and `border-inline-start`. Use `text-align: start` or `end`. Keep DOM, reading, and keyboard focus order aligned. Preserve explicit physical direction where the content requires it, such as a media timeline or a chart axis.
- Apply Vazirmatn to Persian UI text and a body line height of `1.8`. Follow the root design system's typography tokens.
- Mirror direction-sensitive icons, including Back, Forward, breadcrumbs, and pagination arrows, only in RTL. Preserve logos and non-directional icons.
- Wrap code, URLs, email addresses, hashes, and known Latin snippets in an isolated `dir="ltr"` element. Use `<bdi dir="auto">` for unknown-direction inline content. Give URL and code inputs `dir="ltr"`; test selection and copy/paste.
- Test every affected page in Persian RTL at the UI review widths. Inspect navigation, forms, validation, overlays, breadcrumbs, mixed text and punctuation, keyboard order, and horizontal overflow. Verify `document.documentElement.lang` and `document.documentElement.dir` and check the relevant computed styles. If an English locale also exists, verify it retains its own language and direction.
