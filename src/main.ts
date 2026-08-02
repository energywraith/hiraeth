import "./style.css";
import { initStarfield, initGateStarfield } from "./scene/starfield";
import { initComet } from "./scene/comet";
import { initDust } from "./scene/dust";
import { initMaskCalibration } from "./scene/skyMaskCalibration";
import { initScreen } from "./crt/screen";
import { initCalibration, updateCalibrationOverlay } from "./crt/calibration";
import { createLoopingMusic } from "./audio/music";
import { createAmbience } from "./audio/ambience";
import { isMuted, setMuted } from "./audio/bus";
import { initHotspots } from "./hotspots/interaction";
import { initOverlay } from "./hotspots/overlay";
import { initHotspotCalibration } from "./hotspots/calibration";
import { initSkyView } from "./telescope/skyView";
import { initDesktopView } from "./computer/desktopView";
import { initScreenCalibration } from "./computer/screenCalibration";
import { initCalibrationView } from "./calibrationView";

const scene = document.getElementById("scene") as HTMLElement;
const pixiWrap = document.getElementById("pixiWrap") as HTMLElement;
const gate = document.getElementById("gate") as HTMLElement;

const gateStars = initGateStarfield(document.getElementById("gateStars") as HTMLCanvasElement);
addEventListener("resize", () => gateStars.refresh());

const music = createLoopingMusic(`${import.meta.env.BASE_URL}luna-hiraeth.mp3`, 0.45);
// The one knob for how present the room is under the music.
const ambience = createAmbience(0.075);
const muteBtn = document.getElementById("mute") as HTMLButtonElement;
muteBtn.addEventListener("click", () => {
  setMuted(!isMuted());
  muteBtn.setAttribute("aria-pressed", String(isMuted()));
});

let entered = false;
let screenHandle: { start(): void } | null = null;
gate.addEventListener(
  "click",
  () => {
    gate.classList.add("hidden");
    // Ambience is synthesised, so it starts instantly; the music has to
    // fetch and decode a track first and may fail on its own.
    ambience.start();
    music.start().catch((err) => console.warn("music failed to load:", err));
    muteBtn.hidden = false;
    entered = true;
    screenHandle?.start();
  },
  { once: true },
);

const stars = initStarfield(document.getElementById("stars") as HTMLCanvasElement);
const comet = initComet(document.getElementById("comet") as HTMLElement, document.getElementById("cometWrap") as HTMLElement);
const dust = initDust(document.getElementById("dust") as HTMLCanvasElement);
addEventListener("resize", () => {
  stars.refresh();
  comet.refresh();
  dust.refresh();
});

const overlay = initOverlay({
  root: document.getElementById("overlay") as HTMLElement,
  titleEl: document.getElementById("overlayTitle") as HTMLElement,
  bodyEl: document.getElementById("overlayBody") as HTMLElement,
  imageEl: document.getElementById("overlayImage") as HTMLImageElement,
  closeBtn: document.getElementById("overlayClose") as HTMLButtonElement,
});
const skyView = initSkyView({
  root: document.getElementById("skyView") as HTMLElement,
  canvas: document.getElementById("skyViewCanvas") as HTMLCanvasElement,
  closeBtn: document.getElementById("skyViewClose") as HTMLButtonElement,
  captionEl: document.getElementById("skyViewCaption") as HTMLElement,
});
const desktopView = initDesktopView({
  root: document.getElementById("desktopView") as HTMLElement,
  frame: document.getElementById("desktopFrame") as HTMLElement,
  screenEl: document.getElementById("desktopScreen") as HTMLElement,
  iconsEl: document.getElementById("desktopIcons") as HTMLElement,
  windowEl: document.getElementById("desktopWindow") as HTMLElement,
  windowTitleEl: document.getElementById("desktopWindowTitle") as HTMLElement,
  windowBodyEl: document.getElementById("desktopWindowBody") as HTMLElement,
  windowCloseBtn: document.getElementById("desktopWindowClose") as HTMLButtonElement,
  closeBtn: document.getElementById("desktopViewClose") as HTMLButtonElement,
  chromeCloseBtn: document.getElementById("desktopChromeClose") as HTMLButtonElement,
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    skyView.close();
    desktopView.close();
  }
});
const hotspots = initHotspots(document.getElementById("hotspots") as HTMLElement, (id, title, body, image, e) => {
  if (id === "telescope") {
    skyView.open(e.clientX, e.clientY);
  } else if (id === "computer") {
    desktopView.open(e.clientX, e.clientY);
  } else {
    overlay.open(title, body, image);
  }
});
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

  const desktopFrame = document.getElementById("desktopFrame") as HTMLElement;
  const screenCalibrationEls = {
    frame: desktopFrame,
    toggleBtn: document.getElementById("screenCalib") as HTMLButtonElement,
    handles: [...document.querySelectorAll<HTMLElement>(".screen-handle")],
    quad: document.querySelector<SVGPolygonElement>("#screenQuadLine polygon")!,
    readout: document.getElementById("screenReadout") as HTMLTextAreaElement,
    copyBtn: document.getElementById("screenCopy") as HTMLButtonElement,
    resetBtn: document.getElementById("screenReset") as HTMLButtonElement,
  };
  const screenCalibration = initScreenCalibration(screenCalibrationEls, () => {
    desktopView.updateScreenGeometry();
  });
  // There's nothing to see the handles against until the close-up view is
  // open — toggling calibration on opens it automatically (registered
  // after screenCalibration's own click handler, so the class is already
  // up to date by the time this runs).
  screenCalibrationEls.toggleBtn.addEventListener("click", () => {
    if (document.body.classList.contains("calibrating-screen")) desktopView.open(innerWidth / 2, innerHeight / 2);
  });
  addEventListener("resize", () => screenCalibration.update());
  screenCalibration.update();
}
