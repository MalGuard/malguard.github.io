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

### Viewport-triggered combustion revision

The engine now starts cold at simulation time zero. Each cylinder must complete its own intake before it can ignite: blue air particles and gold fuel droplets enter through the valve/injector, compression closes the valve, a spark flashes at the plug, and an orange-white flame expands above the descending piston. Exhaust particles leave through the outlet. Spark plugs, injector nozzles and curved ports are solid geometry; flame sprites and small particle buffers keep the effect inexpensive without a fluid simulation.

A separate observer prepares the lazy module within 320px of the viewport without advancing time. Playback begins when 65% of the engine surface becomes visible; after the first start it pauses below 15% visibility and resumes from the saved phase. Hidden tabs, the pause button and reduced-motion preferences also stop the render loop. Other hero modes do not download Three.js. A static render remains available if WebGL is unavailable or the context is lost.

Validation includes actual WebGL rendering at four widths, connected crank/rod joints throughout rotation, drag controls, reduced motion and context failure. The combustion regression additionally checks preparation without playback, scroll activation, offscreen time freezing and the intake/compression/spark/fire/exhaust sequence.

### Crank-driven app orbit

In the engine variant, the app ring now uses the engine's simulation clock with an 8:1 reduction: eight crank revolutions produce one app-ring revolution. Counter-rotation keeps every app face upright, including the mobile elliptical layout. The existing engine frame writes one CSS angle to the rotor; there is no independent animation loop or additional dependency. Preparation, pause, offscreen/hidden states, context loss and reduced motion cannot leave the apps rotating ahead of a stopped engine. The other two hero variants keep their own choreography.
