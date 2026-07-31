export interface OverlayElements {
  root: HTMLElement;
  titleEl: HTMLElement;
  bodyEl: HTMLElement;
  imageEl: HTMLImageElement;
  closeBtn: HTMLButtonElement;
}

/** Generic click-to-reveal "examine" panel, reused by every hotspot
 * regardless of what it shows (poster text, computer flavor text, etc.) —
 * see ./content.ts for the per-hotspot copy and close-up image. */
export function initOverlay(els: OverlayElements): { open: (title: string, bodyHtml: string, imageSrc: string) => void; close: () => void } {
  function close(): void {
    els.root.classList.remove("open");
  }

  function open(title: string, bodyHtml: string, imageSrc: string): void {
    els.titleEl.textContent = title;
    els.bodyEl.innerHTML = bodyHtml;
    els.imageEl.src = imageSrc;
    els.imageEl.alt = title;
    els.root.classList.add("open");
    // Restart the flicker-in animation even if the same image element is
    // reused for the next hotspot clicked while the panel is still open.
    els.imageEl.classList.remove("flicker-in");
    void els.imageEl.offsetWidth;
    els.imageEl.classList.add("flicker-in");
  }

  els.closeBtn.addEventListener("click", close);
  els.root.addEventListener("click", (e) => {
    if (e.target === els.root) close();
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  return { open, close };
}
