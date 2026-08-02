import { DESKTOP_ICONS } from "./desktopContent";
import { screenBounds, screenMaskClipPath } from "./screenMask";

export interface DesktopViewElements {
  root: HTMLElement;
  frame: HTMLElement;
  /** Positioned/clipped to SCREEN_BOUNDS/SCREEN_MASK (see screenMask.ts) so
   * the chrome inside it lands exactly on the photographed glass in
   * public/scene-computer.png, not just a full-frame rectangle. */
  screenEl: HTMLElement;
  iconsEl: HTMLElement;
  windowEl: HTMLElement;
  windowTitleEl: HTMLElement;
  windowBodyEl: HTMLElement;
  windowCloseBtn: HTMLButtonElement;
  closeBtn: HTMLButtonElement;
  /** The decorative in-screen title bar's × (see .desktop-titlebar in
   * style.css) — cosmetic chrome, but wired to the same close() as
   * `closeBtn` so it isn't a dead button. */
  chromeCloseBtn: HTMLButtonElement;
}

/** Same "eyepiece" iris as ../telescope/skyView.ts (see its open()/
 * coveringRadius() for the original) — a clip-path: circle() grown from
 * the clicked point to cover the viewport, driven by CORNERS-free x/y this
 * time since there's no glass position to line up with: the frame is
 * always full-size behind the mask, so any click point works. Swapped in
 * after the previous dolly-zoom (frame scaling in from the glass's
 * on-screen rect) read as visually inconsistent with the telescope's entry
 * — this reuses the exact same motion instead of a second, different one. */
export function initDesktopView(els: DesktopViewElements): { open: (x: number, y: number) => void; close: () => void; updateScreenGeometry: () => void } {
  let isOpen = false;
  let built = false;
  const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  let originX = innerWidth / 2;
  let originY = innerHeight / 2;

  // Positions/clips .desktop-screen to the current SCREEN_CORNERS/
  // SCREEN_EDGE_BULGE (see screenMask.ts) — split out from build() so the
  // screen calibration tool can re-run just this part live while dragging,
  // without rebuilding the icon buttons every frame.
  function updateScreenGeometry(): void {
    const b = screenBounds();
    els.screenEl.style.left = `${b.left * 100}%`;
    els.screenEl.style.top = `${b.top * 100}%`;
    els.screenEl.style.width = `${b.width * 100}%`;
    els.screenEl.style.height = `${b.height * 100}%`;
    els.screenEl.style.clipPath = screenMaskClipPath();
  }

  function build(): void {
    updateScreenGeometry();

    for (const icon of DESKTOP_ICONS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "desktop-icon";
      btn.innerHTML = `<span class="desktop-icon-art">${icon.glyph}</span><span class="desktop-icon-label">${icon.label}</span>`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openWindow(icon.id);
      });
      els.iconsEl.appendChild(btn);
    }
    built = true;
  }

  function openWindow(id: string): void {
    const icon = DESKTOP_ICONS.find((d) => d.id === id);
    if (!icon) return;
    els.windowTitleEl.textContent = icon.windowTitle;
    els.windowBodyEl.innerHTML = icon.body;
    els.windowEl.hidden = false;
  }

  function closeWindow(): void {
    els.windowEl.hidden = true;
  }

  function coveringRadius(x: number, y: number): number {
    const corners: [number, number][] = [
      [0, 0],
      [innerWidth, 0],
      [0, innerHeight],
      [innerWidth, innerHeight],
    ];
    let max = 0;
    for (const [cx, cy] of corners) max = Math.max(max, Math.hypot(cx - x, cy - y));
    return max + 40;
  }

  function open(x: number, y: number): void {
    if (!built) build();
    isOpen = true;
    originX = x;
    originY = y;
    closeWindow();

    const radius = coveringRadius(x, y);
    els.root.style.clipPath = `circle(0px at ${x}px ${y}px)`;
    els.root.classList.add("open");
    if (reduce) {
      els.root.style.clipPath = `circle(${radius}px at ${x}px ${y}px)`;
    } else {
      // Two rAFs: the first commits the 0px starting state to a rendered
      // frame, the second changes it — otherwise the browser can coalesce
      // both writes into one frame and the CSS transition never triggers.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          els.root.style.clipPath = `circle(${radius}px at ${x}px ${y}px)`;
        });
      });
    }
  }

  function close(): void {
    if (!isOpen) return;
    isOpen = false;
    els.root.classList.remove("open");
    els.root.style.clipPath = `circle(0px at ${originX}px ${originY}px)`;
    closeWindow();
  }

  els.closeBtn.addEventListener("click", close);
  els.chromeCloseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    close();
  });
  els.windowEl.addEventListener("click", (e) => e.stopPropagation());
  els.windowCloseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeWindow();
  });
  els.frame.addEventListener("click", () => closeWindow());

  return { open, close, updateScreenGeometry };
}
