const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

function isCalibrating(): boolean {
  return (
    document.body.classList.contains("calibrating") ||
    document.body.classList.contains("calibrating-mask") ||
    document.body.classList.contains("calibrating-hotspots")
  );
}

/** Lets any calibration tool (CRT/mask/hotspots) scroll-to-zoom and
 * drag-to-pan the scene — needed for dense point clusters (e.g. the moon's
 * 16-point circle) where handles sit too close together to grab at 1x.
 * Applies a CSS transform to #scene itself; every calibration tool already
 * reads coordinates via scene.getBoundingClientRect() (which reflects the
 * transform) and sizes its SVG via scene.clientWidth/Height (layout-only,
 * unaffected by transform), so none of them need to know this exists. */
export function initCalibrationView(scene: HTMLElement): void {
  let zoom = 1;
  let tx = 0;
  let ty = 0;

  function clampPan(): void {
    const w0 = scene.clientWidth;
    const h0 = scene.clientHeight;
    tx = Math.min(0, Math.max(w0 * (1 - zoom), tx));
    ty = Math.min(0, Math.max(h0 * (1 - zoom), ty));
  }

  function apply(): void {
    scene.style.transform = zoom === 1 ? "" : `translate(${tx}px, ${ty}px) scale(${zoom})`;
  }

  function reset(): void {
    zoom = 1;
    tx = 0;
    ty = 0;
    apply();
  }

  scene.style.transformOrigin = "0 0";

  scene.addEventListener(
    "wheel",
    (e) => {
      if (!isCalibrating()) return;
      e.preventDefault();

      const w0 = scene.clientWidth;
      const h0 = scene.clientHeight;
      const rect = scene.getBoundingClientRect();
      const fx = (e.clientX - rect.left) / rect.width;
      const fy = (e.clientY - rect.top) / rect.height;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * Math.exp(-e.deltaY * 0.0015)));

      // Keep the point under the cursor fixed on screen while zooming.
      const originX = rect.left - tx;
      const originY = rect.top - ty;
      tx = e.clientX - originX - newZoom * fx * w0;
      ty = e.clientY - originY - newZoom * fy * h0;
      zoom = newZoom;
      clampPan();
      apply();
    },
    { passive: false },
  );

  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function isOnHandle(target: EventTarget | null): boolean {
    return !!(target as HTMLElement)?.closest?.(".handle, .mask-handle, .hotspot-handle");
  }

  scene.addEventListener("pointerdown", (e) => {
    if (!isCalibrating() || zoom === 1 || isOnHandle(e.target)) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    scene.setPointerCapture(e.pointerId);
    scene.classList.add("panning");
  });
  scene.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    tx += e.clientX - lastX;
    ty += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    clampPan();
    apply();
  });
  scene.addEventListener("pointerup", () => {
    dragging = false;
    scene.classList.remove("panning");
  });

  scene.addEventListener("dblclick", (e) => {
    if (!isCalibrating() || isOnHandle(e.target)) return;
    reset();
  });

  new MutationObserver(() => {
    if (!isCalibrating() && (zoom !== 1 || tx !== 0 || ty !== 0)) reset();
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
}
