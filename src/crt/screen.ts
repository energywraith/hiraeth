import * as PIXI from "pixi.js";
import { CRTFilter } from "pixi-filters/crt";
import { GlowFilter } from "pixi-filters/glow";
import { buildGrid } from "./mesh";

const SRC_W = 560;
const SRC_H = 448;
const GREEN = 0x9be7bd;
const DIM = 0x4f8f70;

/** The glass in front of the phosphor, as a texture drawn once on a 2D
 * canvas. A tube in a dark room is never pure black: the front glass is
 * dark grey-green, it's convex, and it catches whatever light the room has
 * — here the warm lamp on the left and the window on the right. Without
 * this the screen reads as a hole cut in the photo rather than a surface.
 *
 * Painted as its own mesh (same geometry, screen blend) rather than into
 * `content`, because everything in `content` goes through CRTFilter — and a
 * reflection sits ON the glass, in front of the scanlines, so it must not
 * be scanlined or curved a second time. */
function buildGlassTexture(): PIXI.Texture {
  const c = document.createElement("canvas");
  c.width = SRC_W;
  c.height = SRC_H;
  const g = c.getContext("2d");
  if (!g) return PIXI.Texture.WHITE;

  // The floor: dark grey-green glass, evenly across the tube. This is the
  // knob for "the screen is too black / too washed out" — everything below
  // is directional sheen on top of it.
  g.fillStyle = "rgba(96, 124, 112, 0.04)";
  g.fillRect(0, 0, SRC_W, SRC_H);

  // Warm sheen from the room/lamp side (left), broad and soft.
  let grd = g.createRadialGradient(SRC_W * 0.2, SRC_H * 0.14, 0, SRC_W * 0.2, SRC_H * 0.14, SRC_W * 0.8);
  grd.addColorStop(0, "rgba(255, 208, 154, 0.15)");
  grd.addColorStop(0.6, "rgba(255, 208, 154, 0.04)");
  grd.addColorStop(1, "rgba(255, 208, 154, 0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, SRC_W, SRC_H);

  // Cool sheen from the window, clipped by the right edge of the glass.
  grd = g.createRadialGradient(SRC_W * 1.05, SRC_H * 0.4, 0, SRC_W * 1.05, SRC_H * 0.4, SRC_W * 0.62);
  grd.addColorStop(0, "rgba(168, 202, 255, 0.16)");
  grd.addColorStop(1, "rgba(168, 202, 255, 0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, SRC_W, SRC_H);

  // Convex glass gathers more of the room toward the top and goes dark at
  // the bottom lip, which is what actually sells the curvature.
  grd = g.createLinearGradient(0, 0, 0, SRC_H);
  grd.addColorStop(0, "rgba(214, 232, 226, 0.07)");
  grd.addColorStop(0.55, "rgba(214, 232, 226, 0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, SRC_W, SRC_H);

  // A few very soft smudges. Perfectly even glass reads as CGI; a screen
  // nobody has wiped since 1998 does not.
  for (const [x, y, r, a] of [
    [0.34, 0.62, 0.3, 0.04],
    [0.72, 0.24, 0.22, 0.035],
    [0.58, 0.82, 0.26, 0.03],
  ]) {
    grd = g.createRadialGradient(SRC_W * x, SRC_H * y, 0, SRC_W * x, SRC_H * y, SRC_W * r);
    grd.addColorStop(0, `rgba(226, 240, 235, ${a})`);
    grd.addColorStop(1, "rgba(226, 240, 235, 0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, SRC_W, SRC_H);
  }

  return PIXI.Texture.from(c);
}

export interface ScreenHandle {
  /** Rebuild the mesh geometry from the current CORNERS/EDGE_BULGE — call
   * after any calibration change or scene resize. */
  rebuildMesh(scene: HTMLElement): void;
  /** Start the boot-log sequence — call once the visitor dismisses the
   * gate, so they always see it play from the beginning. */
  start(): void;
}

/** Sets up the Pixi app that renders CRT screen content onto the bulged
 * mesh. Screen content (boot log -> desktop) is drawn off-stage into a flat
 * texture, then mapped onto the mesh built by ./mesh so it follows the
 * hand-calibrated glass shape. */
export async function initScreen(scene: HTMLElement, pixiWrap: HTMLElement): Promise<ScreenHandle> {
  const app = new PIXI.Application();
  await app.init({ resizeTo: scene, backgroundAlpha: 0, antialias: true });
  pixiWrap.appendChild(app.canvas);

  const content = new PIXI.Container();
  const mono: Partial<PIXI.TextStyleOptions> = {
    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
    fill: GREEN,
    fontSize: 26,
    lineHeight: 34,
  };

  const boot = new PIXI.Text({ text: "", style: mono });
  boot.x = 34;
  boot.y = 40;
  content.addChild(boot);
  const cur = new PIXI.Text({ text: "_", style: mono });
  content.addChild(cur);

  const lines = [
    "HIRAETH v0.9",
    "init modules ..... OK",
    "dialing 56.6k ....",
    "CONNECT 56000",
    "",
    "> welcome home",
    "> starfield.exe",
  ];
  const full = lines.join("\n");
  let i = 0;
  let acc = 0;

  const desk = new PIXI.Container();
  desk.visible = false;
  content.addChild(desk);

  const chrome = new PIXI.Graphics();
  chrome.rect(20, 22, SRC_W - 40, 40).stroke({ width: 2, color: DIM });
  chrome.rect(56, 110, SRC_W - 200, 210).stroke({ width: 2, color: DIM });
  chrome.moveTo(56, 148).lineTo(SRC_W - 144, 148).stroke({ width: 2, color: DIM });
  chrome.rect(20, SRC_H - 60, SRC_W - 40, 40).stroke({ width: 2, color: DIM });
  desk.addChild(chrome);

  const bar = new PIXI.Text({
    text: "HIRAETH     moon: full",
    style: { ...mono, fontSize: 20 },
  });
  bar.x = 34;
  bar.y = 32;
  desk.addChild(bar);

  const win = new PIXI.Text({ text: "STARFIELD.EXE", style: { ...mono, fontSize: 20 } });
  win.x = 70;
  win.y = 122;
  desk.addChild(win);

  const body = new PIXI.Text({
    text: "gazing...\n\n  *   .    *\n .    *   .   *\n   *    .   *  .",
    style: { ...mono, fontSize: 20, lineHeight: 26 },
  });
  body.x = 72;
  body.y = 162;
  desk.addChild(body);

  const clock = new PIXI.Text({ text: "[ start ]                 23:47", style: { ...mono, fontSize: 20 } });
  clock.x = 34;
  clock.y = SRC_H - 50;
  desk.addChild(clock);

  const back = new PIXI.Graphics().rect(0, 0, SRC_W, SRC_H).fill(0x030806);
  content.addChildAt(back, 0);

  // `noise` is deliberately low. CRTFilter's noise is additive white noise:
  // turn it up and it lifts the screen's black to a flat grey static, which
  // kills the phosphor colour — the glass stops reading as "dark tube with
  // light drawn on it" and starts reading as "off TV". The film grain the
  // screen needs comes from the global .grain layer anyway (grain is never
  // per-layer here, see CLAUDE.md), so this only has to supply the faint
  // shimmer that's specific to a CRT. The scanlines carry the texture
  // instead, hence the higher lineContrast.
  const crt = new CRTFilter({
    curvature: 3,
    lineWidth: 2.2,
    lineContrast: 0.4,
    noise: 0.05,
    noiseSize: 1,
    vignetting: 0.34,
    vignettingAlpha: 1,
    vignettingBlur: 0.4,
    seed: Math.random(),
  });
  const glow = new GlowFilter({ distance: 9, outerStrength: 1.7, innerStrength: 0, color: 0x7ff0b6, quality: 0.4 });
  content.filters = [glow, crt];

  const contentRT = PIXI.RenderTexture.create({ width: SRC_W, height: SRC_H });
  const glassTexture = buildGlassTexture();
  let mesh: PIXI.Mesh<PIXI.MeshGeometry> | null = null;
  let glass: PIXI.Mesh<PIXI.MeshGeometry> | null = null;

  // Both meshes share the same shape but get their own geometry instance, so
  // destroying one on rebuild can never pull the buffer out from under the
  // other.
  function meshFor(W: number, H: number, texture: PIXI.Texture): PIXI.Mesh<PIXI.MeshGeometry> {
    const { positions, uvs, indices } = buildGrid(W, H);
    return new PIXI.Mesh({ geometry: new PIXI.MeshGeometry({ positions, uvs, indices }), texture });
  }

  function rebuildMesh(scene: HTMLElement): void {
    const W = scene.clientWidth;
    const H = scene.clientHeight;
    if (!W || !H) return;
    const newMesh = meshFor(W, H, contentRT);
    const newGlass = meshFor(W, H, glassTexture);
    newGlass.blendMode = "screen";
    for (const old of [mesh, glass]) {
      if (!old) continue;
      app.stage.removeChild(old);
      old.destroy();
    }
    mesh = newMesh;
    glass = newGlass;
    app.stage.addChild(mesh);
    app.stage.addChild(glass);
  }

  const measurer = new PIXI.Text({ text: "", style: mono });
  function measure(s: string): number {
    measurer.text = s || "";
    return measurer.width;
  }

  let started = false;
  let booted = false;
  let doneDelay = 0;
  app.ticker.add((tk) => {
    const dt = tk.deltaMS;
    crt.time += dt * 0.006;
    if (Math.random() < 0.03) crt.seed = Math.random();

    if (!started) {
      app.renderer.render({ container: content, target: contentRT });
      return;
    }

    if (!booted) {
      acc += dt;
      if (acc > 45) {
        acc = 0;
        i = Math.min(i + 1, full.length);
        boot.text = full.slice(0, i);
      }
      const upTo = full.slice(0, i).split("\n");
      cur.x = boot.x + measure(upTo[upTo.length - 1]);
      cur.y = boot.y + (upTo.length - 1) * 34;
      cur.visible = performance.now() % 1100 < 550;
      if (i >= full.length) {
        doneDelay += dt;
        if (doneDelay > 900) {
          booted = true;
          boot.visible = false;
          cur.visible = false;
          desk.visible = true;
        }
      }
    } else {
      clock.alpha = 0.82 + 0.18 * Math.abs(Math.sin(performance.now() * 0.002));
    }

    app.renderer.render({ container: content, target: contentRT });
  });

  return {
    rebuildMesh,
    start(): void {
      started = true;
    },
  };
}
