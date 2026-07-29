export interface OverlayElements {
  root: HTMLElement;
  titleEl: HTMLElement;
  bodyEl: HTMLElement;
  closeBtn: HTMLButtonElement;
}

/** Generic click-to-reveal modal, reused by every hotspot regardless of what
 * it shows (poster text, computer flavor text, etc.) — see ./content.ts for
 * the per-hotspot copy. */
export function initOverlay(els: OverlayElements): { open: (title: string, bodyHtml: string) => void; close: () => void } {
  function close(): void {
    els.root.classList.remove("open");
  }

  function open(title: string, bodyHtml: string): void {
    els.titleEl.textContent = title;
    els.bodyEl.innerHTML = bodyHtml;
    els.root.classList.add("open");
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
