# Precision redesign — migration notes

The homepage design was migrated from the owner-approved Sites prototype on 2026-10-22. Desktop browsers with WebGL render the original code-flow sculpture. Low-power, Save-Data, reduced-motion and no-WebGL clients receive a lighter static SVG fallback. The original fractional SVG glyph indexing bug is corrected. Assets are copied locally to avoid an external site dependency. Existing download, Game Scam Guard, and release gate routes remain unchanged. The shared editorial and menu styles are aligned with the graphite design. Homepage counters are **illustrative only**, not independently verified telemetry.

No guarantee of 100% scanning safety is implied. Check browser preview at 320, 390, 820, 1440px, reduced-motion WebGL-off, all navigation links, core service endpoint, and Windows x64 download metadata before merging. Preserve all compliance and security validation tests.
