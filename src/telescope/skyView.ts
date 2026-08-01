import { CAPTION, CONSTELLATIONS, MOON, PLANET, type Constellation } from "./constellations";

export interface SkyViewElements {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  closeBtn: HTMLButtonElement;
  captionEl: HTMLElement;
}

// skyW/skyH describe the "world" — how much bigger the virtual sky is than
// the viewport, giving the mouse parallax somewhere to actually go. They are
// NOT a canvas resolution: the canvas itself always stays viewport-sized
// (see sizeCanvas()) and everything in the world (stars, moon, planet,
// constellations) is re-projected into screen space and redrawn fresh every
// frame via skyToScreen() — cheap for this much content, and the only way
// both the ambient pan AND the click-to-zoom stay crisp at any scale. An
// earlier version drew once to a big pre-rasterized canvas and panned/zoomed
// it with a CSS transform; that's simpler but CSS-scaling a static bitmap
// blurs it the moment you zoom in, which is the whole point of the zoom.
const SKY_SCALE = 2.4;
// Time constant (ms) for the pan/zoom lerp — both ambient mouse parallax and
// click-to-zoom ease toward their target at this rate. Framerate-independent
// (see the dt-based use in tick()), unlike a flat per-frame multiplier,
// which quietly assumes 60fps and drifts on any other display. Raised from
// an earlier per-frame constant that worked out to ~270ms and read as a
// snap-to rather than a drift — everything else in the sky view (the 1.2s
// iris, the constellation spark) is slow on purpose, and the pan/zoom was
// the one thing still moving at a different, faster tempo.
const EASE_MS = 550;

// The aspect ratio CONSTELLATIONS/MOON/PLANET's fractional coordinates were
// laid out against. skyW/skyH follow the viewport's own (variable) aspect
// ratio to give the parallax room to pan, so drawing straight from fx*skyW/
// fy*skyH would stretch or squeeze every shape whenever a window's aspect
// ratio differs from whatever it was tuned on. Instead that content is
// mapped into a fixed-aspect box letterboxed inside skyW/skyH — content
// keeps its true proportions everywhere, and any leftover margin just shows
// plain starfield (stars are scattered across the full skyW/skyH regardless).
const CONTENT_ASPECT = 16 / 9;

// Clicking a constellation zooms/pans until its (padded) bounding box fills
// this fraction of the viewport's smaller dimension, up to MAX_ZOOM so a
// tiny or near-collinear shape doesn't zoom in absurdly far.
const ZOOM_FILL = 0.62;
const ZOOM_PADDING = 1.4;
const MAX_ZOOM = 6;

const LINE_ALPHA = 0.35;
const LINE_ALPHA_ACTIVE = 0.9;
const STAR_RADIUS = 1.6;
const STAR_RADIUS_ACTIVE = 2.4;
const LABEL_ALPHA = 0.75;
const LABEL_ALPHA_ACTIVE = 1;

// Capped devicePixelRatio for the canvas's backing resolution — uncapped,
// a 3x-DPR display would triple an already viewport-sized canvas for a
// sharpness gain past what's visible; 2x is already crisp.
const MAX_DPR = 2;

// How long the spark takes to run along a constellation's lines when you
// click it, and how long a shooting star lives. Both slow on purpose — the
// sky view was designed calm from the start (see design.md).
const REVEAL_SECONDS = 1.1;
const METEOR_SECONDS = 1.5;
const METEOR_GAP_MIN = 9000;
const METEOR_GAP_MAX = 24000;

interface Star {
  x: number;
  y: number;
  r: number;
  alpha: number;
  /** Twinkle phase and speed. A star with `glow` also gets a soft halo. */
  tw: number;
  tws: number;
  glow: boolean;
}

// Fraction of the primary (non-band) star count that gets pulled out into
// the animated `stars` overlay (see generateHighlightStars) instead of the
// baked world canvas — see the worldCanvas comment below for why.
const HIGHLIGHT_FRACTION = 0.14;

interface Meteor {
  x: number;
  y: number;
  dx: number;
  dy: number;
  len: number;
  /** 0-1 across METEOR_SECONDS. */
  t: number;
}

// A clickable thing in the sky view: one of the named constellations, or
// the moon/planet (each a single point rather than a star+line shape, so
// they're hit-tested and zoomed differently, but share the same hover/
// click/caption/zoom behavior via this union).
type Target = { kind: "constellation"; c: Constellation } | { kind: "moon" } | { kind: "planet" };

function sameTarget(a: Target | null, b: Target | null): boolean {
  if (!a || !b) return a === b;
  if (a.kind !== b.kind) return false;
  return a.kind === "constellation" && b.kind === "constellation" ? a.c === b.c : true;
}

export function initSkyView(els: SkyViewElements): { open: (x: number, y: number) => void; close: () => void } {
  const ctx = els.canvas.getContext("2d");
  if (!ctx) return { open: () => {}, close: () => {} };
  const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  els.captionEl.textContent = CAPTION;

  // Real art (public/moon.png, public/saturn.png) instead of procedural
  // canvas shapes. Kicked off here so loading starts as soon as the module
  // runs, not on first open(). render() guards on naturalWidth so a frame
  // drawn before either finishes loading just skips it rather than throwing.
  const moonImg = new Image();
  moonImg.src = `${import.meta.env.BASE_URL}moon.png`;
  const planetImg = new Image();
  planetImg.src = `${import.meta.env.BASE_URL}saturn.png`;

  // The static majority of the sky — nebulas plus most stars — painted once
  // per build/resize instead of every frame. On a typical viewport that's
  // several thousand stars (star count scales with world area, ~skyW*skyH);
  // redrawing all of them individually every frame was the main cost behind
  // the sky view feeling laggy. Baking them into one offscreen canvas turns
  // that into a single drawImage() per frame in render(). Only a small
  // animated subset (see `stars` below, ~HIGHLIGHT_FRACTION of the total)
  // still needs a per-frame draw, for twinkle and the halo glow.
  const worldCanvas = document.createElement("canvas");

  // One small radial-gradient sprite, drawn once and stamped per star. Real
  // per-star gradients would mean thousands of createRadialGradient calls a
  // frame — this covers both the highlight stars below and the meteor.
  const glowSprite = document.createElement("canvas");
  glowSprite.width = glowSprite.height = 32;
  {
    const gctx = glowSprite.getContext("2d");
    if (gctx) {
      const grd = gctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grd.addColorStop(0, "rgba(234, 241, 255, 0.55)");
      grd.addColorStop(0.35, "rgba(214, 228, 255, 0.16)");
      grd.addColorStop(1, "rgba(214, 228, 255, 0)");
      gctx.fillStyle = grd;
      gctx.fillRect(0, 0, 32, 32);
    }
  }

  let built = false;
  let skyW = 0;
  let skyH = 0;
  let contentW = 0;
  let contentH = 0;
  let contentOffsetX = 0;
  let contentOffsetY = 0;
  let stars: Star[] = [];
  let meteor: Meteor | null = null;
  let nextMeteorAt = 0;
  // 0-1 spark progress along the clicked constellation's lines.
  let reveal = 0;

  // The sky-space point currently centered on screen, and the current zoom
  // scale — ambient parallax is just this at scale 1; clicking a
  // constellation eases both toward its bounding-box center/fit scale.
  // Screen point = viewScale * (skyPoint - viewCenter) + screenCenter, see
  // skyToScreen().
  let viewCX = 0;
  let viewCY = 0;
  let viewScale = 1;
  let targetCX = 0;
  let targetCY = 0;
  let targetScale = 1;

  let lastClientX = innerWidth / 2;
  let lastClientY = innerHeight / 2;
  let hoveredTarget: Target | null = null;
  let zoomedTarget: Target | null = null;

  let isOpen = false;
  let rafId: number | null = null;
  let originX = innerWidth / 2;
  let originY = innerHeight / 2;

  // Sizes the canvas to the viewport at a crisp backing resolution. Called
  // on build and on resize — the canvas never needs to grow past the
  // viewport since content is projected fresh every frame, not baked in.
  function sizeCanvas(): void {
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    els.canvas.width = Math.round(innerWidth * dpr);
    els.canvas.height = Math.round(innerHeight * dpr);
    els.canvas.style.width = `${innerWidth}px`;
    els.canvas.style.height = `${innerHeight}px`;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Sky-space -> screen-space at the CURRENT (not target) view, so it stays
  // correct mid-animation, not just once a pan/zoom settles.
  function skyToScreen(sx: number, sy: number): [number, number] {
    return [(sx - viewCX) * viewScale + innerWidth / 2, (sy - viewCY) * viewScale + innerHeight / 2];
  }
  function screenToSky(clientX: number, clientY: number): [number, number] {
    return [(clientX - innerWidth / 2) / viewScale + viewCX, (clientY - innerHeight / 2) / viewScale + viewCY];
  }

  // Maps content-space fractions (0-1, laid out against CONTENT_ASPECT) into
  // sky-space — see the CONTENT_ASPECT comment above.
  function toSkyX(fx: number): number {
    return contentOffsetX + fx * contentW;
  }
  function toSkyY(fy: number): number {
    return contentOffsetY + fy * contentH;
  }

  // A diagonal band across the world biasing both the baked and the
  // highlight star passes below — the Milky Way. Being able to find it is
  // half of what makes a first look through a telescope land, and it costs
  // nothing but a biased sample. Shared so the two passes agree on where it
  // runs; each call still rolls its own point along it.
  function bandAt(t: number): [number, number] {
    return [t * skyW, skyH * (0.78 - t * 0.45) + (Math.random() - 0.5) * skyH * 0.22];
  }

  // Bakes nebulas plus the static majority of the starfield into
  // worldCanvas — see the worldCanvas comment above. Called once per
  // build/resize, never per frame.
  function bakeWorld(): void {
    worldCanvas.width = skyW;
    worldCanvas.height = skyH;
    const wctx = worldCanvas.getContext("2d");
    if (!wctx) return;

    // Soft violet/blue clouds along the band. Only a handful, so these can
    // stay real gradients rather than a stamped sprite — this only runs on
    // build/resize, not per frame.
    for (let i = 0; i < 5; i++) {
      const [x, y] = bandAt((i + 0.5) / 5);
      const r = skyH * (0.22 + Math.random() * 0.16);
      const grd = wctx.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, i % 2 ? "rgba(96, 118, 200, 0.055)" : "rgba(132, 104, 190, 0.05)");
      grd.addColorStop(1, "rgba(0, 0, 0, 0)");
      wctx.fillStyle = grd;
      wctx.beginPath();
      wctx.arc(x, y, r, 0, Math.PI * 2);
      wctx.fill();
    }

    const count = Math.round((skyW * skyH) / 4200);
    const bandCount = Math.round(count * 0.45);
    wctx.fillStyle = "#eaf1ff";
    for (let i = 0; i < count + bandCount; i++) {
      const inBand = i >= count;
      // The highlight fraction of the primary stars is drawn separately
      // (generateHighlightStars) so it can animate — skip it here so it
      // doesn't also get a static copy baked in underneath.
      if (!inBand && Math.random() < HIGHLIGHT_FRACTION) continue;
      const [x, y] = inBand ? bandAt(Math.random()) : [Math.random() * skyW, Math.random() * skyH];
      const r = inBand ? Math.random() * 0.5 + 0.2 : Math.random() * 0.9 + 0.3;
      wctx.globalAlpha = inBand ? Math.random() * 0.3 + 0.14 : Math.random() * 0.5 + 0.35;
      wctx.beginPath();
      wctx.arc(x, y, r, 0, Math.PI * 2);
      wctx.fill();
    }
    wctx.globalAlpha = 1;
  }

  // The small subset of stars that keeps animating every frame (twinkle + a
  // halo) — everything else lives in the baked worldCanvas instead. Rolled
  // independently from bakeWorld's skip check, so this doesn't reproduce the
  // exact same stars it skipped, just the same rough density.
  function generateHighlightStars(): void {
    const count = Math.round((skyW * skyH) / 4200);
    const highlightCount = Math.round(count * HIGHLIGHT_FRACTION);
    stars = Array.from({ length: highlightCount }, () => ({
      x: Math.random() * skyW,
      y: Math.random() * skyH,
      r: Math.random() * 0.9 + 0.3,
      alpha: Math.random() * 0.5 + 0.35,
      tw: Math.random() * 6.28,
      tws: Math.random() * 0.0016 + 0.0005,
      glow: true,
    }));
  }

  function renderStars(t: number): void {
    ctx!.fillStyle = "#eaf1ff";
    for (const s of stars) {
      const [x, y] = skyToScreen(s.x, s.y);
      const a = reduce ? s.alpha : s.alpha * (0.62 + 0.38 * Math.sin(s.tw + t * s.tws));
      ctx!.globalAlpha = a;
      const g = s.r * viewScale * 9;
      ctx!.drawImage(glowSprite, x - g, y - g, g * 2, g * 2);
      ctx!.beginPath();
      ctx!.arc(x, y, s.r * viewScale, 0, Math.PI * 2);
      ctx!.fill();
    }
    ctx!.globalAlpha = 1;
  }

  // A wish, once every 9-24 seconds. Spawned in sky-space near the current
  // view so it's actually on screen wherever the parallax has wandered to.
  function spawnMeteor(now: number): void {
    const angle = Math.PI * (0.15 + Math.random() * 0.2);
    meteor = {
      x: viewCX + (Math.random() - 0.7) * innerWidth,
      y: viewCY - innerHeight * (0.15 + Math.random() * 0.35),
      dx: Math.cos(angle),
      dy: Math.sin(angle),
      len: innerWidth * (0.22 + Math.random() * 0.2),
      t: 0,
    };
    nextMeteorAt = now + METEOR_GAP_MIN + Math.random() * (METEOR_GAP_MAX - METEOR_GAP_MIN);
  }

  function renderMeteor(): void {
    if (!meteor) return;
    // Fades in over the first fifth of its life and out over the rest, so it
    // never pops into or out of existence.
    const fade = Math.min(1, meteor.t * 5) * (1 - meteor.t) ** 1.5;
    const travel = meteor.t * meteor.len * 1.6;
    const hx = meteor.x + meteor.dx * travel;
    const hy = meteor.y + meteor.dy * travel;
    const [x, y] = skyToScreen(hx, hy);
    const tailLen = meteor.len * 0.5 * viewScale;
    const tx = x - meteor.dx * tailLen;
    const ty = y - meteor.dy * tailLen;

    const grd = ctx!.createLinearGradient(x, y, tx, ty);
    grd.addColorStop(0, `rgba(238, 245, 255, ${0.85 * fade})`);
    grd.addColorStop(1, "rgba(207, 228, 255, 0)");
    ctx!.strokeStyle = grd;
    ctx!.lineWidth = 1.8 * Math.min(2, viewScale);
    ctx!.lineCap = "round";
    ctx!.beginPath();
    ctx!.moveTo(x, y);
    ctx!.lineTo(tx, ty);
    ctx!.stroke();

    ctx!.globalAlpha = fade;
    const g = 10 * Math.min(2, viewScale);
    ctx!.drawImage(glowSprite, x - g, y - g, g * 2, g * 2);
    ctx!.globalAlpha = 1;
  }

  // Draws `img` centered at (x, y), preserving its aspect ratio, sized so
  // its width is 2*halfWidth. Skips silently if the sprite hasn't loaded
  // yet — see the moonImg/planetImg comment above.
  function drawSprite(img: HTMLImageElement, x: number, y: number, halfWidth: number): void {
    if (!img.naturalWidth) return;
    const w = halfWidth * 2;
    const h = w * (img.naturalHeight / img.naturalWidth);
    ctx!.drawImage(img, x - w / 2, y - h / 2, w, h);
  }

  function renderMoon(active: boolean): void {
    const [fx, fy] = MOON.pos;
    const [x, y] = skyToScreen(toSkyX(fx), toSkyY(fy));
    const r = MOON.radius * viewScale;

    const glow = ctx!.createRadialGradient(x, y, 0, x, y, r * 1.8);
    glow.addColorStop(0, `rgba(214, 228, 255, ${active ? 0.28 : 0.16})`);
    glow.addColorStop(1, "rgba(214, 228, 255, 0)");
    ctx!.fillStyle = glow;
    ctx!.beginPath();
    ctx!.arc(x, y, r * 2.6, 0, Math.PI * 2);
    ctx!.fill();

    drawSprite(moonImg, x, y, r);

    if (active) {
      ctx!.strokeStyle = "rgba(155, 231, 189, 0.7)";
      ctx!.lineWidth = 1.5;
      ctx!.beginPath();
      ctx!.arc(x, y, r + 6, 0, Math.PI * 2);
      ctx!.stroke();
    }
  }

  function renderPlanet(active: boolean): void {
    const [fx, fy] = PLANET.pos;
    const [x, y] = skyToScreen(toSkyX(fx), toSkyY(fy));
    // Rings included, matching the r*2.1 half-width hit-testing/zoom already
    // use (see PLANET.radius's comment in constellations.ts).
    const extent = PLANET.radius * viewScale * 2.1;

    drawSprite(planetImg, x, y, extent);

    if (active) {
      ctx!.strokeStyle = "rgba(155, 231, 189, 0.7)";
      ctx!.lineWidth = 1.5;
      ctx!.beginPath();
      ctx!.arc(x, y, extent + 8, 0, Math.PI * 2);
      ctx!.stroke();
    }
  }

  // Distance from point p to segment ab — used for line click/hover
  // hit-testing (star hit-testing is just a radius check). Both operate in
  // sky-space, so hit tolerance naturally grows on screen as you zoom in.
  function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  const STAR_HIT_RADIUS = 12;
  const LINE_HIT_RADIUS = 9;

  function hitTestConstellation(skyX: number, skyY: number): Constellation | null {
    for (const c of CONSTELLATIONS) {
      for (const [fx, fy] of c.stars) {
        if (Math.hypot(toSkyX(fx) - skyX, toSkyY(fy) - skyY) <= STAR_HIT_RADIUS) return c;
      }
      for (const [a, b] of c.lines) {
        const [ax, ay] = c.stars[a];
        const [bx, by] = c.stars[b];
        if (distToSegment(skyX, skyY, toSkyX(ax), toSkyY(ay), toSkyX(bx), toSkyY(by)) <= LINE_HIT_RADIUS) return c;
      }
    }
    return null;
  }

  const BODY_HIT_PAD = 10;

  // Moon/planet are single points with a screen-pixel-based radius (not
  // sky-space, unlike constellation stars), so they're hit-tested directly
  // in screen space against the mouse's client coordinates rather than via
  // screenToSky() first.
  function hitTestBody(clientX: number, clientY: number): "moon" | "planet" | null {
    const [mx, my] = skyToScreen(toSkyX(MOON.pos[0]), toSkyY(MOON.pos[1]));
    if (Math.hypot(clientX - mx, clientY - my) <= MOON.radius * viewScale + BODY_HIT_PAD) return "moon";

    const [px, py] = skyToScreen(toSkyX(PLANET.pos[0]), toSkyY(PLANET.pos[1]));
    if (Math.hypot(clientX - px, clientY - py) <= PLANET.radius * 2.1 * viewScale + BODY_HIT_PAD) return "planet";

    return null;
  }

  function hitTest(clientX: number, clientY: number): Target | null {
    const body = hitTestBody(clientX, clientY);
    if (body) return { kind: body };
    const [skyX, skyY] = screenToSky(clientX, clientY);
    const c = hitTestConstellation(skyX, skyY);
    return c ? { kind: "constellation", c } : null;
  }

  function constellationBBox(c: Constellation): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [fx, fy] of c.stars) {
      const x = toSkyX(fx);
      const y = toSkyY(fy);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    return { minX, minY, maxX, maxY };
  }

  function showAmbientCaption(): void {
    els.captionEl.textContent = CAPTION;
    els.captionEl.classList.remove("showing-meaning");
  }

  function showTargetInfo(t: Target): void {
    const { name, meaning } = t.kind === "constellation" ? t.c : t.kind === "moon" ? MOON : PLANET;
    els.captionEl.innerHTML = `<strong>${name}</strong> — ${meaning}`;
    els.captionEl.classList.add("showing-meaning");
  }

  // `progress` is how far the bright "spark" has run along this
  // constellation's lines (1 = fully lit, only ever < 1 for the one you just
  // clicked). The dim base shape is always drawn underneath, so the reveal
  // reads as the constellation lighting up rather than being drawn from
  // nothing — you can still see where it's going before it gets there, which
  // is the difference between magic and a loading bar.
  function drawConstellation(c: Constellation, active: boolean, progress: number): void {
    const pts = c.stars.map(([fx, fy]) => skyToScreen(toSkyX(fx), toSkyY(fy)));

    ctx!.strokeStyle = `rgba(155, 231, 189, ${LINE_ALPHA})`;
    ctx!.lineWidth = viewScale;
    ctx!.beginPath();
    for (const [a, b] of c.lines) {
      ctx!.moveTo(...pts[a]);
      ctx!.lineTo(...pts[b]);
    }
    ctx!.stroke();

    // How far along the chain each star sits, so stars light up as the spark
    // reaches them instead of all at once.
    const reached = new Set<number>();
    if (active) {
      const lens = c.lines.map(([a, b]) => Math.hypot(pts[b][0] - pts[a][0], pts[b][1] - pts[a][1]));
      const total = lens.reduce((s, l) => s + l, 0) || 1;
      let walked = progress * total;

      ctx!.strokeStyle = `rgba(155, 231, 189, ${LINE_ALPHA_ACTIVE})`;
      ctx!.lineWidth = 1.4 * viewScale;
      ctx!.lineCap = "round";
      ctx!.beginPath();
      for (let i = 0; i < c.lines.length && walked > 0; i++) {
        const [a, b] = c.lines[i];
        const f = Math.min(1, walked / (lens[i] || 1));
        ctx!.moveTo(...pts[a]);
        ctx!.lineTo(pts[a][0] + (pts[b][0] - pts[a][0]) * f, pts[a][1] + (pts[b][1] - pts[a][1]) * f);
        reached.add(a);
        if (f >= 1) reached.add(b);
        walked -= lens[i];
      }
      ctx!.stroke();
    }

    for (let i = 0; i < pts.length; i++) {
      const lit = reached.has(i);
      const r = (lit ? STAR_RADIUS_ACTIVE : STAR_RADIUS) * viewScale;
      if (lit) {
        const g = r * 5;
        ctx!.drawImage(glowSprite, pts[i][0] - g, pts[i][1] - g, g * 2, g * 2);
      }
      ctx!.fillStyle = "#eaf1ff";
      ctx!.beginPath();
      ctx!.arc(pts[i][0], pts[i][1], r, 0, Math.PI * 2);
      ctx!.fill();
    }

    // Label stays a fixed screen size — a readable HUD tag, not something
    // that should balloon along with the zoom the way the stars/lines do.
    const [lx, ly] = c.stars[c.labelAt];
    const [labelX, labelY] = skyToScreen(toSkyX(lx), toSkyY(ly));
    ctx!.font = "italic 15px Georgia, 'Times New Roman', serif";
    ctx!.fillStyle = `rgba(155, 231, 189, ${active ? LABEL_ALPHA_ACTIVE : LABEL_ALPHA})`;
    ctx!.fillText(c.name, labelX + 12, labelY - 8);
  }

  // The single per-frame draw — see the SKY_SCALE comment for why
  // everything is redrawn fresh in screen-space rather than pre-rasterized
  // and CSS-transformed.
  function render(t = 0): void {
    ctx!.fillStyle = "#050a14";
    ctx!.fillRect(0, 0, innerWidth, innerHeight);

    // The baked majority of the sky, blitted as one image at the current
    // pan/zoom — see the worldCanvas comment above. skyToScreen is a pure
    // scale+translate (no rotation), so the whole canvas maps to a single
    // destination rect.
    const [wx, wy] = skyToScreen(0, 0);
    ctx!.drawImage(worldCanvas, wx, wy, skyW * viewScale, skyH * viewScale);

    renderStars(t);
    renderMeteor();
    renderMoon(hoveredTarget?.kind === "moon" || zoomedTarget?.kind === "moon");
    renderPlanet(hoveredTarget?.kind === "planet" || zoomedTarget?.kind === "planet");
    for (const c of CONSTELLATIONS) {
      const target: Target = { kind: "constellation", c };
      const clicked = sameTarget(zoomedTarget, target);
      const active = sameTarget(hoveredTarget, target) || clicked;
      // Only the clicked one animates its spark; hovering lights the shape
      // straight away, so pointing at things stays responsive.
      drawConstellation(c, active, clicked ? reveal : 1);
    }
  }

  function measureWorld(): void {
    skyW = Math.round(innerWidth * SKY_SCALE);
    skyH = Math.round(innerHeight * SKY_SCALE);

    if (skyW / skyH > CONTENT_ASPECT) {
      contentH = skyH;
      contentW = skyH * CONTENT_ASPECT;
    } else {
      contentW = skyW;
      contentH = skyW / CONTENT_ASPECT;
    }
    contentOffsetX = (skyW - contentW) / 2;
    contentOffsetY = (skyH - contentH) / 2;
  }

  function build(): void {
    measureWorld();
    sizeCanvas();
    bakeWorld();
    generateHighlightStars();

    // Start centered on the virtual sky, mouse parallax adjusts from here.
    viewCX = targetCX = skyW / 2;
    viewCY = targetCY = skyH / 2;
    viewScale = targetScale = 1;
    render();

    built = true;
  }

  function clampAmbientTarget(): void {
    const maxX = Math.max(0, skyW - innerWidth);
    const maxY = Math.max(0, skyH - innerHeight);
    targetCX = Math.min(innerWidth / 2 + maxX, Math.max(innerWidth / 2, targetCX));
    targetCY = Math.min(innerHeight / 2 + maxY, Math.max(innerHeight / 2, targetCY));
  }

  function zoomTo(t: Target): void {
    if (t.kind === "constellation") {
      const { minX, minY, maxX, maxY } = constellationBBox(t.c);
      const bw = (maxX - minX) * ZOOM_PADDING;
      const bh = (maxY - minY) * ZOOM_PADDING;
      const fit = Math.min((innerWidth * ZOOM_FILL) / bw, (innerHeight * ZOOM_FILL) / bh);
      targetScale = Math.max(1, Math.min(MAX_ZOOM, fit));
      targetCX = (minX + maxX) / 2;
      targetCY = (minY + maxY) / 2;
    } else {
      const body = t.kind === "moon" ? MOON : PLANET;
      // The planet's rings (r*2.1) count toward its "size" for framing, the
      // moon has no rings so its plain radius is used as-is.
      const bodyRadiusPx = t.kind === "planet" ? PLANET.radius * 2.1 : MOON.radius;
      const desiredRadius = (Math.min(innerWidth, innerHeight) / 2) * ZOOM_FILL;
      targetScale = Math.max(1, Math.min(MAX_ZOOM, desiredRadius / (bodyRadiusPx * ZOOM_PADDING)));
      targetCX = toSkyX(body.pos[0]);
      targetCY = toSkyY(body.pos[1]);
    }
    zoomedTarget = t;
    // Only constellations have lines for the spark to run along.
    reveal = t.kind === "constellation" ? 0 : 1;
  }

  // Eases back out to plain (unscaled) parallax, resuming from wherever the
  // mouse currently sits rather than snapping to the sky's center.
  function zoomOut(): void {
    zoomedTarget = null;
    reveal = 1;
    targetScale = 1;
    const maxX = Math.max(0, skyW - innerWidth);
    const maxY = Math.max(0, skyH - innerHeight);
    targetCX = innerWidth / 2 + (lastClientX / innerWidth) * maxX;
    targetCY = innerHeight / 2 + (lastClientY / innerHeight) * maxY;
    clampAmbientTarget();
  }

  function onMouseMove(e: MouseEvent): void {
    if (!isOpen) return;
    lastClientX = e.clientX;
    lastClientY = e.clientY;

    if (!zoomedTarget) {
      const maxX = Math.max(0, skyW - innerWidth);
      const maxY = Math.max(0, skyH - innerHeight);
      targetCX = innerWidth / 2 + (e.clientX / innerWidth) * maxX;
      targetCY = innerHeight / 2 + (e.clientY / innerHeight) * maxY;
    }

    const hit = hitTest(e.clientX, e.clientY);
    els.canvas.style.cursor = hit ? "pointer" : "";
    hoveredTarget = hit;
  }

  function onClick(e: MouseEvent): void {
    if (!isOpen) return;
    const hit = hitTest(e.clientX, e.clientY);
    if (hit) {
      showTargetInfo(hit);
      if (sameTarget(hit, zoomedTarget)) zoomOut();
      else zoomTo(hit);
    } else {
      showAmbientCaption();
      if (zoomedTarget) zoomOut();
    }
  }

  let lastFrame = 0;

  function tick(now: number): void {
    if (!isOpen) return;
    const dt = lastFrame ? Math.min(now - lastFrame, 50) : 16;
    lastFrame = now;

    const ease = reduce ? 1 : 1 - Math.exp(-dt / EASE_MS);
    viewCX += (targetCX - viewCX) * ease;
    viewCY += (targetCY - viewCY) * ease;
    viewScale += (targetScale - viewScale) * ease;

    if (reveal < 1) reveal = Math.min(1, reveal + dt / (REVEAL_SECONDS * 1000));

    if (meteor) {
      meteor.t += dt / (METEOR_SECONDS * 1000);
      if (meteor.t >= 1) meteor = null;
    } else if (!reduce && now >= nextMeteorAt) {
      spawnMeteor(now);
    }

    render(now);
    rafId = requestAnimationFrame(tick);
  }

  function coveringRadius(x: number, y: number): number {
    const corners: [number, number][] = [
      [0, 0],
      [innerWidth, 0],
      [0, innerHeight],
      [innerWidth, innerHeight],
    ];
    let max = 0;
    for (const [cx, cy] of corners) max = Math.max(max, Math.hypot(cx - x, cy - y));
    return max + 40;
  }

  function open(x: number, y: number): void {
    if (!built) build();
    clampAmbientTarget();
    originX = x;
    originY = y;
    isOpen = true;
    lastFrame = 0;
    meteor = null;
    // A short grace period so the first wish doesn't fly by while the iris is
    // still opening.
    nextMeteorAt = performance.now() + 3000 + Math.random() * 5000;

    const radius = coveringRadius(x, y);
    els.root.style.clipPath = `circle(0px at ${x}px ${y}px)`;
    els.root.classList.add("open");
    if (reduce) {
      els.root.style.clipPath = `circle(${radius}px at ${x}px ${y}px)`;
    } else {
      // Two rAFs: the first commits the 0px starting state to a rendered
      // frame, the second changes it — otherwise the browser can coalesce
      // both writes into one frame and the CSS transition never triggers.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          els.root.style.clipPath = `circle(${radius}px at ${x}px ${y}px)`;
        });
      });
    }

    if (rafId === null) rafId = requestAnimationFrame(tick);
  }

  function close(): void {
    if (!isOpen) return;
    isOpen = false;
    els.root.classList.remove("open");
    els.root.style.clipPath = `circle(0px at ${originX}px ${originY}px)`;
    els.canvas.style.cursor = "";
    hoveredTarget = null;
    zoomedTarget = null;
    meteor = null;
    reveal = 1;
    targetScale = 1;
    showAmbientCaption();
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  addEventListener("mousemove", onMouseMove);
  addEventListener("resize", () => {
    if (!built) return;
    measureWorld();
    sizeCanvas();
    bakeWorld();
    generateHighlightStars();
    clampAmbientTarget();
    if (!isOpen) render();
  });
  els.canvas.addEventListener("click", onClick);
  els.closeBtn.addEventListener("click", close);

  return { open, close };
}
