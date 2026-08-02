import type { EdgeName, Point } from "../types";
import {
  SCREEN_CORNERS,
  SCREEN_EDGE_BULGE,
  nudgeScreenBulge,
  resetScreenCalibration,
  screenBoundary,
  screenBulgeFocus,
  setScreenBulgeFocus,
  setScreenCorner,
} from "./screenMask";

interface ScreenCalibrationElements {
  /** .desktop-frame — SCREEN_CORNERS are fractions of it (same as CORNERS
   * are fractions of #scene for the main CRT calibration). */
  frame: HTMLElement;
  toggleBtn: HTMLButtonElement;
  handles: HTMLElement[];
  quad: SVGPolygonElement;
  readout: HTMLTextAreaElement;
  copyBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;
}

const ACTIVE_CLASS = "calibrating-screen";
const EDGE_KEYS: Record<string, EdgeName> = { "1": "top", "2": "right", "3": "bottom", "4": "left", "0": "all" };

/** Same corners + per-edge bulge workflow as ../crt/calibration.ts, just
 * pointed at .desktop-frame/SCREEN_CORNERS instead of #scene/CORNERS —
 * duplicated rather than shared, since that module reads/writes ../crt/
 * config.ts specifically (see its own header comment) and this one has no
 * Pixi mesh to keep in sync, only a CSS clip-path. */
export function initScreenCalibration(els: ScreenCalibrationElements, onChange: () => void): { update: () => void } {
  function update(): void {
    const W = els.frame.clientWidth;
    const H = els.frame.clientHeight;
    if (!W || !H) return;

    els.handles.forEach((h, i) => {
      h.style.left = `${SCREEN_CORNERS[i][0] * 100}%`;
      h.style.top = `${SCREEN_CORNERS[i][1] * 100}%`;
    });

    els.quad.setAttribute("points", screenBoundary().map(([x, y]) => `${x * W},${y * H}`).join(" "));
    const svg = els.quad.parentNode as SVGSVGElement;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", String(W));
    svg.setAttribute("height", String(H));

    els.readout.value =
      "export const SCREEN_CORNERS: Corners = [\n" +
      SCREEN_CORNERS.map((p, i) => `  [${p[0].toFixed(4)}, ${p[1].toFixed(4)}], // ${["TL", "TR", "BR", "BL"][i]}`).join(
        "\n",
      ) +
      `\n];\nexport const SCREEN_EDGE_BULGE: EdgeBulge = { top: ${SCREEN_EDGE_BULGE.top.toFixed(4)}, right: ${SCREEN_EDGE_BULGE.right.toFixed(4)}, ` +
      `bottom: ${SCREEN_EDGE_BULGE.bottom.toFixed(4)}, left: ${SCREEN_EDGE_BULGE.left.toFixed(4)} }; // focus: ${screenBulgeFocus}`;
  }

  els.toggleBtn.addEventListener("click", () => {
    // Mutually exclusive with the main scene's three calibration modes —
    // this one lives on a totally different element (.desktop-frame, not
    // #scene) but still shouldn't stack with them visually/input-wise.
    document.body.classList.remove("calibrating", "calibrating-mask", "calibrating-hotspots");
    document.getElementById("calib")?.classList.remove("active");
    document.getElementById("maskCalib")?.classList.remove("active");
    document.getElementById("hotspotCalib")?.classList.remove("active");
    document.body.classList.toggle(ACTIVE_CLASS);
    els.toggleBtn.classList.toggle("active");
    onChange();
  });
  addEventListener("keydown", (e) => {
    if (e.key === "s" && !/input|textarea/i.test((e.target as HTMLElement).tagName)) els.toggleBtn.click();
  });

  let sel = -1;
  let drag = -1;
  function pointerToFraction(e: PointerEvent): Point {
    const r = els.frame.getBoundingClientRect();
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
        setScreenCorner(i, pointerToFraction(e));
        update();
        onChange();
      }
    });
    h.addEventListener("pointerup", () => {
      drag = -1;
    });
  });

  addEventListener("keydown", (e) => {
    if (sel < 0 || !document.body.classList.contains(ACTIVE_CLASS)) return;
    const step = e.shiftKey ? 0.004 : 0.0008;
    let d: Point | null = null;
    const k = e.key;
    if (k === "ArrowLeft" || k === "Left") d = [-step, 0];
    else if (k === "ArrowRight" || k === "Right") d = [step, 0];
    else if (k === "ArrowUp" || k === "Up") d = [0, -step];
    else if (k === "ArrowDown" || k === "Down") d = [0, step];
    if (d) {
      setScreenCorner(sel, [SCREEN_CORNERS[sel][0] + d[0], SCREEN_CORNERS[sel][1] + d[1]]);
      update();
      onChange();
      e.preventDefault();
    }
  });

  addEventListener("keydown", (e) => {
    if (!document.body.classList.contains(ACTIVE_CLASS) || /input|textarea/i.test((e.target as HTMLElement).tagName)) return;
    const edge = EDGE_KEYS[e.key];
    if (edge) {
      setScreenBulgeFocus(edge);
      update();
      return;
    }
    if (e.key === "[" || e.key === "]") {
      nudgeScreenBulge(screenBulgeFocus, (e.key === "]" ? 1 : -1) * 0.002);
      update();
      onChange();
    }
  });

  els.copyBtn.addEventListener("click", () => {
    els.readout.select();
    navigator.clipboard?.writeText(els.readout.value);
  });
  els.resetBtn.addEventListener("click", () => {
    resetScreenCalibration();
    update();
    onChange();
  });

  return { update };
}
