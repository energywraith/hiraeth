import { CAPTION, CONSTELLATIONS, MOON, PLANET, type Constellation } from "./constellations";

export interface SkyViewElements {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  closeBtn: HTMLButtonElement;
  captionEl: HTMLElement;
}

// How much bigger the virtual sky is than the viewport — gives the mouse
// parallax somewhere to actually go. Purely visual/decorative content (see
// ./constellations.ts), drawn once to a big static canvas and panned via a
// single CSS transform rather than redrawn per frame — cheap, and reads
// calmer than the twinkling ambient background stars.
const SKY_SCALE = 2.4;
const PAN_EASE = 0.06;

// The aspect ratio CONSTELLATIONS/MOON/PLANET's fractional coordinates were
// laid out against. skyW/skyH follow the viewport's own (variable) aspect
// ratio to give the parallax room to pan, so drawing straight from fx*skyW/
// fy*skyH would stretch or squeeze every shape whenever a window's aspect
// ratio differs from whatever it was tuned on. Instead that content is
// mapped into a fixed-aspect box letterboxed inside skyW/skyH — content
// keeps its true proportions everywhere, and any leftover margin just shows
// plain starfield (drawStars already fills the full skyW/skyH regardless).
const CONTENT_ASPECT = 16 / 9;

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
  let panX = 0;
  let panY = 0;
  let targetX = 0;
  let targetY = 0;
  let isOpen = false;
  let rafId: number | null = null;
  let originX = innerWidth / 2;
  let originY = innerHeight / 2;

  function drawStars(): void {
    const count = Math.round((skyW * skyH) / 4200);
    for (let i = 0; i < count; i++) {
      const x = Math.random() * skyW;
      const y = Math.random() * skyH;
      const r = Math.random() * 0.9 + 0.3;
      ctx!.globalAlpha = Math.random() * 0.5 + 0.35;
      ctx!.fillStyle = "#eaf1ff";
      ctx!.beginPath();
      ctx!.arc(x, y, r, 0, Math.PI * 2);
      ctx!.fill();
    }
    ctx!.globalAlpha = 1;
  }

  // Maps content-space fractions (0-1, laid out against CONTENT_ASPECT) into
  // sky canvas pixels — see the CONTENT_ASPECT comment above.
  function toSkyX(fx: number): number {
    return contentOffsetX + fx * contentW;
  }
  function toSkyY(fy: number): number {
    return contentOffsetY + fy * contentH;
  }

  function drawMoon(): void {
    const [fx, fy] = MOON.pos;
    const x = toSkyX(fx);
    const y = toSkyY(fy);
    const glow = ctx!.createRadialGradient(x, y, 0, x, y, MOON.radius * 2.6);
    glow.addColorStop(0, "rgba(214, 228, 255, 0.35)");
    glow.addColorStop(1, "rgba(214, 228, 255, 0)");
    ctx!.fillStyle = glow;
    ctx!.beginPath();
    ctx!.arc(x, y, MOON.radius * 2.6, 0, Math.PI * 2);
    ctx!.fill();

    const disc = ctx!.createRadialGradient(x - MOON.radius * 0.3, y - MOON.radius * 0.3, MOON.radius * 0.1, x, y, MOON.radius);
    disc.addColorStop(0, "#fdfdfa");
    disc.addColorStop(1, "#c9d2df");
    ctx!.fillStyle = disc;
    ctx!.beginPath();
    ctx!.arc(x, y, MOON.radius, 0, Math.PI * 2);
    ctx!.fill();
  }

  function drawPlanet(): void {
    const [fx, fy] = PLANET.pos;
    const x = toSkyX(fx);
    const y = toSkyY(fy);
    ctx!.save();
    ctx!.translate(x, y);
    ctx!.rotate(PLANET.ringTilt);
    ctx!.strokeStyle = PLANET.ringColor;
    ctx!.lineWidth = 2;
    ctx!.beginPath();
    ctx!.ellipse(0, 0, PLANET.radius * 2.1, PLANET.radius * 0.6, 0, 0, Math.PI * 2);
    ctx!.stroke();
    ctx!.restore();

    ctx!.fillStyle = PLANET.color;
    ctx!.beginPath();
    ctx!.arc(x, y, PLANET.radius, 0, Math.PI * 2);
    ctx!.fill();
  }

  function drawConstellation(c: Constellation): void {
    ctx!.strokeStyle = "rgba(155, 231, 189, 0.35)";
    ctx!.lineWidth = 1;
    ctx!.beginPath();
    for (const [a, b] of c.lines) {
      const [ax, ay] = c.stars[a];
      const [bx, by] = c.stars[b];
      ctx!.moveTo(toSkyX(ax), toSkyY(ay));
      ctx!.lineTo(toSkyX(bx), toSkyY(by));
    }
    ctx!.stroke();

    ctx!.fillStyle = "#eaf1ff";
    for (const [fx, fy] of c.stars) {
      ctx!.beginPath();
      ctx!.arc(toSkyX(fx), toSkyY(fy), 1.6, 0, Math.PI * 2);
      ctx!.fill();
    }

    const [lx, ly] = c.stars[c.labelAt];
    ctx!.font = "italic 15px Georgia, 'Times New Roman', serif";
    ctx!.fillStyle = "rgba(155, 231, 189, 0.75)";
    ctx!.fillText(c.name, toSkyX(lx) + 12, toSkyY(ly) - 8);
  }

  function build(): void {
    skyW = Math.round(innerWidth * SKY_SCALE);
    skyH = Math.round(innerHeight * SKY_SCALE);
    els.canvas.width = skyW;
    els.canvas.height = skyH;

    if (skyW / skyH > CONTENT_ASPECT) {
      contentH = skyH;
      contentW = skyH * CONTENT_ASPECT;
    } else {
      contentW = skyW;
      contentH = skyW / CONTENT_ASPECT;
    }
    contentOffsetX = (skyW - contentW) / 2;
    contentOffsetY = (skyH - contentH) / 2;

    ctx!.fillStyle = "#050a14";
    ctx!.fillRect(0, 0, skyW, skyH);

    drawStars();
    drawMoon();
    drawPlanet();
    for (const c of CONSTELLATIONS) drawConstellation(c);

    // Start centered on the virtual sky, mouse parallax adjusts from here.
    panX = targetX = (skyW - innerWidth) / 2;
    panY = targetY = (skyH - innerHeight) / 2;
    els.canvas.style.transform = `translate(${-panX}px, ${-panY}px)`;

    built = true;
  }

  function clampTarget(): void {
    const maxX = Math.max(0, skyW - innerWidth);
    const maxY = Math.max(0, skyH - innerHeight);
    targetX = Math.min(maxX, Math.max(0, targetX));
    targetY = Math.min(maxY, Math.max(0, targetY));
  }

  function onMouseMove(e: MouseEvent): void {
    if (!isOpen) return;
    const maxX = Math.max(0, skyW - innerWidth);
    const maxY = Math.max(0, skyH - innerHeight);
    const nx = e.clientX / innerWidth; // 0..1
    const ny = e.clientY / innerHeight;
    targetX = nx * maxX;
    targetY = ny * maxY;
  }

  function tick(): void {
    if (!isOpen) return;
    panX += (targetX - panX) * (reduce ? 1 : PAN_EASE);
    panY += (targetY - panY) * (reduce ? 1 : PAN_EASE);
    els.canvas.style.transform = `translate(${-panX}px, ${-panY}px)`;
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
    clampTarget();
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
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  addEventListener("mousemove", onMouseMove);
  addEventListener("resize", () => {
    if (!built) return;
    clampTarget();
  });
  els.closeBtn.addEventListener("click", close);

  return { open, close };
}
