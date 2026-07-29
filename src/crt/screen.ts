import * as PIXI from "pixi.js";
import { CRTFilter } from "pixi-filters/crt";
import { GlowFilter } from "pixi-filters/glow";
import { buildGrid } from "./mesh";

const SRC_W = 560;
const SRC_H = 448;
const GREEN = 0x9be7bd;
const DIM = 0x4f8f70;

export interface ScreenHandle {
  /** Rebuild the mesh geometry from the current CORNERS/EDGE_BULGE — call
   * after any calibration change or scene resize. */
  rebuildMesh(scene: HTMLElement): void;
}

/** Sets up the Pixi app that renders CRT screen content onto the bulged
 * mesh. Screen content (boot log -> desktop) is drawn off-stage into a flat
 * texture, then mapped onto the mesh built by ./mesh so it follows the
 * hand-calibrated glass shape. */
export async function initScreen(
  scene: HTMLElement,
  pixiWrap: HTMLElement,
  noteEl: HTMLElement,
): Promise<ScreenHandle> {
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
    "LUNA-DIALUP v0.9",
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
    text: "LUNA-DIALUP     moon: waxing gibbous",
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

  const back = new PIXI.Graphics().rect(0, 0, SRC_W, SRC_H).fill(0x050c08);
  content.addChildAt(back, 0);

  const crt = new CRTFilter({
    curvature: 3,
    lineWidth: 2.2,
    lineContrast: 0.28,
    noise: 0.16,
    noiseSize: 1.1,
    vignetting: 0.34,
    vignettingAlpha: 1,
    vignettingBlur: 0.4,
    seed: Math.random(),
  });
  const glow = new GlowFilter({ distance: 8, outerStrength: 1.4, innerStrength: 0, color: 0x7ff0b6, quality: 0.4 });
  content.filters = [glow, crt];
  noteEl.textContent = `CRTFilter + GlowFilter — pixi ${PIXI.VERSION}`;

  const contentRT = PIXI.RenderTexture.create({ width: SRC_W, height: SRC_H });
  let mesh: PIXI.Mesh<PIXI.MeshGeometry> | null = null;

  function rebuildMesh(scene: HTMLElement): void {
    const W = scene.clientWidth;
    const H = scene.clientHeight;
    if (!W || !H) return;
    const { positions, uvs, indices } = buildGrid(W, H);
    const geometry = new PIXI.MeshGeometry({ positions, uvs, indices });
    const newMesh = new PIXI.Mesh({ geometry, texture: contentRT });
    if (mesh) {
      app.stage.removeChild(mesh);
      mesh.destroy();
    }
    mesh = newMesh;
    app.stage.addChild(mesh);
  }

  const measurer = new PIXI.Text({ text: "", style: mono });
  function measure(s: string): number {
    measurer.text = s || "";
    return measurer.width;
  }

  let booted = false;
  let doneDelay = 0;
  app.ticker.add((tk) => {
    const dt = tk.deltaMS;
    crt.time += dt * 0.006;
    if (Math.random() < 0.03) crt.seed = Math.random();

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

  return { rebuildMesh };
}
