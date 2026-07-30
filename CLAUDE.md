# CLAUDE.md

Project context for Claude Code. The full writeup of the vision and
design decisions lives in [`design.md`](design.md) — read that first if
you're making design decisions, not just technical ones.

## What this project is

`hiraeth` — a static vibe site: a nostalgic 90s bedroom with a CRT
computer and a telescope, background music (the user drops that in
themselves), twinkling stars, a breathing moon, an occasional comet, and
a live CRT screen rendered with Pixi.js. No backend — the build is Vite +
TypeScript, but the output (`npm run build`) is still a static
HTML/CSS/JS bundle with no app server.

## File structure

- `public/scene.png` — the base scene photo (2048×1152). Don't
  edit/regenerate it without asking the user — it's their chosen frame.
- `index.html` — Vite entry point. Loads `src/main.ts` and holds the
  static DOM skeleton (scene, calibration UI) — the actual visual layout
  lives in `src/style.css`.
- `src/main.ts` — orchestrator: wires up the scene, CRT screen, and
  calibration modules, owns `applyWarp()` (the one place that triggers
  both the calibration overlay update and the Pixi mesh rebuild).
- `src/calibrationView.ts` — scroll-to-zoom / drag-to-pan for `#scene`
  while any calibration tool (CRT/mask/hotspots) is active, needed for
  dense point clusters (e.g. the moon hotspot's 16-point circle) where
  handles sit too close together to grab at 1x. Applies a CSS transform
  to `#scene` itself; every calibration tool already reads coordinates
  via `getBoundingClientRect()` and sizes its SVG via
  `clientWidth`/`clientHeight`, so none of them needed changes to support
  this. Double-click resets the view.
- `src/style.css` — all scene styling (layers, grain, vignette,
  calibration UI).
- `src/scene/` — background layers that don't depend on Pixi:
  `starfield.ts` (twinkling stars on canvas), `comet.ts` (the occasional
  comet), `skyMask.ts` (the visible-through-the-window polygon both of
  those clip/sample against — see the section below), and
  `skyMaskCalibration.ts` (the drag-to-fit tool for that polygon).
- `src/audio/music.ts` — background music: `createLoopingMusic(url)`
  loads a track with the Web Audio API and crossfades the tail of each
  play-through into the head of the next, so an AI-generated track with
  no natural loop point still plays as one continuous piece. Started
  from the "click to enter" gate in `index.html` (`#gate`), since
  browsers block audio autoplay without a user gesture. Track lives at
  `public/luna-hiraeth.mp3` (ElevenLabs Music, ambient/nostalgic —
  same as `scene.png`, don't regenerate without asking).
- `src/crt/` — everything related to the CRT screen:
  - `config.ts` — the **single source of truth** for screen geometry
    (`CORNERS`, `EDGE_BULGE`), see the section below.
  - `mesh.ts` — pure grid math (Coons patch): `buildGrid()`.
  - `screen.ts` — the Pixi app: renders screen content (boot log →
    desktop) to a texture, applies the CRT/Glow filters, maps it onto
    the mesh.
  - `calibration.ts` — the calibration UI: dragging handles, keyboard
    shortcuts, the panel with the ready-to-paste code.
- `src/hotspots/` — clickable scene objects (telescope, moon, posters,
  computer, floppy disks), see the section below:
  - `config.ts` — the **single source of truth** for hotspot geometry
    (`HOTSPOTS`, one named polygon per object).
  - `interaction.ts` — renders the hover/click layer from `HOTSPOTS`.
  - `content.ts` — the title/body text each hotspot's overlay shows —
    the one file to edit to change the copy.
  - `overlay.ts` — the generic click-to-reveal modal, shared by every
    hotspot regardless of what it shows.
  - `calibration.ts` — the drag-to-fit tool for `HOTSPOTS`.
- `design.md` — full design notes from the sessions: why we made the
  choices we made, what was tried and rejected, what's next.

## Running locally

```bash
cd /Users/daysin/Documents/GitHub/hiraeth && npm install && npm run dev
```

Vite serves on `http://localhost:4173` (the port is set in
`vite.config.ts` to match the rest of the tooling). The dev server
config also lives in `.claude/launch.json` (name: `hiraeth`) — you can use
`preview_start` with the name `hiraeth`.

`npm run build` produces a static bundle in `dist/` (ready to drop on
any static file host — no changes needed, `pixi.js` and `pixi-filters`
are now bundled by the build, not loaded from a CDN at runtime).

## Key architectural rule: layers, not sprites

The scene is a stack of layers (back to front): animated sky →
`scene.png` → live overlays (moon glow, CRT screen) → **one global film
grain + vignette layer on top of everything** (`.grain`/`.vignette` in
`src/style.css`). Grain/vignette/color-grading are NEVER baked into a
layer individually — always applied globally on top, so the photo,
animations, and screen read as one recording. Don't break this rule when
adding new visual elements.

## The CRT screen — single source of truth for geometry

In [`src/crt/config.ts`](src/crt/config.ts):

```ts
export const CORNERS: Corners = [...];       // the 4 glass corners, as fractions (0-1) of the scene
export const EDGE_BULGE: EdgeBulge = {...};  // bulge for each edge, independently
```

This is the only module that defines the screen's fit. Don't add
parallel `clip-path`/percentage-based positions elsewhere — everything
(screen background, content, CRT effects, calibration overlay) must read
from these two values through `buildGrid()` in
[`src/crt/mesh.ts`](src/crt/mesh.ts). `src/crt/screen.ts` and
`src/crt/calibration.ts` both import `buildGrid` — neither computes
geometry on its own.

**Why not a plain `clip-path` or `matrix3d`:** the screen is seen at an
angle (a trapezoid), and the CRT glass is physically convex. A
rectangular `clip-path` doesn't fit a trapezoid; `matrix3d` (corner-pin)
solves the trapezoid but mathematically always produces straight edges.
Hence the mesh (Coons patch) in Pixi — 4 corners set by hand and fixed,
each edge with its own independent bulge (because the camera angle means
one edge can be nearly flat while the opposite one bulges visibly).

**Calibration mode** is built into the page — don't guess values by
hand, ask the user to use the tool:
- the **Calibrate** button or the `c` key,
- dragging the 4 handles (TL/TR/BR/BL) + arrow keys for fine nudges
  (Shift = bigger step),
- `1`/`2`/`3`/`4` = focus the top/right/bottom/left edge, `0` = all,
- `[`/`]` = less/more bulge on the focused edge,
- **Copy** generates a ready `CORNERS`/`EDGE_BULGE` block to paste into
  `src/crt/config.ts`.

## The sky mask — single source of truth for the visible window area

In [`src/scene/skyMask.ts`](src/scene/skyMask.ts):

```ts
export const SKY_MASK: Point[] = [...]; // concave polygon, fractions (0-1) of the scene
```

This is the only module that defines which part of the scene is "open sky
behind the glass." A plain rectangle doesn't fit: the curtains eat into
both sides of the window and the telescope physically crosses in front of
the glass, so the polygon is concave — it notches around the telescope's
tube and finder-scope bracket. `starfield.ts` rejection-samples star
positions against `pointInSkyMask()` (not just a bounding box) and both
`starfield.ts` and `comet.ts` apply `skyMaskClipPath()` to their layers.
Don't add a parallel clip region elsewhere — if the mask needs to change,
change it here.

**Mask calibration mode**, same idea as the CRT one, built into the page:
- the **Mask** button or the `m` key (mutually exclusive with **Calibrate**
  — only one tool's handles/panel show at a time),
- dragging the numbered handles (one per `SKY_MASK` point) + arrow keys
  for fine nudges (Shift = bigger step),
- **Copy** generates a ready `SKY_MASK` array to paste into
  `src/scene/skyMask.ts`, **Reset** restores the last-saved shape.

## Hotspots — single source of truth for clickable objects

In [`src/hotspots/config.ts`](src/hotspots/config.ts):

```ts
export const HOTSPOTS: Hotspot[] = [...]; // { id, label, points }, one polygon per clickable object
```

Same pattern as `SKY_MASK`/`CORNERS`: this is the only place hotspot
geometry is defined. `interaction.ts` renders one transparent `<button>`
per hotspot, `clip-path`-ed to its polygon — the clip-path both draws the
hover highlight (a `backdrop-filter: brightness()` glow scoped to that
shape) and narrows the button's own hit-testing, so no manual
point-in-polygon check is needed. Clicking a hotspot opens the shared
modal from `overlay.ts` with that hotspot's copy from `content.ts`. The
hotspots layer sits above the CRT screen but below
`.grain`/`.vignette` — same layering rule as everything else.

Note: `.grain`/`.vignette` need `pointer-events: none` for this to work,
since they're painted last and would otherwise swallow every click on
the scene. Keep that in mind if either gets restyled.

**Hotspot calibration mode**, same idea as CRT/mask calibration:
- the **Hotspots** button or the `h` key (mutually exclusive with
  **Calibrate**/**Mask**),
- pick which hotspot to edit from the dropdown or `Tab`/`Shift+Tab`,
- drag that hotspot's numbered dots (only the selected one gets handles;
  every hotspot's outline is drawn dim for context) + arrow keys for
  fine nudges (Shift = bigger step),
- **Copy** generates the full `HOTSPOTS` array to paste into
  `src/hotspots/config.ts`, **Reset** restores the last-saved shapes.

The current `HOTSPOTS` polygons are rough placeholders (a box around
each object) — fit them properly with the calibration tool before
relying on them.

## Pixi.js — only for the screen, not the whole scene

A deliberate decision: Pixi (+`pixi-filters`) is used ONLY to render the
CRT screen surface (mesh + `CRTFilter` + `GlowFilter`, both in
`src/crt/screen.ts`). The rest of the scene (stars, comet, moon glow,
grain) stays on plain CSS/canvas (`src/scene/`, `src/style.css`) — don't
move that to Pixi "for consistency", that was a deliberate page-weight
tradeoff.

Filters are imported from subpaths so the bundler can tree-shake the
rest of the package: `import { CRTFilter } from "pixi-filters/crt"`,
`import { GlowFilter } from "pixi-filters/glow"`.

## Verifying visual changes

This is a purely visual project — after any change in `src/`, check it
in the browser (Browser pane), not just by reading the code. Watch for:
- console errors (especially after changes to `src/crt/screen.ts`),
- whether the screen still fits inside the glass (no layer should stick
  out past the shape returned by `buildGrid()`),
- whether new elements break the "grain/vignette on top" rule.

## What's next (priorities from `design.md`)

1. The "click to enter" gate now exists (`#gate` in `index.html`,
   `src/audio/music.ts`) and kicks off looping background music on
   first click. Still missing: the modem-handshake sound on that same
   click, and a real track dropped at `public/music.mp3`.
2. Actual screen content (currently a placeholder: boot log → simple
   desktop) — grow `src/crt/screen.ts` or split a separate content
   module out of it if it gets big.
3. Optionally: a real window cutout, if the sky itself should move
   behind the glass, not just overlays on top.
4. Hotspots (`src/hotspots/`) exist for telescope/moon/posters/
   computer/floppy disks but the polygons are rough placeholders and the
   overlay copy in `content.ts` is placeholder flavor text — fit the
   shapes with the calibration tool (`h` key) and rewrite the copy.

## Collaboration style in this project

The user mixes Polish and English — reply in whatever language they use
in a given message. They prefer fast iteration with visual verification
(screenshots) over long explanations before changing code. They tune
numeric values (e.g. `CORNERS`, `EDGE_BULGE`) themselves, looking at the
image at full resolution — Claude's job is to provide the calibration
tool, not guess final values on the user's behalf. Don't treat this file
as fixed in stone — the priority is a well-kept, well-organized project;
update CLAUDE.md whenever the structure changes.

**Don't auto-commit.** Make and verify changes, then stop — the user
commits and pushes themselves when they're ready. Only commit/push when
they explicitly ask for it in that turn.
