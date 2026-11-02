# Product app-orbit previews and physical engine

The public homepage exposes three motion previews through `?motion=merge`, `?motion=orbit` and `?motion=engine`. The first two retain the reviewed circular choreography and logo reveal. All three use eight locally bundled, filled application icons for MalGuard products and tools, with rounded light app surfaces instead of line-only symbols. These are product illustrations, not claims of integrations with third-party apps.

## Real 3D engine

The engine preview loads a self-hosted, pinned Three.js 0.180.0 bundle only after its variant is selected. Source: `tools/product-engine3d.mjs`; rebuild with `node tools/build-product-engine.mjs` after installing the repository dependencies. The compiled module is committed as a public asset. Three.js is already pinned in the project and its MIT license is included.

A perspective camera renders four cutaway cylinders, hollow piston skirts, compression rings, wrist pins, rigid connecting rods, crank webs, shaft journals, a drilled flywheel, valve stems and helical springs. The model has approximately 178 mesh parts and 80,000 triangles. Steel, anodized metal and bronze use physically based materials and a generated studio environment, key and rim lights. Intake and combustion are illustrated by restrained chamber colors. This is a visual mechanism, not application-performance telemetry.

Piston travel and rod orientation come from the slider-crank equations. The four crank phases are balanced; valve cycles correspond to the four-stroke cycle. The model rotates under horizontal pointer drag, including while animation is paused. No SVG piston mechanism remains in the page.

## Loading and motion

The lazy 3D bundle is approximately 139 KB compressed. The other two variants do not download it. Continuous rendering is capped near 30 fps with a limited pixel ratio; rendering stops while paused, offscreen, in a hidden tab or under reduced motion. There is no new runtime CDN or model-service request. Without WebGL, a small static poster captured from the actual 3D scene is displayed. Context loss switches to that poster.

## Evidence

Static validation passed for 49 HTML documents and public assets. Chromium checked 320, 390, 820 and 1440 pixel layouts, the real renderer and perspective camera, rotation under pointer drag, rigid rod/journal alignment across seven sampled crank positions, pause/resume, reduced motion and the no-WebGL poster. A separate regression covered the three motion variants, outward ring exit and replay. Screenshots from multiple camera angles were inspected and materials/framing were refined. AI logic, authentication, API and service sources are unchanged. Field performance and untested device/browser combinations are not certified by these checks.
