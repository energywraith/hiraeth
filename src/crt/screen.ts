import * as PIXI from "pixi.js";
import { CRTFilter } from "pixi-filters/crt";
import { GlowFilter } from "pixi-filters/glow";
import { buildGrid } from "./mesh";
import { DESKTOP_ICONS } from "../computer/desktopContent";

const SRC_W = 560;
const SRC_H = 448;
// Boot log: a dark terminal glowing green, same as before — a brief,
// classic "power-on" beat. Once it resolves to the desktop, both the
// background and ink flip to the close-up desktop view's own palette (see
// src/computer/desktopView.ts / style.css's .desktop-screen) so the tiny
// tube preview and the jump-in-close screen read as one computer, not two.
// Without this the two used to look like unrelated devices.
const BOOT_BG = 0x030806;
// GREEN is --phosphor from style.css (#9be7bd) — the one accent color
// used everywhere on the site (gate label, button hovers, panel
// headings). PAPER/INK are that same hue, just at opposite ends of the
// lightness range, matching --mon-paper/--mon-ink in style.css's
// .desktop-view — so this tiny tube preview and the close-up desktop
// view (and the rest of the site's chrome) all read as one palette
// instead of the monitor looking like an unrelated beige-green machine.
const GREEN = 0x9be7bd;
const PAPER = 0xe3f5ec;
const INK = 0x16332a;
// The glass mesh's screen-blended sheens (see buildGlassTexture) are tuned
// against the dark boot screen; once booted (see the ticker below) they'd
// wash the bright paper background out to a blown-out glare at full
// strength, so it's dimmed. Named + reused in rebuildMesh() too: a plain
// `let` set once in the ticker doesn't survive rebuildMesh() creating a
// fresh mesh instance on resize/recalibration, which was overwriting it
// back to full brightness the moment the window resized post-boot.
const GLASS_ALPHA_BOOTED = 0.35;

/** Rasterizes one of DESKTOP_ICONS' inline SVG glyphs into a Pixi texture,
 * so the tiny tube preview draws the exact same icon art as the close-up
 * desktop view instead of a redrawn approximation — one source of truth
 * (desktopContent.ts) for both. `currentColor` in those SVGs resolves to
 * plain black when rasterized standalone like this (no inherited `color`),
 * which reads the same as INK at this size, so no recoloring needed. */
async function loadIconTexture(svg: string): Promise<PIXI.Texture> {
  // DESKTOP_ICONS' glyphs skip xmlns since they're embedded inline as
  // innerHTML there, where the HTML parser namespaces bare <svg> tags for
  // free — but decoded standalone here, without it the image silently
  // fails (`EncodingError: The source image cannot be decoded`), which
  // took down the rest of this async function (and with it, the whole
  // screen: no filters, no ticker, no mesh) with no visible error.
  const sized = svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" ');
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;
  await img.decode();
  return PIXI.Texture.from(img);
}

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
    "> observatory.exe",
  ];
  const full = lines.join("\n");
  let i = 0;
  let acc = 0;

  const desk = new PIXI.Container();
  desk.visible = false;
  content.addChild(desk);

  const deskMono: Partial<PIXI.TextStyleOptions> = { ...mono, fill: INK };

  const chrome = new PIXI.Graphics();
  chrome.rect(20, 22, SRC_W - 40, 40).stroke({ width: 2, color: INK });
  chrome.rect(56, 110, SRC_W - 200, 210).stroke({ width: 2, color: INK });
  chrome.moveTo(56, 148).lineTo(SRC_W - 144, 148).stroke({ width: 2, color: INK });
  desk.addChild(chrome);

  const bar = new PIXI.Text({
    text: "HIRAETH     moon: full",
    style: { ...deskMono, fontSize: 20 },
  });
  bar.x = 34;
  bar.y = 32;
  desk.addChild(bar);

  const win = new PIXI.Text({ text: "HIRAETH OBSERVATORY", style: { ...deskMono, fontSize: 18 } });
  win.x = 70;
  win.y = 123;
  desk.addChild(win);

  // Same four programs, same icon art, same labels as the close-up desktop
  // view (see src/computer/desktopContent.ts) — this tiny, glowing tube
  // preview and that jump-in-close screen are meant to read as the exact
  // same computer, not a redrawn approximation of it. Grid geometry is
  // hand-placed (Pixi has no flexbox) but every icon/label pixel comes from
  // DESKTOP_ICONS, the same data desktopView.ts builds its icon buttons
  // from — one source of truth either way.
  const ICON_BOX = 42;
  const ICON_COL_X = [96, 276];
  const ICON_ROW_Y = [160, 240];
  const iconTextures = await Promise.all(DESKTOP_ICONS.map((icon) => loadIconTexture(icon.glyph)));
  const iconLabelStyle: Partial<PIXI.TextStyleOptions> = { ...deskMono, fontSize: 11 };
  const labelMeasurer = new PIXI.Text({ text: "", style: iconLabelStyle });
  DESKTOP_ICONS.forEach((icon, idx) => {
    const bx = ICON_COL_X[idx % 2];
    const by = ICON_ROW_Y[Math.floor(idx / 2)];

    const box = new PIXI.Graphics().rect(bx, by, ICON_BOX, ICON_BOX).stroke({ width: 2, color: INK });
    desk.addChild(box);

    const sprite = new PIXI.Sprite(iconTextures[idx]);
    sprite.x = bx + 6;
    sprite.y = by + 6;
    sprite.width = ICON_BOX - 12;
    sprite.height = ICON_BOX - 12;
    desk.addChild(sprite);

    labelMeasurer.text = icon.label;
    const label = new PIXI.Text({ text: icon.label, style: iconLabelStyle });
    label.x = bx + ICON_BOX / 2 - labelMeasurer.width / 2;
    label.y = by + ICON_BOX + 6;
    desk.addChild(label);
  });

  // Matches the close-up view's own prompt line exactly (see .desktop-
  // prompt in style.css / desktopView.ts) — same blink cadence as the boot
  // cursor above, just a separate text/state since it lives past booting.
  const prompt = new PIXI.Text({ text: "A:\\>", style: { ...deskMono, fontSize: 18 } });
  prompt.x = 34;
  prompt.y = SRC_H - 44;
  desk.addChild(prompt);
  const promptCur = new PIXI.Text({ text: "_", style: { ...deskMono, fontSize: 18 } });
  promptCur.x = prompt.x + prompt.width;
  promptCur.y = prompt.y;
  desk.addChild(promptCur);

  const back = new PIXI.Graphics().rect(0, 0, SRC_W, SRC_H).fill(BOOT_BG);
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
    newGlass.alpha = booted ? GLASS_ALPHA_BOOTED : 1;
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
          back.clear().rect(0, 0, SRC_W, SRC_H).fill(PAPER);
          // GlowFilter blooms outward from bright pixels — sized to a
          // sparse line of text on black. The desk is a large bright
          // rectangle instead, so left at the boot-phase strength it would
          // radiate a strong green halo around the whole screen. Once
          // booted the ink does the work, so the glow all but drops out.
          glow.outerStrength = 0;
          // CRTFilter's scanlines are contrast against the CONTENT, not an
          // absolute darkening — over the near-black boot screen that reads
          // as a faint texture, but over a large bright fill the same
          // lineContrast reads as visible dark ripples (worse combined with
          // curvature's own UV warp). Flattened once booted so the paper
          // stays even; the scanline texture isn't missed once it's mostly
          // covered by real UI chrome anyway.
          crt.lineContrast = 0.08;
          // The glass mesh's sheens (see buildGlassTexture) are screen-
          // blended, i.e. additive toward white — tuned against a near-
          // black boot screen, they wash the bright paper background out
          // to a blown-out glare. Dimming the mesh itself (not rebuilding
          // the texture) keeps the same physical-glass character, just
          // scaled down to what a bright screen needs.
          if (glass) glass.alpha = 0.35;
        }
      }
    } else {
      promptCur.visible = performance.now() % 1100 < 550;
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
