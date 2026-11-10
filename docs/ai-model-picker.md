# Custom model picker — 2026-11-10

Replaces the browser-native model field in the composer with a custom trigger,
searchable model cards and a modal dialog (bottom sheet on phones). The selected
model has a checkmark; unavailable options remain disabled with a clear status.
Empty catalog state offers retry rather than a generic "Model" placeholder.

The original Chat/Code and Work select elements remain the state authority.
Options, disabled states and change handlers are reused; no provider APIs,
permissions, quotas, downloads or model capabilities are invented or changed.
Local management entries invoke the existing flows only after explicit selection.

Keyboard: native dialog focus containment, Escape/close, focus return, arrows,
Home/End and search. Labels/option copy are inserted using text nodes. Busy
requests disable selection. No new production dependency.

Tests cover real-option mirroring, filtering, disabled rows, exactly one change,
empty/retry state, busy state and browser dialog interaction. Both-theme desktop
and mobile screenshots and computed contrast/overlap checks are part of CI.
