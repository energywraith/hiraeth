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

export function initSkyView(els: SkyViewElements): { open: (x: number, y: number) => void; close: () => void } {
  const ctx = els.canvas.getContext("2d");
  if (!ctx) return { open: () => {}, close: () => {} };
  const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  els.captionEl.textContent = CAPTION;

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
  let hoveredConstellation: Constellation | null = null;
  let zoomedConstellation: Constellation | null = null;

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

  function renderMoon(): void {
    const [fx, fy] = MOON.pos;
    const [x, y] = skyToScreen(toSkyX(fx), toSkyY(fy));
    const r = MOON.radius * viewScale;

    const glow = ctx!.createRadialGradient(x, y, 0, x, y, r * 2.6);
    glow.addColorStop(0, "rgba(214, 228, 255, 0.35)");
    glow.addColorStop(1, "rgba(214, 228, 255, 0)");
    ctx!.fillStyle = glow;
    ctx!.beginPath();
    ctx!.arc(x, y, r * 2.6, 0, Math.PI * 2);
    ctx!.fill();

    const disc = ctx!.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    disc.addColorStop(0, "#fdfdfa");
    disc.addColorStop(1, "#c9d2df");
    ctx!.fillStyle = disc;
    ctx!.beginPath();
    ctx!.arc(x, y, r, 0, Math.PI * 2);
    ctx!.fill();
  }

  function renderPlanet(): void {
    const [fx, fy] = PLANET.pos;
    const [x, y] = skyToScreen(toSkyX(fx), toSkyY(fy));
    const r = PLANET.radius * viewScale;

    ctx!.save();
    ctx!.translate(x, y);
    ctx!.rotate(PLANET.ringTilt);
    ctx!.strokeStyle = PLANET.ringColor;
    ctx!.lineWidth = 2 * viewScale;
    ctx!.beginPath();
    ctx!.ellipse(0, 0, r * 2.1, r * 0.6, 0, 0, Math.PI * 2);
    ctx!.stroke();
    ctx!.restore();

    ctx!.fillStyle = PLANET.color;
    ctx!.beginPath();
    ctx!.arc(x, y, r, 0, Math.PI * 2);
    ctx!.fill();
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

  function showConstellationInfo(c: Constellation): void {
    els.captionEl.innerHTML = `<strong>${c.name}</strong> — ${c.meaning}`;
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
    renderMoon();
    renderPlanet();
    for (const c of CONSTELLATIONS) drawConstellation(c, c === hoveredConstellation || c === zoomedConstellation);
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

  function zoomTo(c: Constellation): void {
    const { minX, minY, maxX, maxY } = constellationBBox(c);
    const bw = (maxX - minX) * ZOOM_PADDING;
    const bh = (maxY - minY) * ZOOM_PADDING;
    const fit = Math.min((innerWidth * ZOOM_FILL) / bw, (innerHeight * ZOOM_FILL) / bh);
    targetScale = Math.max(1, Math.min(MAX_ZOOM, fit));
    targetCX = (minX + maxX) / 2;
    targetCY = (minY + maxY) / 2;
    zoomedConstellation = c;
  }

  // Eases back out to plain (unscaled) parallax, resuming from wherever the
  // mouse currently sits rather than snapping to the sky's center.
  function zoomOut(): void {
    zoomedConstellation = null;
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

    if (!zoomedConstellation) {
      const maxX = Math.max(0, skyW - innerWidth);
      const maxY = Math.max(0, skyH - innerHeight);
      targetCX = innerWidth / 2 + (e.clientX / innerWidth) * maxX;
      targetCY = innerHeight / 2 + (e.clientY / innerHeight) * maxY;
    }

    const [skyX, skyY] = screenToSky(e.clientX, e.clientY);
    const hit = hitTestConstellation(skyX, skyY);
    els.canvas.style.cursor = hit ? "pointer" : "";
    hoveredConstellation = hit;
  }

  function onClick(e: MouseEvent): void {
    if (!isOpen) return;
    const [skyX, skyY] = screenToSky(e.clientX, e.clientY);
    const hit = hitTestConstellation(skyX, skyY);
    if (hit) {
      showConstellationInfo(hit);
      if (hit === zoomedConstellation) zoomOut();
      else zoomTo(hit);
    } else {
      showAmbientCaption();
      if (zoomedConstellation) zoomOut();
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
    hoveredConstellation = null;
    zoomedConstellation = null;
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
