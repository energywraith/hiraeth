// Dust motes drifting through the moonlight — the one thing that makes a
// still photo of a room read as "air", not "print". Deliberately sparse and
// slow: they should register as something you notice on the second look, not
// as falling snow. Concentrated toward the window (the only light source
// strong enough to catch dust in a dark room), thinning out to nothing on
// the far side of the desk.
interface Mote {
  x: number;
  y: number;
  r: number;
  /** vertical drift, px/ms — mostly upward, dust rides warm air */
  vy: number;
  /** horizontal drift, px/ms */
  vx: number;
  /** sway phase + speed, so they wobble instead of moving in straight lines */
  swayP: number;
  swayS: number;
  swayA: number;
  a: number;
  /** twinkle phase/speed — a mote catches the light only at some angles */
  p: number;
  s: number;
}

// Fraction of the scene where the moonlight actually lands: the window on
// the right plus the spill across the desk. Motes are rejection-sampled
// against this so none float in the pitch-dark left corner.
const LIT_X = 0.52;

function makeMote(w: number, h: number, y?: number): Mote {
  // Bias x toward the window side: two random values averaged, then pushed
  // into the lit half.
  const bias = (Math.random() + Math.random()) / 2;
  return {
    x: (LIT_X + (1 - LIT_X) * bias) * w,
    y: y ?? Math.random() * h,
    r: Math.random() * 1.3 + 0.6,
    vy: -(Math.random() * 0.006 + 0.002),
    vx: (Math.random() - 0.6) * 0.004,
    swayP: Math.random() * 6.28,
    swayS: Math.random() * 0.0006 + 0.0002,
    swayA: Math.random() * 14 + 6,
    a: Math.random() * 0.3 + 0.12,
    p: Math.random() * 6.28,
    s: Math.random() * 0.0012 + 0.0004,
  };
}

export function initDust(canvas: HTMLCanvasElement): { refresh: () => void } {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { refresh: () => {} };
  return buildDust(canvas, ctx);
}

// Same split as starfield.ts: the context is passed in rather than closed
// over, so its non-null narrowing survives into the draw loop.
function buildDust(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): { refresh: () => void } {
  const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  let motes: Mote[] = [];
  let last = 0;

  function resize(): void {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    const count = Math.round((canvas.width / 1600) * 46);
    motes = Array.from({ length: count }, () => makeMote(canvas.width, canvas.height));
  }

  function draw(t: number): void {
    const dt = Math.min(t - last, 50);
    last = t;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const m of motes) {
      if (!reduce) {
        m.y += m.vy * dt;
        m.x += m.vx * dt;
        m.swayP += m.swayS * dt;
        // Drifted off the top: respawn at the bottom, fresh position.
        if (m.y < -8) Object.assign(m, makeMote(canvas.width, canvas.height, canvas.height + 8));
      }
      const twinkle = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(m.p + t * m.s));
      // Motes near the window catch more light than the ones over the desk.
      const lit = Math.min(1, Math.max(0, (m.x / canvas.width - LIT_X) / (1 - LIT_X)) * 0.8 + 0.35);
      ctx.globalAlpha = m.a * twinkle * lit;
      ctx.fillStyle = "#e8eeff";
      ctx.beginPath();
      ctx.arc(m.x + Math.sin(m.swayP) * m.swayA, m.y, m.r, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (!reduce) requestAnimationFrame(draw);
  }

  addEventListener("resize", resize);
  resize();
  requestAnimationFrame(draw);
  if (reduce) draw(0);

  return { refresh: resize };
}
