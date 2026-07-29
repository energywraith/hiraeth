import { skyMaskClipPath } from "./skyMask";

export function initComet(comet: HTMLElement, wrap: HTMLElement): { refresh: () => void } {
  const refresh = (): void => {
    wrap.style.clipPath = skyMaskClipPath();
  };
  refresh();
  const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  if (reduce) return { refresh };

  function fly(): void {
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    const sx = 0.6 * W;
    const ex = 0.95 * W;
    const sy = (0.02 + Math.random() * 0.18) * H;
    const dx = ex - sx;
    const dy = H * 0.35;
    // Rotate the sprite to match its actual travel vector exactly, so the
    // head/tail always point the way the comet is really moving.
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    comet.style.transition = "none";
    comet.style.left = `${sx}px`;
    comet.style.top = `${sy}px`;
    comet.style.transform = `rotate(${angle}deg)`;
    comet.style.opacity = "0";

    requestAnimationFrame(() => {
      comet.style.transition = "left 1.4s linear, top 1.4s linear, opacity 1.4s ease-in-out";
      comet.style.opacity = "1";
      comet.style.left = `${ex}px`;
      comet.style.top = `${sy + dy}px`;
      setTimeout(() => (comet.style.opacity = "0"), 1100);
    });

    setTimeout(fly, 8000 + Math.random() * 10000);
  }

  setTimeout(fly, 4000);
  return { refresh };
}
