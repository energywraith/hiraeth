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
const noteEl = document.getElementById("note") as HTMLElement;
const gate = document.getElementById("gate") as HTMLElement;

const music = createLoopingMusic("/luna-hiraeth.mp3", 0.45);
gate.addEventListener(
  "click",
  () => {
    gate.classList.add("hidden");
    music.start().catch((err) => console.warn("music failed to load:", err));
  },
  { once: true },
);

initCalibrationView(scene);

const stars = initStarfield(document.getElementById("stars") as HTMLCanvasElement);
const comet = initComet(document.getElementById("comet") as HTMLElement, document.getElementById("cometWrap") as HTMLElement);

const calibrationEls = {
  scene,
  calibrateBtn: document.getElementById("calib") as HTMLButtonElement,
  handles: [...document.querySelectorAll<HTMLElement>(".handle")],
  quad: document.querySelector<SVGPolygonElement>("#quadLine polygon")!,
  readout: document.getElementById("readout") as HTMLTextAreaElement,
  copyBtn: document.getElementById("copy") as HTMLButtonElement,
  resetBtn: document.getElementById("reset") as HTMLButtonElement,
};

let rebuildMesh: ((scene: HTMLElement) => void) | null = null;

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

function applyMaskChange(): void {
  maskCalibration.update();
  stars.refresh();
  comet.refresh();
}

const maskCalibration = initMaskCalibration(maskCalibrationEls, applyMaskChange);
addEventListener("resize", applyMaskChange);
applyMaskChange();

const overlay = initOverlay({
  root: document.getElementById("overlay") as HTMLElement,
  titleEl: document.getElementById("overlayTitle") as HTMLElement,
  bodyEl: document.getElementById("overlayBody") as HTMLElement,
  closeBtn: document.getElementById("overlayClose") as HTMLButtonElement,
});

const hotspots = initHotspots(document.getElementById("hotspots") as HTMLElement, overlay.open);
hotspots.update();

const hotspotCalibrationEls = {
  scene,
  toggleBtn: document.getElementById("hotspotCalib") as HTMLButtonElement,
  panel: document.getElementById("hotspotPanel") as HTMLElement,
  select: document.getElementById("hotspotSelect") as HTMLSelectElement,
  svg: document.querySelector<SVGSVGElement>("#hotspotQuadLine")!,
  readout: document.getElementById("hotspotReadout") as HTMLTextAreaElement,
  copyBtn: document.getElementById("hotspotCopy") as HTMLButtonElement,
  resetBtn: document.getElementById("hotspotReset") as HTMLButtonElement,
};

function applyHotspotChange(): void {
  hotspotCalibration.update();
  hotspots.update();
}

const hotspotCalibration = initHotspotCalibration(hotspotCalibrationEls, applyHotspotChange);
addEventListener("resize", applyHotspotChange);
applyHotspotChange();

initScreen(scene, pixiWrap, noteEl).then((screen) => {
  rebuildMesh = screen.rebuildMesh;
  applyWarp();
});
