# Product app-orbit previews and physical engine

The public homepage exposes three motion previews through `?motion=merge`, `?motion=orbit` and `?motion=engine`. The first two retain the reviewed circular choreography and logo reveal. All three use eight locally bundled, filled application icons for MalGuard products and tools, with rounded light app surfaces instead of line-only symbols. These are product illustrations, not claims of integrations with third-party apps.

## Real 3D engine

The engine preview loads a self-hosted, pinned Three.js 0.180.0 bundle only after its variant is selected. Source: `tools/product-engine3d.mjs`; rebuild with `node tools/build-product-engine.mjs` after installing the repository dependencies. The compiled module is committed as a public asset. Three.js is already pinned in the project and its MIT license is included.

A perspective camera renders four cutaway cylinders, hollow piston skirts, compression rings, wrist pins, rigid connecting rods, crank webs, shaft journals, a drilled flywheel, valve stems and helical springs. The model has approximately 222 mesh parts and 140,000 triangles. Steel, anodized metal and bronze use physically based materials and a generated studio environment, key and rim lights. Intake, injection, ignition and combustion use small particle buffers, a compact combustion-front texture and chamber lighting. This is a visual mechanism, not application-performance telemetry.

Piston travel and rod orientation come from the slider-crank equations. The four crank phases are balanced; valve cycles correspond to the four-stroke cycle. The model rotates under horizontal pointer drag, including while animation is paused. No SVG piston mechanism remains in the page.

## Loading and motion

The lazy 3D bundle is approximately 140 KB compressed. The other two variants do not download it. Continuous rendering is capped near 30 fps with a limited pixel ratio; rendering stops while paused, offscreen, in a hidden tab or under reduced motion. There is no new runtime CDN or model-service request. Without WebGL, a small static poster captured from the actual 3D scene is displayed. Context loss switches to that poster.

## Evidence

Static validation passed for 49 HTML documents and public assets. Chromium checked 320, 390, 820 and 1440 pixel layouts, the real renderer and perspective camera, rotation under pointer drag, rigid rod/journal alignment across seven sampled crank positions, pause/resume, reduced motion and the no-WebGL poster. A separate regression covered the three motion variants, outward ring exit and replay. Screenshots from multiple camera angles were inspected and materials/framing were refined. AI logic, authentication, API and service sources are unchanged. Field performance and untested device/browser combinations are not certified by these checks.

### Viewport-triggered combustion revision

The cold-start introduction holds all pistons, valves, crankshaft and apps completely still for 0.85 seconds. A fine direct-injection cone then enters only the first, sealed cylinder; injection ends before the spark at 1.78 seconds. The combustion front flashes at 1.94 seconds, before crank movement begins at 2.12 seconds. Crank speed increases smoothly over 0.95 seconds, and the app orbit follows the resulting crank angle. The remaining cylinders cannot ignite until their first intake and compression after startup.

The flame is a short expanding combustion front inside the bore, replacing the earlier candle-like texture. An open cutaway in the cylinder head keeps the injection and spark visible. The injector emits a cone of 96 small mist particles rather than long streams. During running intake and exhaust, poppet valves descend into the chamber and their springs compress against a fixed lower seat; both valves remain shut for compression and combustion. This is a sequenced product illustration, not a transient thermodynamic engine simulation.

A separate observer prepares the lazy module within 320px of the viewport without advancing time. Playback begins when 65% of the engine surface becomes visible; after the first start it pauses below 15% visibility and resumes from the saved phase. Hidden tabs, the pause button and reduced-motion preferences also stop the render loop. Other hero modes do not download Three.js. A static render remains available if WebGL is unavailable or the context is lost.

Validation includes actual WebGL rendering at four widths, connected crank/rod joints throughout rotation, drag controls, reduced motion and context failure. The combustion regression additionally checks preparation without playback, scroll activation, offscreen time freezing and the stationary off/injection/spark/combustion sequence, motion only after combustion, and the running intake/compression/spark/fire/exhaust sequence. Valve direction, spring compression and sealed combustion are checked directly.

### Crank-driven app orbit

In the engine variant, the app ring now uses the engine's simulation clock with an 8:1 reduction: eight crank revolutions produce one app-ring revolution. Counter-rotation keeps every app face upright, including the mobile elliptical layout. The existing engine frame writes one CSS angle to the rotor; there is no independent animation loop or additional dependency. Preparation, pause, offscreen/hidden states, context loss and reduced motion cannot leave the apps rotating ahead of a stopped engine. The other two hero variants keep their own choreography.


### Machined piston production release

The default homepage now selects the engine; the merge and orbit variants remain accessible through their explicit query parameters. Pistons use a shared machined-aluminum physical material with generated fine roughness/bump texture, dished crowns, recessed compression-ring grooves, actual openings through the skirt for wrist pins and bronze bushes. Forged connecting rods have beveled geometry and a real lightening opening. A darker liner and directional studio lighting distinguish the moving metal surfaces. Startup rests slightly after top dead center, keeping initial combustion away from a zero-torque dead-center pose. The app drive subtracts the resting crank angle and stays stationary until ignition has occurred. No model download or external texture request is added.

The existing experience regression is updated to cover all four authorized product-card destinations, including Agent Guard. Production deployment follows the repository's `main` → GitHub Pages workflow for `malguard.site`.
