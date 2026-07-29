import type { Corners, EdgeBulge, EdgeName, Point } from "../types";

// ======= EDIT THESE: the 4 glass corners, as fractions (0-1) of the scene =======
// This module is the ONLY source of truth for screen geometry — mesh.ts reads
// these to build the grid, calibration.ts writes to them via the setters
// below. Do not duplicate corner/bulge state anywhere else.
export const CORNERS: Corners = [
  [0.3304, 0.4041],  // TL
  [0.4576, 0.4059],  // TR
  [0.4612, 0.5766],  // BR
  [0.3346, 0.5941],  // BL
];

// Bulge per edge, as a fraction of scene width. The screen is viewed at an
// angle, so edges facing the camera bulge visibly while a grazing-angle edge
// (here: left) has its curvature foreshortened away / hidden behind the
// bezel — so it should stay near-flat. Tune each independently.
export const EDGE_BULGE: EdgeBulge = { top: 0.003, right: 0.004, bottom: 0.002, left: 0 };

const DEFAULT_CORNERS: Corners = structuredClone(CORNERS);
const DEFAULT_BULGE: EdgeBulge = structuredClone(EDGE_BULGE);

export let bulgeFocus: EdgeName = "right"; // which edge [ / ] currently adjusts ('all' = every edge)
export function setBulgeFocus(edge: EdgeName): void {
  bulgeFocus = edge;
}

export function setCorner(i: number, p: Point): void {
  CORNERS[i] = p;
}

export function nudgeBulge(edge: EdgeName, delta: number): void {
  const clamp = (v: number) => Math.max(0, Math.min(0.05, v));
  if (edge === "all") {
    for (const k of Object.keys(EDGE_BULGE) as (keyof EdgeBulge)[]) {
      EDGE_BULGE[k] = clamp(EDGE_BULGE[k] + delta);
    }
  } else {
    EDGE_BULGE[edge] = clamp(EDGE_BULGE[edge] + delta);
  }
}

export function resetCalibration(): void {
  DEFAULT_CORNERS.forEach((p, i) => (CORNERS[i] = [...p]));
  Object.assign(EDGE_BULGE, structuredClone(DEFAULT_BULGE));
}
