import type { Point } from "../types";

// The patch of open sky actually visible through the bedroom window in
// scene.png, as fractions (0-1) of the scene. A plain rectangle doesn't
// fit: the curtains eat into both sides and the telescope sits in front
// of the glass, crossing straight through the window. So this is a single
// concave polygon — frame/curtain edges on the outside, a notch cut out
// following the telescope tube on the bottom-right. This is the only
// place that defines the shape; starfield.ts and comet.ts both read it
// (for placement and for clipping) rather than each hand-rolling their
// own bounds. Hand-fit by eye against the current photo — re-fit here if
// scene.png (or the telescope's position in it) changes.
export const SKY_MASK: Point[] = [
  [0.6667, 0.0296],
  [0.9123, 0.0000],
  [0.8953, 0.5026],
  [0.8275, 0.4423],
  [0.8152, 0.4621],
  [0.7012, 0.3467],
  [0.6766, 0.4225],
  [0.7708, 0.5286],
  [0.7602, 0.5535],
  [0.6719, 0.5369],
  [0.6702, 0.4901],
];

const DEFAULT_SKY_MASK: Point[] = structuredClone(SKY_MASK);

export function setMaskPoint(i: number, p: Point): void {
  SKY_MASK[i] = p;
}

export function resetSkyMask(): void {
  DEFAULT_SKY_MASK.forEach((p, i) => (SKY_MASK[i] = [...p]));
}

export function skyMaskClipPath(): string {
  return `polygon(${SKY_MASK.map(([x, y]) => `${x * 100}% ${y * 100}%`).join(", ")})`;
}

export function pointInSkyMask(fx: number, fy: number): boolean {
  let inside = false;
  for (let i = 0, j = SKY_MASK.length - 1; i < SKY_MASK.length; j = i++) {
    const [xi, yi] = SKY_MASK[i];
    const [xj, yj] = SKY_MASK[j];
    const intersect = yi > fy !== yj > fy && fx < ((xj - xi) * (fy - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Recomputed (not cached) so it always reflects live edits made through the
// mask calibration tool.
export function skyMaskBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
  return SKY_MASK.reduce(
    (b, [x, y]) => ({
      minX: Math.min(b.minX, x),
      maxX: Math.max(b.maxX, x),
      minY: Math.min(b.minY, y),
      maxY: Math.max(b.maxY, y),
    }),
    { minX: 1, maxX: 0, minY: 1, maxY: 0 },
  );
}
