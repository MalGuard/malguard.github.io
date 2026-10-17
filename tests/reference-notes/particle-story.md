# Particle and typography choreography

Reference: user-provided `MalGuard_Codex_optimized.mov`, 17.584 s, 512 × 910, 24 fps.
The recording shows someone scrolling a website on a laptop. Its seconds describe
that demonstration, not a fixed autoplay duration to impose on visitors.

## Observations

| Video interval | Visual behavior |
| --- | --- |
| 0–1.4 s | The particle boundary gathers first; the headline then materializes inside its readable space. |
| 1.4–2.3 s | Form and typography hold together, without continuing to scatter while reading. |
| 2.3–4.2 s | Typography disappears, the boundary stretches into a passage, and the next form gathers. |
| 4.2–5.8 s | The next stable composition and its copy arrive together. |
| 6–7.3 s | A particle-only camera-like transition separates reading states. |
| 7.3–9.3 s | Another readable hold; typography occupies quiet space above the luminous field. |
| 9.3–12 s | Copy leaves before the large transition; a new composition then resolves. |

Keep MalGuard's approved security silhouettes, authentic final logo, actual copy,
current product status and established opening geometry. Transfer the reference's
relationship between typography, continuous particles and scroll, not its DNA or
science-themed product messaging.

## Research

Exa reviewed 15 search results across three angles: particle typography,
reversible native scroll choreography, and adaptive particle quality. Primary
implementation guidance was checked against:

- [GSAP ScrollTrigger documentation](https://gsap.com/docs/v3/Plugins/ScrollTrigger/):
  map animation to scroll progress; keep readable holds; preserve native scrolling;
  recalculate geometry when fonts and viewport change. This implementation uses
  the existing renderer's single clock instead of introducing another scroll owner.
- [Codrops Interlude particle transition](https://interlude.crnacura.workers.dev/transitions/particles/):
  stable particle identities gather into glyphs, breathe, and disperse. MalGuard
  keeps selectable semantic DOM copy and samples only the glyph dust into the
  existing field canvas; it adds no dark sheet.
- [Three.js particle scaling discussion](https://discourse.threejs.org/t/re-scaling-re-sizing-particles-depending-on-screen-size/8810):
  account for pixel density and projection; particle sizes require deliberate
  scaling. Here a small precomputed optical sprite atlas replaces square points,
  with a density/resolution cap and the existing frame-budget adaptation.

## Implementation contract

Native scroll directly drives the particle field and readable DOM text. The
original security forms, including the upright DNA-like evidence strands and wave,
are unchanged. Every chapter reaches its final shape by 12% scroll progress and
holds it through 54%, giving users time to read without automatic transitions.
Between chapters, stable particle identities disperse and reassemble along a
reversible trajectory that spans 58% of a chapter. The camera and the particles
freeze when the user stops scrolling; no delayed easing or idle movement remains.
The separately controlled opening and reduced-motion fallback remain intact.

Mobile artwork fits the space between the navigation and the measured reading
block. Text has no opaque backing surface. Reduced Motion renders readable DOM
directly. A renderer-loading failure releases all narrative content. High-density
desktop rendering reaches 3840 × 2160 on a capable DPR-2 viewport; weaker devices
retain lower budgets rather than loading a heavier 3D particle dependency.

`tests/particle-story.cjs` verifies initial suppression, five exact formed holds,
glyph dissolution, the particle-only gap, reverse scroll, final authentic-logo
arrival, touch/desktop reading safety, native 4K dimensions and Reduced Motion.


## October 16: reference light-field revision

The reference was re-examined at one-second intervals from the reattached film.
Its visible distinction is an organic luminous boundary, connected filaments,
real depth and a wave filling the lower viewport. Traced security icons did not
reproduce that visual language, and the former adaptation could decay to 900
points. The revised first five forms use parametric 3D surfaces: aperture,
intertwined evidence strands, wave, funnel and spiral disc. Copy remains semantic
DOM, emerging inside the aperture and above the wave. Product content and the
existing authentic-logo opening film are unchanged.

The existing field canvas now uses a small WebGL 1 renderer when available.
Emission is blurred in two separable quarter-resolution passes and added to the
field before sharp particles; no background element is placed over copy. Ambient
stars do not participate in bloom. Field projection, glyph dust, scroll clock
and particle identities remain shared. Density has a useful lower bound rather
than progressively disappearing. Reduced Motion lowers exposure and uses the
Canvas renderer on initial load. Context loss, shader failure and a missing
renderer recover the Canvas surface while preserving HTML controls and scroll.
GPU buffers, programs, framebuffers and textures are released on disposal.

Tests additionally cover the hollow reading volume, the lower wave composition,
context loss, a missing GPU renderer and WebGL unavailability. Full native scroll,
reverse choreography, final authentic-logo formation and transparent copy remain
required in both Chromium and WebKit.
