import type { Corners, EdgeBulge, EdgeName, Point } from "../types";

// The glass of public/scene-computer.png's monitor, viewed close to head-on
// rather than at the angle scene.png's CRT is — but still a real convex
// tube, so it gets the same Coons-patch model as src/crt/config.ts/mesh.ts:
// 4 corners fixed, each edge bulging outward by its own amount. Fit with
// the screen calibration tool (the "screen" button or `s` key, only
// available with the close-up view open) rather than guessed by hand.
//
// Unlike the CRT, nothing here needs a live Pixi mesh — desktopView.ts's
// UI is flat DOM, so this only ever needs to produce a CSS clip-path
// polygon (see screenMaskClipPath below), not real 3D-mapped geometry.
export const SCREEN_CORNERS: Corners = [
  [0.2398, 0.1519], // TL
  [0.7432, 0.1502], // TR
  [0.7493, 0.7383], // BR
  [0.2388, 0.7384], // BL
];
export const SCREEN_EDGE_BULGE: EdgeBulge = { top: 0.0060, right: 0.0080, bottom: 0.0080, left: 0.0100 }; // focus: bottom

const DEFAULT_SCREEN_CORNERS: Corners = structuredClone(SCREEN_CORNERS);
const DEFAULT_SCREEN_EDGE_BULGE: EdgeBulge = structuredClone(SCREEN_EDGE_BULGE);

export let screenBulgeFocus: EdgeName = "right";
export function setScreenBulgeFocus(edge: EdgeName): void {
  screenBulgeFocus = edge;
}

export function setScreenCorner(i: number, p: Point): void {
  SCREEN_CORNERS[i] = p;
}

export function nudgeScreenBulge(edge: EdgeName, delta: number): void {
  const clamp = (v: number) => Math.max(0, Math.min(0.05, v));
  if (edge === "all") {
    for (const k of Object.keys(SCREEN_EDGE_BULGE) as (keyof EdgeBulge)[]) {
      SCREEN_EDGE_BULGE[k] = clamp(SCREEN_EDGE_BULGE[k] + delta);
    }
  } else {
    SCREEN_EDGE_BULGE[edge] = clamp(SCREEN_EDGE_BULGE[edge] + delta);
  }
}

export function resetScreenCalibration(): void {
  DEFAULT_SCREEN_CORNERS.forEach((p, i) => (SCREEN_CORNERS[i] = [...p]));
  Object.assign(SCREEN_EDGE_BULGE, structuredClone(DEFAULT_SCREEN_EDGE_BULGE));
}

// public/scene-computer.png's own fixed pixel size — used only to convert
// the fractional corner/bulge geometry below into a real (aspect-correct)
// pixel space before computing bulge normals, exactly like src/crt/
// mesh.ts's buildGrid(W, H) does with the live scene size. The difference:
// a CSS clip-path's percentages already rescale with whatever size
// .desktop-frame renders at, so unlike the CRT mesh this never needs to
// re-run on viewport resize — the photo's own fixed dimensions are enough.
const PHOTO_W = 2048;
const PHOTO_H = 1152;
const BOUNDARY_STEPS = 20;

// Same curve as src/crt/mesh.ts's edgePoint — duplicated rather than
// imported/shared, since that module is deliberately CRT-only (see its own
// header comment) and this one needs no mesh/UV output, just the boundary.
function edgePoint(u: number, A: Point, B: Point, bulge: number, center: Point): Point {
  const bx = A[0] + (B[0] - A[0]) * u;
  const by = A[1] + (B[1] - A[1]) * u;
  const ex = B[0] - A[0];
  const ey = B[1] - A[1];
  const len = Math.hypot(ex, ey) || 1;
  let nx = -ey / len;
  let ny = ex / len;
  const mx = (A[0] + B[0]) / 2;
  const my = (A[1] + B[1]) / 2;
  if (nx * (center[0] - mx) + ny * (center[1] - my) > 0) {
    nx = -nx;
    ny = -ny;
  }
  const w = 4 * u * (1 - u);
  return [bx + nx * bulge * w, by + ny * bulge * w];
}

/** Walks all 4 bulged edges (TL→TR→BR→BL→TL) at the photo's real pixel
 * size, then hands back the boundary as fractions of the photo — same
 * convention as SCREEN_CORNERS itself, and what both screenBounds() and
 * screenMaskClipPath() below build on. Recomputed on demand (cheap, ~80
 * points) rather than cached, so it always reflects live calibration
 * edits. */
export function screenBoundary(): Point[] {
  const TL: Point = [SCREEN_CORNERS[0][0] * PHOTO_W, SCREEN_CORNERS[0][1] * PHOTO_H];
  const TR: Point = [SCREEN_CORNERS[1][0] * PHOTO_W, SCREEN_CORNERS[1][1] * PHOTO_H];
  const BR: Point = [SCREEN_CORNERS[2][0] * PHOTO_W, SCREEN_CORNERS[2][1] * PHOTO_H];
  const BL: Point = [SCREEN_CORNERS[3][0] * PHOTO_W, SCREEN_CORNERS[3][1] * PHOTO_H];
  const center: Point = [(TL[0] + TR[0] + BR[0] + BL[0]) / 4, (TL[1] + TR[1] + BR[1] + BL[1]) / 4];
  const bTop = SCREEN_EDGE_BULGE.top * PHOTO_W;
  const bRight = SCREEN_EDGE_BULGE.right * PHOTO_W;
  const bBottom = SCREEN_EDGE_BULGE.bottom * PHOTO_W;
  const bLeft = SCREEN_EDGE_BULGE.left * PHOTO_W;

  const path: Point[] = [];
  for (let i = 0; i <= BOUNDARY_STEPS; i++) path.push(edgePoint(i / BOUNDARY_STEPS, TL, TR, bTop, center));
  for (let j = 0; j <= BOUNDARY_STEPS; j++) path.push(edgePoint(j / BOUNDARY_STEPS, TR, BR, bRight, center));
  for (let i = BOUNDARY_STEPS; i >= 0; i--) path.push(edgePoint(i / BOUNDARY_STEPS, BL, BR, bBottom, center));
  for (let j = BOUNDARY_STEPS; j >= 0; j--) path.push(edgePoint(j / BOUNDARY_STEPS, TL, BL, bLeft, center));

  return path.map(([x, y]): Point => [x / PHOTO_W, y / PHOTO_H]);
}

/** The boundary's own bounding box, as fractions of the full photo —
 * desktopView.ts sizes/positions `.desktop-screen` to this box, and
 * dollies the view in from/out to it (see placeFrameAt in
 * desktopView.ts), so both the clip-path and the zoom land on the actual
 * glass, not the whole photographed monitor. */
export function screenBounds(): { left: number; top: number; width: number; height: number } {
  const boundary = screenBoundary();
  const xs = boundary.map(([x]) => x);
  const ys = boundary.map(([, y]) => y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

/** The boundary re-expressed relative to its own bounding box (0-1), which
 * is what a clip-path polygon on an element already sized to that box
 * needs. */
export function screenMaskClipPath(): string {
  const boundary = screenBoundary();
  const b = screenBounds();
  const pts = boundary.map(([x, y]) => `${((x - b.left) / b.width) * 100}% ${((y - b.top) / b.height) * 100}%`);
  return `polygon(${pts.join(", ")})`;
}
