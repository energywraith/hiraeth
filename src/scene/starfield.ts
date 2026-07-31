import type { Point } from "../types";
import { pointInSkyMask, skyMaskBounds, skyMaskClipPath } from "./skyMask";

interface Star {
  x: number;
  y: number;
  r: number;
  glowR: number;
  rot: number;
  p: number;
  s: number;
  spark: boolean;
  glow: CanvasGradient;
}

// A handful of stars get a subtle 4-point diffraction sparkle (like a tiny,
// muted Star-of-Bethlehem) instead of a plain dot, for visual variety.
function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  const len = r * 5;
  const w = r * 0.35;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.moveTo(0, -len);
    ctx.lineTo(w, 0);
    ctx.lineTo(0, len);
    ctx.lineTo(-w, 0);
    ctx.closePath();
    ctx.fill();
    ctx.rotate(Math.PI / 2);
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.8, 0, 7);
  ctx.fill();
  ctx.restore();
}

interface StarfieldConfig {
  count: number;
  randomPoint: () => Point;
  clip?: () => string;
}

function buildStarfield(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, cfg: StarfieldConfig): { refresh: () => void } {
  const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  let stars: Star[] = [];

  function resize(): void {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    stars = Array.from({ length: cfg.count }, () => {
      const [fx, fy] = cfg.randomPoint();
      const x = fx * canvas.width;
      const y = fy * canvas.height;
      const spark = Math.random() < 0.12;
      const r = spark ? Math.random() * 0.5 + 1.1 : Math.random() * 0.9 + 0.4;
      const glowR = r * (spark ? 5.5 : 3.2);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, glowR);
      glow.addColorStop(0, "rgba(234, 241, 255, 0.9)");
      glow.addColorStop(0.4, "rgba(234, 241, 255, 0.22)");
      glow.addColorStop(1, "rgba(234, 241, 255, 0)");
      return {
        x,
        y,
        r,
        glowR,
        rot: Math.random() * Math.PI,
        p: Math.random() * 6.28,
        s: Math.random() * 0.012 + 0.004,
        spark,
        glow,
      };
    });
  }

  function draw(t: number): void {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const star of stars) {
      const a = reduce ? 0.55 : 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(star.p + t * star.s));
      ctx.globalAlpha = a;
      ctx.fillStyle = star.glow;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.glowR, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#eaf1ff";
      if (star.spark) {
        drawSparkle(ctx, star.x, star.y, star.r, star.rot);
      } else {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, 7);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (!reduce) requestAnimationFrame(draw);
  }

  function refresh(): void {
    if (cfg.clip) canvas.style.clipPath = cfg.clip();
    resize();
  }

  addEventListener("resize", resize);
  refresh();
  requestAnimationFrame(draw);
  if (reduce) draw(0);

  return { refresh };
}

function randomSkyPoint(): Point {
  const { minX, maxX, minY, maxY } = skyMaskBounds();
  let fx: number;
  let fy: number;
  do {
    fx = minX + Math.random() * (maxX - minX);
    fy = minY + Math.random() * (maxY - minY);
  } while (!pointInSkyMask(fx, fy));
  return [fx, fy];
}

export function initStarfield(canvas: HTMLCanvasElement): { refresh: () => void } {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { refresh: () => {} };
  return buildStarfield(canvas, ctx, { count: 70, randomPoint: randomSkyPoint, clip: skyMaskClipPath });
}

// Same twinkling-star look as the window starfield, but scattered across
// the whole canvas with no sky-mask clip — used behind the "click to enter"
// gate, which sits outside the scene and has no window polygon to sample.
export function initGateStarfield(canvas: HTMLCanvasElement): { refresh: () => void } {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { refresh: () => {} };
  return buildStarfield(canvas, ctx, { count: 90, randomPoint: () => [Math.random(), Math.random()] });
}
