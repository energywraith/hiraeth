import type { EdgeName, Point } from "../types";
import { buildGrid } from "./mesh";
import { CORNERS, EDGE_BULGE, bulgeFocus, nudgeBulge, resetCalibration, setBulgeFocus, setCorner } from "./config";

interface CalibrationElements {
  scene: HTMLElement;
  calibrateBtn: HTMLButtonElement;
  handles: HTMLElement[];
  quad: SVGPolygonElement;
  readout: HTMLTextAreaElement;
  copyBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;
}

const EDGE_KEYS: Record<string, EdgeName> = { "1": "top", "2": "right", "3": "bottom", "4": "left", "0": "all" };

/** Positions the drag handles, draws the yellow outline, and refreshes the
 * copy-paste readout. Reads CORNERS/EDGE_BULGE from ./config — the same
 * source ./mesh.buildGrid uses, so the overlay always matches the mesh. */
export function updateCalibrationOverlay(els: CalibrationElements): void {
  const W = els.scene.clientWidth;
  const H = els.scene.clientHeight;
  if (!W || !H) return;

  els.handles.forEach((h, i) => {
    h.style.left = `${CORNERS[i][0] * 100}%`;
    h.style.top = `${CORNERS[i][1] * 100}%`;
  });

  const { bpath } = buildGrid(W, H);
  els.quad.setAttribute("points", bpath.map(([x, y]) => `${x},${y}`).join(" "));
  const svg = els.quad.parentNode as SVGSVGElement;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", String(W));
  svg.setAttribute("height", String(H));

  els.readout.value =
    "let CORNERS = [\n" +
    CORNERS.map((p, i) => `  [${p[0].toFixed(4)}, ${p[1].toFixed(4)}],  // ${["TL", "TR", "BR", "BL"][i]}`).join(
      "\n",
    ) +
    `\n];\nlet EDGE_BULGE = { top:${EDGE_BULGE.top.toFixed(4)}, right:${EDGE_BULGE.right.toFixed(4)}, ` +
    `bottom:${EDGE_BULGE.bottom.toFixed(4)}, left:${EDGE_BULGE.left.toFixed(4)} };  // focus: ${bulgeFocus}`;
}

export function initCalibration(els: CalibrationElements, onChange: () => void): void {
  els.calibrateBtn.addEventListener("click", () => {
    // Mutually exclusive with the sky mask calibration mode (see
    // ../scene/skyMaskCalibration.ts) — both toggle the same handle/panel
    // visuals and would otherwise fight over drag input.
    document.body.classList.remove("calibrating-mask");
    document.getElementById("maskCalib")?.classList.remove("active");
    document.body.classList.toggle("calibrating");
    els.calibrateBtn.classList.toggle("active");
    onChange();
  });
  addEventListener("keydown", (e) => {
    if (e.key === "c" && !/input|textarea/i.test((e.target as HTMLElement).tagName)) els.calibrateBtn.click();
  });

  let sel = -1;
  let drag = -1;
  function pointerToFraction(e: PointerEvent): Point {
    const r = els.scene.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  }

  els.handles.forEach((h, i) => {
    h.addEventListener("pointerdown", (e) => {
      drag = i;
      sel = i;
      els.handles.forEach((x) => x.classList.remove("sel"));
      h.classList.add("sel");
      h.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    h.addEventListener("pointermove", (e) => {
      if (drag === i) {
        setCorner(i, pointerToFraction(e));
        onChange();
      }
    });
    h.addEventListener("pointerup", () => {
      drag = -1;
    });
  });

  addEventListener("keydown", (e) => {
    if (sel < 0 || !document.body.classList.contains("calibrating")) return;
    const step = e.shiftKey ? 0.004 : 0.0008;
    let d: Point | null = null;
    const k = e.key;
    if (k === "ArrowLeft" || k === "Left") d = [-step, 0];
    else if (k === "ArrowRight" || k === "Right") d = [step, 0];
    else if (k === "ArrowUp" || k === "Up") d = [0, -step];
    else if (k === "ArrowDown" || k === "Down") d = [0, step];
    if (d) {
      setCorner(sel, [CORNERS[sel][0] + d[0], CORNERS[sel][1] + d[1]]);
      onChange();
      e.preventDefault();
    }
  });

  addEventListener("keydown", (e) => {
    if (!document.body.classList.contains("calibrating") || /input|textarea/i.test((e.target as HTMLElement).tagName))
      return;
    const edge = EDGE_KEYS[e.key];
    if (edge) {
      setBulgeFocus(edge);
      onChange();
      return;
    }
    if (e.key === "[" || e.key === "]") {
      nudgeBulge(bulgeFocus, (e.key === "]" ? 1 : -1) * 0.002);
      onChange();
    }
  });

  els.copyBtn.addEventListener("click", () => {
    els.readout.select();
    navigator.clipboard?.writeText(els.readout.value);
  });
  els.resetBtn.addEventListener("click", () => {
    resetCalibration();
    onChange();
  });
}
