# Global deep-space appearance

Apply a shared, static visual background across all 47 rendered public surfaces, including AI chat's HTML shell. Redirect-only routes retain their redirect behavior. The isolated generated-code preview retains its existing CSP and output surface.

Visual layers: distant stars, sparse nearer luminous stars, low-contrast diagonal haze, subtle radial nebulae and a dark planetary horizon. A locally bundled original SVG star field and CSS gradients provide depth without canvas, videos, animation timers, scroll handlers or third-party requests. Existing reading panels and controls retain their surfaces. Forced-colors mode removes decorative layers.

Only HTML presentation hooks and new visual assets changed. AI JavaScript, its existing stylesheet, API, authentication and service sources are unchanged.

Validation: static site validation passed (49 HTML documents and asset/link/release-integrity checks). Chromium checked the shared background and horizontal overflow on all 47 rendered surfaces at 390px and 1440px (94 successful checks). Saved homepage, documentation and chat screenshots were visually inspected. No new deployment or external build was requested, avoiding known automatic Vercel build-quota issues. This change is committed locally, not yet in the online preview or production.
