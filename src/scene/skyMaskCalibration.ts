import type { Point } from "../types";
import { SKY_MASK, resetSkyMask, setMaskPoint } from "./skyMask";

interface MaskCalibrationElements {
  scene: HTMLElement;
  toggleBtn: HTMLButtonElement;
  quad: SVGPolygonElement;
  readout: HTMLTextAreaElement;
  copyBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;
}

const ACTIVE_CLASS = "calibrating-mask";

/** Same drag/nudge/copy workflow as ../crt/calibration.ts, but for the
 * variable-length SKY_MASK polygon instead of the CRT's fixed 4 corners —
 * so handles are created here (one per SKY_MASK point) rather than read
 * from static markup. */
export function initMaskCalibration(els: MaskCalibrationElements, onChange: () => void): { update: () => void } {
  const handles: HTMLElement[] = SKY_MASK.map((_, i) => {
    const h = document.createElement("div");
    h.className = "mask-handle";
    h.dataset.label = String(i);
    els.scene.appendChild(h);
    return h;
  });

  function update(): void {
    const W = els.scene.clientWidth;
    const H = els.scene.clientHeight;
    if (!W || !H) return;

    handles.forEach((h, i) => {
      h.style.left = `${SKY_MASK[i][0] * 100}%`;
      h.style.top = `${SKY_MASK[i][1] * 100}%`;
    });

    els.quad.setAttribute("points", SKY_MASK.map(([x, y]) => `${x * W},${y * H}`).join(" "));
    const svg = els.quad.parentNode as SVGSVGElement;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", String(W));
    svg.setAttribute("height", String(H));

    els.readout.value =
      "export const SKY_MASK: Point[] = [\n" +
      SKY_MASK.map((p) => `  [${p[0].toFixed(4)}, ${p[1].toFixed(4)}],`).join("\n") +
      "\n];";
  }

  els.toggleBtn.addEventListener("click", () => {
    // Mutually exclusive with the other calibration modes (CRT screen and
    // hotspots) — all toggle the same handle/panel visuals and would
    // otherwise fight over drag input.
    document.body.classList.remove("calibrating", "calibrating-hotspots");
    document.getElementById("calib")?.classList.remove("active");
    document.getElementById("hotspotCalib")?.classList.remove("active");
    document.body.classList.toggle(ACTIVE_CLASS);
    els.toggleBtn.classList.toggle("active");
    onChange();
  });
  addEventListener("keydown", (e) => {
    if (e.key === "m" && !/input|textarea/i.test((e.target as HTMLElement).tagName)) els.toggleBtn.click();
  });

  let sel = -1;
  let drag = -1;
  function pointerToFraction(e: PointerEvent): Point {
    const r = els.scene.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    ];
  }

  handles.forEach((h, i) => {
    h.addEventListener("pointerdown", (e) => {
      drag = i;
      sel = i;
      handles.forEach((x) => x.classList.remove("sel"));
      h.classList.add("sel");
      h.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    h.addEventListener("pointermove", (e) => {
      if (drag === i) {
        setMaskPoint(i, pointerToFraction(e));
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
      setMaskPoint(sel, [SKY_MASK[sel][0] + d[0], SKY_MASK[sel][1] + d[1]]);
      onChange();
      e.preventDefault();
    }
  });

  els.copyBtn.addEventListener("click", () => {
    els.readout.select();
    navigator.clipboard?.writeText(els.readout.value);
  });
  els.resetBtn.addEventListener("click", () => {
    resetSkyMask();
    onChange();
  });

  return { update };
}
