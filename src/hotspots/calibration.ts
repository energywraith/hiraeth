import type { Point } from "../types";
import { HOTSPOTS, resetHotspots, setHotspotPoint } from "./config";

interface HotspotCalibrationElements {
  scene: HTMLElement;
  toggleBtn: HTMLButtonElement;
  panel: HTMLElement;
  select: HTMLSelectElement;
  svg: SVGSVGElement;
  readout: HTMLTextAreaElement;
  copyBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;
}

const ACTIVE_CLASS = "calibrating-hotspots";

/** Same drag/nudge/copy workflow as ../scene/skyMaskCalibration.ts, but
 * there are several named polygons instead of one — so handles are only
 * created for the currently-selected hotspot (picked via the dropdown or
 * Tab), while every hotspot's outline is drawn for context. */
export function initHotspotCalibration(els: HotspotCalibrationElements, onChange: () => void): { update: () => void } {
  let current = 0;
  let selPoint = -1;
  let drag = -1;
  let handles: HTMLElement[] = [];

  els.select.innerHTML = HOTSPOTS.map((h, i) => `<option value="${i}">${h.label}</option>`).join("");

  function pointerToFraction(e: PointerEvent): Point {
    const r = els.scene.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    ];
  }

  function rebuildHandles(): void {
    handles.forEach((h) => h.remove());
    selPoint = -1;
    handles = HOTSPOTS[current].points.map((_, i) => {
      const h = document.createElement("div");
      h.className = "hotspot-handle";
      h.dataset.label = String(i);
      els.scene.appendChild(h);
      h.addEventListener("pointerdown", (e) => {
        drag = i;
        selPoint = i;
        handles.forEach((x) => x.classList.remove("sel"));
        h.classList.add("sel");
        h.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      h.addEventListener("pointermove", (e) => {
        if (drag === i) {
          setHotspotPoint(current, i, pointerToFraction(e));
          update();
          onChange();
        }
      });
      h.addEventListener("pointerup", () => (drag = -1));
      return h;
    });
  }

  function selectHotspot(i: number): void {
    current = ((i % HOTSPOTS.length) + HOTSPOTS.length) % HOTSPOTS.length;
    els.select.value = String(current);
    rebuildHandles();
    // Pin the panel to whichever side the selected hotspot ISN'T on, so it
    // never covers the very points you're trying to drag (the moon and
    // telescope both sit top-right, right where the panel defaults to).
    const points = HOTSPOTS[current].points;
    const avgX = points.reduce((sum, [x]) => sum + x, 0) / points.length;
    els.panel.classList.toggle("pin-left", avgX > 0.5);
    update();
  }

  function update(): void {
    const W = els.scene.clientWidth;
    const H = els.scene.clientHeight;
    if (!W || !H) return;

    els.svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    els.svg.setAttribute("width", String(W));
    els.svg.setAttribute("height", String(H));
    els.svg.innerHTML = HOTSPOTS.map((h, i) => {
      const pts = h.points.map(([x, y]) => `${x * W},${y * H}`).join(" ");
      const stroke = i === current ? "#ff6fd8" : "#ffffff33";
      return `<polygon points="${pts}" fill="none" stroke="${stroke}" stroke-width="1.5"/>`;
    }).join("");

    handles.forEach((h, i) => {
      const p = HOTSPOTS[current].points[i];
      h.style.left = `${p[0] * 100}%`;
      h.style.top = `${p[1] * 100}%`;
    });

    els.readout.value =
      "export const HOTSPOTS: Hotspot[] = [\n" +
      HOTSPOTS.map(
        (h) =>
          `  { id: "${h.id}", label: "${h.label}", points: [${h.points
            .map((p) => `[${p[0].toFixed(4)}, ${p[1].toFixed(4)}]`)
            .join(", ")}] },`,
      ).join("\n") +
      "\n];";
  }

  els.select.addEventListener("change", () => selectHotspot(Number(els.select.value)));

  els.toggleBtn.addEventListener("click", () => {
    // Mutually exclusive with the CRT + sky mask calibration modes — all
    // three toggle the same handle/panel visuals and would otherwise fight
    // over drag input.
    document.body.classList.remove("calibrating", "calibrating-mask");
    document.getElementById("calib")?.classList.remove("active");
    document.getElementById("maskCalib")?.classList.remove("active");
    document.body.classList.toggle(ACTIVE_CLASS);
    els.toggleBtn.classList.toggle("active");
    if (document.body.classList.contains(ACTIVE_CLASS)) selectHotspot(current);
    onChange();
  });
  addEventListener("keydown", (e) => {
    if (e.key === "h" && !/input|textarea/i.test((e.target as HTMLElement).tagName)) els.toggleBtn.click();
  });

  addEventListener("keydown", (e) => {
    if (!document.body.classList.contains(ACTIVE_CLASS)) return;
    if (/input|textarea|select/i.test((e.target as HTMLElement).tagName)) return;

    if (e.key === "Tab") {
      selectHotspot(current + (e.shiftKey ? -1 : 1));
      e.preventDefault();
      return;
    }

    if (selPoint < 0) return;
    const step = e.shiftKey ? 0.004 : 0.0008;
    let d: Point | null = null;
    const k = e.key;
    if (k === "ArrowLeft" || k === "Left") d = [-step, 0];
    else if (k === "ArrowRight" || k === "Right") d = [step, 0];
    else if (k === "ArrowUp" || k === "Up") d = [0, -step];
    else if (k === "ArrowDown" || k === "Down") d = [0, step];
    if (d) {
      const p = HOTSPOTS[current].points[selPoint];
      setHotspotPoint(current, selPoint, [p[0] + d[0], p[1] + d[1]]);
      update();
      onChange();
      e.preventDefault();
    }
  });

  els.copyBtn.addEventListener("click", () => {
    els.readout.select();
    navigator.clipboard?.writeText(els.readout.value);
  });
  els.resetBtn.addEventListener("click", () => {
    resetHotspots();
    rebuildHandles();
    update();
    onChange();
  });

  return { update };
}
