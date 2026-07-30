import "./style.css";
import { initStarfield } from "./scene/starfield";
import { initComet } from "./scene/comet";
import { initMaskCalibration } from "./scene/skyMaskCalibration";
import { initScreen } from "./crt/screen";
import { initCalibration, updateCalibrationOverlay } from "./crt/calibration";
import { createLoopingMusic } from "./audio/music";
import { initHotspots } from "./hotspots/interaction";
import { initOverlay } from "./hotspots/overlay";
import { initHotspotCalibration } from "./hotspots/calibration";
import { initCalibrationView } from "./calibrationView";

const scene = document.getElementById("scene") as HTMLElement;
const pixiWrap = document.getElementById("pixiWrap") as HTMLElement;
const gate = document.getElementById("gate") as HTMLElement;

const music = createLoopingMusic(`${import.meta.env.BASE_URL}luna-hiraeth.mp3`, 0.45);
let entered = false;
let screenHandle: { start(): void } | null = null;
gate.addEventListener(
  "click",
  () => {
    gate.classList.add("hidden");
    music.start().catch((err) => console.warn("music failed to load:", err));
    entered = true;
    screenHandle?.start();
  },
  { once: true },
);

const stars = initStarfield(document.getElementById("stars") as HTMLCanvasElement);
const comet = initComet(document.getElementById("comet") as HTMLElement, document.getElementById("cometWrap") as HTMLElement);
addEventListener("resize", () => {
  stars.refresh();
  comet.refresh();
});

const overlay = initOverlay({
  root: document.getElementById("overlay") as HTMLElement,
  titleEl: document.getElementById("overlayTitle") as HTMLElement,
  bodyEl: document.getElementById("overlayBody") as HTMLElement,
  closeBtn: document.getElementById("overlayClose") as HTMLButtonElement,
});
const hotspots = initHotspots(document.getElementById("hotspots") as HTMLElement, overlay.open);
hotspots.update();

let rebuildMesh: ((scene: HTMLElement) => void) | null = null;
addEventListener("resize", () => rebuildMesh?.(scene));

initScreen(scene, pixiWrap).then((screen) => {
  rebuildMesh = screen.rebuildMesh;
  rebuildMesh(scene);
  screenHandle = screen;
  if (entered) screen.start();
});

// Calibration tools (drag-to-fit UI for CORNERS/EDGE_BULGE, SKY_MASK, and
// HOTSPOTS, plus the scroll-zoom/pan view that supports them) are dev-only —
// end users never re-fit scene geometry. import.meta.env.DEV is a build-time
// constant, so Vite/Rollup strip this whole block (and the modules it
// imports) out of `npm run build`; only the buttons that trigger it are
// hidden separately via body.dev-tools in style.css.
if (import.meta.env.DEV) {
  document.body.classList.add("dev-tools");
  initCalibrationView(scene);

  const calibrationEls = {
    scene,
    calibrateBtn: document.getElementById("calib") as HTMLButtonElement,
    handles: [...document.querySelectorAll<HTMLElement>(".handle")],
    quad: document.querySelector<SVGPolygonElement>("#quadLine polygon")!,
    readout: document.getElementById("readout") as HTMLTextAreaElement,
    copyBtn: document.getElementById("copy") as HTMLButtonElement,
    resetBtn: document.getElementById("reset") as HTMLButtonElement,
  };
  function applyWarp(): void {
    updateCalibrationOverlay(calibrationEls);
    rebuildMesh?.(scene);
  }
  initCalibration(calibrationEls, applyWarp);
  addEventListener("resize", applyWarp);
  applyWarp();

  const maskCalibrationEls = {
    scene,
    toggleBtn: document.getElementById("maskCalib") as HTMLButtonElement,
    quad: document.querySelector<SVGPolygonElement>("#maskQuadLine polygon")!,
    readout: document.getElementById("maskReadout") as HTMLTextAreaElement,
    copyBtn: document.getElementById("maskCopy") as HTMLButtonElement,
    resetBtn: document.getElementById("maskReset") as HTMLButtonElement,
  };
  const maskCalibration = initMaskCalibration(maskCalibrationEls, () => {
    maskCalibration.update();
    stars.refresh();
    comet.refresh();
  });
  addEventListener("resize", () => maskCalibration.update());
  maskCalibration.update();

  const hotspotCalibrationEls = {
    scene,
    toggleBtn: document.getElementById("hotspotCalib") as HTMLButtonElement,
    panel: document.getElementById("hotspotPanel") as HTMLElement,
    select: document.getElementById("hotspotSelect") as HTMLSelectElement,
    svg: document.querySelector<SVGSVGElement>("#hotspotQuadLine")!,
    readout: document.getElementById("hotspotReadout") as HTMLTextAreaElement,
    addPointBtn: document.getElementById("hotspotAddPoint") as HTMLButtonElement,
    removePointBtn: document.getElementById("hotspotRemovePoint") as HTMLButtonElement,
    copyBtn: document.getElementById("hotspotCopy") as HTMLButtonElement,
    resetBtn: document.getElementById("hotspotReset") as HTMLButtonElement,
  };
  const hotspotCalibration = initHotspotCalibration(hotspotCalibrationEls, () => {
    hotspotCalibration.update();
    hotspots.update();
  });
  addEventListener("resize", () => hotspotCalibration.update());
  hotspotCalibration.update();
}
