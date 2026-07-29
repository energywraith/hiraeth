import type { Grid, Point } from "../types";
import { CORNERS, EDGE_BULGE } from "./config";

const COLS = 14;
const ROWS = 11;

// A real matrix3d/perspective transform always keeps edges straight — to get
// curved glass we build an actual Coons-patch mesh: 4 corners stay fixed,
// each edge bows outward by its own amount.
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

function coons(
  u: number,
  v: number,
  TL: Point,
  TR: Point,
  BR: Point,
  BL: Point,
  bTop: number,
  bRight: number,
  bBottom: number,
  bLeft: number,
  center: Point,
): Point {
  const top = edgePoint(u, TL, TR, bTop, center);
  const bot = edgePoint(u, BL, BR, bBottom, center);
  const left = edgePoint(v, TL, BL, bLeft, center);
  const right = edgePoint(v, TR, BR, bRight, center);
  const bx = (1 - u) * (1 - v) * TL[0] + u * (1 - v) * TR[0] + (1 - u) * v * BL[0] + u * v * BR[0];
  const by = (1 - u) * (1 - v) * TL[1] + u * (1 - v) * TR[1] + (1 - u) * v * BL[1] + u * v * BR[1];
  return [
    (1 - v) * top[0] + v * bot[0] + (1 - u) * left[0] + u * right[0] - bx,
    (1 - v) * top[1] + v * bot[1] + (1 - u) * left[1] + u * right[1] - by,
  ];
}

/** The single geometry entry point — everything that needs screen shape
 * (Pixi mesh, calibration overlay) must go through this, reading CORNERS/
 * EDGE_BULGE from ./config. */
export function buildGrid(W: number, H: number): Grid {
  const TL: Point = [CORNERS[0][0] * W, CORNERS[0][1] * H];
  const TR: Point = [CORNERS[1][0] * W, CORNERS[1][1] * H];
  const BR: Point = [CORNERS[2][0] * W, CORNERS[2][1] * H];
  const BL: Point = [CORNERS[3][0] * W, CORNERS[3][1] * H];
  const center: Point = [(TL[0] + TR[0] + BR[0] + BL[0]) / 4, (TL[1] + TR[1] + BR[1] + BL[1]) / 4];
  const bTop = EDGE_BULGE.top * W;
  const bRight = EDGE_BULGE.right * W;
  const bBottom = EDGE_BULGE.bottom * W;
  const bLeft = EDGE_BULGE.left * W;

  const positions = new Float32Array((COLS + 1) * (ROWS + 1) * 2);
  const uvs = new Float32Array((COLS + 1) * (ROWS + 1) * 2);
  let p = 0;
  for (let j = 0; j <= ROWS; j++) {
    for (let i = 0; i <= COLS; i++) {
      const u = i / COLS;
      const v = j / ROWS;
      const [x, y] = coons(u, v, TL, TR, BR, BL, bTop, bRight, bBottom, bLeft, center);
      positions[p * 2] = x;
      positions[p * 2 + 1] = y;
      uvs[p * 2] = u;
      uvs[p * 2 + 1] = v;
      p++;
    }
  }

  const indices: number[] = [];
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const a = j * (COLS + 1) + i;
      const b = a + 1;
      const c = a + COLS + 1;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  // Boundary path (for the yellow calibration outline) — walk all 4 bulged edges.
  const bpath: Point[] = [];
  for (let i = 0; i <= COLS; i++) bpath.push(edgePoint(i / COLS, TL, TR, bTop, center));
  for (let j = 0; j <= ROWS; j++) bpath.push(edgePoint(j / ROWS, TR, BR, bRight, center));
  for (let i = COLS; i >= 0; i--) bpath.push(edgePoint(i / COLS, BL, BR, bBottom, center));
  for (let j = ROWS; j >= 0; j--) bpath.push(edgePoint(j / ROWS, TL, BL, bLeft, center));

  return { positions, uvs, indices: Uint32Array.from(indices), bpath };
}
