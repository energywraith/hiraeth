import { HOTSPOTS, hotspotClipPath } from "./config";
import { HOTSPOT_CONTENT } from "./content";

/** Renders one transparent, clip-path-shaped button per HOTSPOTS entry —
 * clip-path both draws the highlight-on-hover shape (via CSS) and narrows
 * the button's own hit-testing to that shape, so no manual point-in-polygon
 * check is needed for hover/click. */
export function initHotspots(container: HTMLElement, onOpen: (id: string, title: string, body: string, image: string, e: MouseEvent) => void): { update: () => void } {
  const els = HOTSPOTS.map((h) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "hotspot";
    el.setAttribute("aria-label", h.label);
    el.addEventListener("click", (e) => {
      const content = HOTSPOT_CONTENT[h.id];
      if (content) onOpen(h.id, content.title, content.body, content.image, e);
    });
    container.appendChild(el);
    return el;
  });

  function update(): void {
    HOTSPOTS.forEach((h, i) => {
      els[i].style.clipPath = hotspotClipPath(h);
    });
  }

  return { update };
}
