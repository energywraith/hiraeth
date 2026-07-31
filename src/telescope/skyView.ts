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
const PAN_EASE = 0.06;

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

interface Star {
  x: number;
  y: number;
  r: number;
  alpha: number;
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

  let built = false;
  let skyW = 0;
  let skyH = 0;
  let contentW = 0;
  let contentH = 0;
  let contentOffsetX = 0;
  let contentOffsetY = 0;
  let stars: Star[] = [];

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

  // Star positions are rolled once (here) and kept stable in sky-space —
  // only their on-screen projection changes as the view pans/zooms, so they
  // don't jump or re-roll every frame.
  function generateStars(): void {
    const count = Math.round((skyW * skyH) / 4200);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * skyW,
      y: Math.random() * skyH,
      r: Math.random() * 0.9 + 0.3,
      alpha: Math.random() * 0.5 + 0.35,
    }));
  }

  function renderStars(): void {
    ctx!.fillStyle = "#eaf1ff";
    for (const s of stars) {
      const [x, y] = skyToScreen(s.x, s.y);
      ctx!.globalAlpha = s.alpha;
      ctx!.beginPath();
      ctx!.arc(x, y, s.r * viewScale, 0, Math.PI * 2);
      ctx!.fill();
    }
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

  function drawConstellation(c: Constellation, active: boolean): void {
    ctx!.strokeStyle = `rgba(155, 231, 189, ${active ? LINE_ALPHA_ACTIVE : LINE_ALPHA})`;
    ctx!.lineWidth = (active ? 1.4 : 1) * viewScale;
    ctx!.beginPath();
    for (const [a, b] of c.lines) {
      const [ax, ay] = c.stars[a];
      const [bx, by] = c.stars[b];
      ctx!.moveTo(...skyToScreen(toSkyX(ax), toSkyY(ay)));
      ctx!.lineTo(...skyToScreen(toSkyX(bx), toSkyY(by)));
    }
    ctx!.stroke();

    ctx!.fillStyle = "#eaf1ff";
    for (const [fx, fy] of c.stars) {
      const [x, y] = skyToScreen(toSkyX(fx), toSkyY(fy));
      ctx!.beginPath();
      ctx!.arc(x, y, (active ? STAR_RADIUS_ACTIVE : STAR_RADIUS) * viewScale, 0, Math.PI * 2);
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
  function render(): void {
    ctx!.fillStyle = "#050a14";
    ctx!.fillRect(0, 0, innerWidth, innerHeight);

    renderStars();
    renderMoon(hoveredTarget?.kind === "moon" || zoomedTarget?.kind === "moon");
    renderPlanet(hoveredTarget?.kind === "planet" || zoomedTarget?.kind === "planet");
    for (const c of CONSTELLATIONS) {
      const active = sameTarget(hoveredTarget, { kind: "constellation", c }) || sameTarget(zoomedTarget, { kind: "constellation", c });
      drawConstellation(c, active);
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
    generateStars();

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
  }

  // Eases back out to plain (unscaled) parallax, resuming from wherever the
  // mouse currently sits rather than snapping to the sky's center.
  function zoomOut(): void {
    zoomedTarget = null;
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

  function tick(): void {
    if (!isOpen) return;
    const ease = reduce ? 1 : PAN_EASE;
    viewCX += (targetCX - viewCX) * ease;
    viewCY += (targetCY - viewCY) * ease;
    viewScale += (targetScale - viewScale) * ease;
    render();
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
    generateStars();
    clampAmbientTarget();
    if (!isOpen) render();
  });
  els.canvas.addEventListener("click", onClick);
  els.closeBtn.addEventListener("click", close);

  return { open, close };
}
