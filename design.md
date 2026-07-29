# luna-dialup — design notes

## Goal

A website meant to trigger one specific feeling: the nostalgia of
someone who, as a kid or teenager, sat up at night at a 90s computer,
telescope next to the desk, dialing into a modem under a starry sky
through the window. This is meant to be **a vibe, not an app with
features**. Music plays in the background (e.g. an old Donkey Kong OST —
the user will drop that in themselves), the visitor lands on the page and
gets "hit with the vibe."

We're not building a game or a tool. We're building a **living picture**
— a scene that breathes: the moon pulses, stars twinkle, a comet flies by
now and then, and something happens on the CRT screen (boot log → mini
desktop).

## Visual starting point

Reference: a 90s bedroom, a desk with a CRT computer, a telescope pointed
at the window, a full moon and starry sky outside, blue curtains printed
with planets. Photorealistic photo/render (not pixel art!) — an important
distinction, since it immediately rules out a "let's find some sprites"
approach. This is a photographic layer plus subtle animation on top.

Final base image: `scene.png` (2048×1152, generated in Flux), a simple
en-face framing, with a clear window on the right and the CRT screen
angled slightly to the left.

## Architecture: layers, not sprites

The whole scene is a stack of layers, back to front:

1. **Sky** (animated) — gradient + twinkling stars (canvas) + comet
2. **Scene photo** (`scene.png`, static) — room, desk, computer,
   telescope, curtains
3. **Live overlays** — moon glow (CSS blend), CRT screen content
   (Pixi.js)
4. **Film grain + vignette** — one shared layer ON TOP of everything, to
   unify the photo, animations, and screen into one coherent "recording"

**Key rule**: film grain is never baked into any layer individually —
it's always a single global layer on top. Otherwise different elements
(photo, sky, screen) would have mismatched, "drifting" grain and the
whole thing would stop reading as one recording.

The same rule applies to the vignette and any future color grading —
anything meant to unify the mood sits at the top of the stack as a
global layer.

### Why no window cutout (for now)

The telescope and curtain folds cross the window in the original photo,
so a full glass cutout (to let the animated sky glow through actual
glass) would require tedious masking around those elements. Instead we
use a "cheap trick": star twinkle + comet + moon glow are composited ON
TOP of the window baked into the photo, instead of cutting a hole. At
this level of darkness and grain the difference is unnoticeable. A real
cutout is a later option, only worth it if we want the moon/sky itself
to move.

## The CRT screen: the hardest part

This is the heart of the page's interactivity and took the most
iteration.

### Why a plain `clip-path`/rectangle wasn't enough

The screen in the photo is seen at an angle (a slight trapezoid), and
the physical CRT glass is convex — the edges actually bulge outward. A
flat rectangle (even with `clip-path`) never fits perfectly, and hand
-typing 8 percentage values "by eye" isn't practical.

A perspective `matrix3d` (corner-pin, 4 corners) solves the trapezoid,
but **mathematically always produces straight edges** — affine
projections of a rectangle can't bow.

### Solution: a Coons-patch mesh in Pixi.js

Instead of a flat CSS transform, the screen is rendered as an actual
mesh in Pixi (WebGL):

- The 4 corners (`CORNERS`) are set by hand and **stay exactly in
  place** — they define the trapezoid/perspective.
- Each of the 4 edges has its **own, independent bulge value**
  (`EDGE_BULGE = { top, right, bottom, left }`), because the camera
  looks at the screen at an angle: the edge "toward the camera" (left,
  here) is seen almost edge-on and its curvature is foreshortened away
  behind the bezel anyway — it has to stay nearly flat, or it looks
  wrong. The edge "facing the camera" (right) shows its bulge more
  clearly.
- Screen content (boot log, desktop) is rendered flat to a
  `RenderTexture`, then mapped onto the curved mesh as a texture — so
  scanlines, phosphor glow (`GlowFilter`), and lens curvature
  (`CRTFilter`) all follow the real shape of the glass.

### Calibration tool (built into the page)

Instead of guessing percentage values, **Calibrate mode** (button /
`c` key) lets you:
- drag the 4 handles (TL/TR/BR/BL) directly onto the glass corners in
  the photo, with arrow keys for fine adjustment (Shift = bigger step),
- press `1`/`2`/`3`/`4` to pick an edge (top/right/bottom/left), `0` for
  all at once,
- use `[`/`]` to shrink/grow the bulge of the selected edge, with a live
  preview (yellow outline + the real render),
- hit **Copy** to grab a ready-to-paste `CORNERS`/`EDGE_BULGE` block.

Calibrated values (from the calibration session, currently live in
`src/crt/config.ts`):

```ts
const CORNERS = [
  [0.3370, 0.4090], // TL
  [0.4592, 0.4107], // TR
  [0.4620, 0.5742], // BR
  [0.3418, 0.5901], // BL
];
const EDGE_BULGE = { top: 0.0020, right: 0.0040, bottom: 0.0020, left: 0.0000 };
```

This is the **single source of truth** for screen geometry — every
layer (background, content, effects) reads from these same values.

## Tech stack (decisions so far)

- **Vite + TypeScript**, no UI framework — the page is one animated
  scene with a render loop, not a stateful app, so a component
  framework (React/Vue) would add overhead without buying anything. The
  build output is still a static bundle: no app server.
- **Canvas 2D** for the twinkling stars (cheap, many instances).
- **CSS** for everything that can be: moon glow, comet, grain, vignette,
  the moon's "breathing" animation.
- **Pixi.js + pixi-filters** — ONLY for the CRT screen surface, because
  that's the one place that needs a real shader (`CRTFilter`: curvature,
  scanlines, chromatic aberration, noise; `GlowFilter`: phosphor glow)
  and an actual 3D mesh for the glass bulge. The rest of the page
  **deliberately stays on CSS** — Pixi is real weight, not worth pulling
  in for the whole scene when CSS gives the same effect more cheaply.
  - Installed as real npm dependencies (`pixi.js`, `pixi-filters`) and
    bundled by Vite, so the page works offline with no CDN dependency.
    Filters are imported from subpaths (`pixi-filters/crt`,
    `pixi-filters/glow`) so the bundler can tree-shake the rest of the
    filter pack.

## Scene artwork: how it was made

- Generated in **Flux** (not Midjourney — the user doesn't have access
  to it). Flux needs a different prompting style than Midjourney:
  natural, descriptive language instead of a keyword list, no
  `--ar`/`--no` support (aspect ratio is set in the UI/API), negative
  prompts barely work on base Flux — so anything we don't want gets
  described **positively** (e.g. instead of "no heavy grain" →
  "clean and crisp with only very light natural grain").
- **En-face** framing (straight-on) chosen deliberately, so overlays
  (screen, window) are easier to align.
- Grain in the generated image is meant to be **light/subtle** —
  a uniform, strong film grain is added later as a global CSS layer
  (see "Architecture" above). Heavy baked-in grain in the source would
  make it harder to match the animated layers later.

## Not done yet (next steps, roughly in order of value)

1. **"Click to enter" gate + sound.** Browsers block autoplay with
   audio — needs a full-screen splash screen (very on-vibe — like an
   old splash page) that kicks off the background music on first click.
   This is also the natural place for the modem sound (the project name
   is no accident: "luna-dialup").
   - ElevenLabs (a tool the user has) is a great fit for the sound
     effects: modem handshake, CRT power-on (click + high-pitched
     whine), ambient room tone, comet whoosh. ElevenLabs only generates
     audio — images still need a different tool (Flux/Midjourney/etc).
2. **Actual screen content.** Currently a placeholder: a boot log
   ("LUNA-DIALUP v0.9... CONNECT 56000") that transitions into a very
   simple desktop (a bar, a STARFIELD.EXE window, "stars", a clock). To
   figure out: should the screen stay purely decorative, or become
   interactive (clickable icons, mini "apps", a screensaver mode)?
3. **(Optional, later)** a real window cutout, if we want the moon/sky
   itself to move behind the glass, not just overlays on top.

## Repo file state

- `public/scene.png` — base scene photo (Flux, 2048×1152).
- `index.html` — Vite entry point; the DOM skeleton only, styling lives
  in `src/style.css` and behavior in `src/main.ts` and the modules it
  wires together.
- `src/` — the whole scene split into modules: `scene/` for the
  Pixi-independent background layers (stars, comet), `crt/` for
  everything screen-related (`config.ts` for geometry, `mesh.ts` for the
  Coons-patch math, `screen.ts` for the Pixi app, `calibration.ts` for
  the calibration UI). See [`CLAUDE.md`](CLAUDE.md) for the full
  breakdown.

This project used to be two parallel static HTML files (a plain-CSS
fallback and a Pixi-based active version) maintained by hand. It's now a
single Vite + TypeScript project — the CSS-only version was retired once
the module split made the Pixi version easy enough to work in directly.
