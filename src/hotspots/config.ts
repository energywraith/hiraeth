import type { Point } from "../types";

export interface Hotspot {
  id: string;
  label: string;
  points: Point[];
}

// Clickable regions over scene.png, as fractions (0-1) of the scene — same
// convention as SKY_MASK/CORNERS. This is the only place that defines
// hotspot geometry; interaction.ts (hover/click) and calibration.ts (the
// drag tool) both read it rather than hand-rolling their own bounds. Hand-fit
// by eye against the current photo — re-fit with the hotspot calibration
// tool (the "hotspots" button or `h` key) if scene.png changes.
export const HOTSPOTS: Hotspot[] = [
  { id: "poster-moon", label: "Moon phases poster", points: [[0.0450, 0.0000], [0.2135, 0.0000], [0.2082, 0.3331], [0.0421, 0.3165]] },
  { id: "poster-chart", label: "Star chart", points: [[0.2368, 0.0545], [0.3380, 0.0878], [0.3368, 0.3508], [0.2392, 0.3456]] },
  { id: "poster-map", label: "Moon map", points: [[0.0415, 0.3300], [0.2064, 0.3404], [0.2076, 0.5421], [0.0456, 0.5515]] },
  { id: "computer", label: "Computer", points: [[0.3290, 0.4019], [0.4602, 0.4027], [0.4654, 0.5815], [0.3351, 0.5914]] },
  { id: "floppy-disks", label: "Floppy disks", points: [[0.0713, 0.7771], [0.2754, 0.7500], [0.2988, 0.8571], [0.0860, 0.8405]] },
  { id: "telescope", label: "Telescope", points: [[0.6650, 0.3600], [0.9500, 0.3800], [0.9500, 0.6000], [0.8000, 0.9700], [0.6650, 0.9000]] },
  { id: "moon", label: "The moon", points: [[0.8768, 0.2435], [0.8745, 0.2864], [0.8592, 0.3408], [0.8317, 0.3717], [0.7955, 0.3754], [0.7667, 0.3507], [0.7489, 0.2950], [0.7458, 0.2592], [0.7524, 0.2239], [0.7614, 0.1886], [0.7764, 0.1633], [0.7910, 0.1490], [0.8129, 0.1416], [0.8335, 0.1453], [0.8540, 0.1652], [0.8695, 0.2007]] },
];

const DEFAULT_HOTSPOTS: Hotspot[] = structuredClone(HOTSPOTS);

export function setHotspotPoint(hotspotIndex: number, pointIndex: number, p: Point): void {
  HOTSPOTS[hotspotIndex].points[pointIndex] = p;
}

export function resetHotspots(): void {
  DEFAULT_HOTSPOTS.forEach((h, i) => (HOTSPOTS[i].points = h.points.map((p) => [...p])));
}

export function hotspotClipPath(h: Hotspot): string {
  return `polygon(${h.points.map(([x, y]) => `${x * 100}% ${y * 100}%`).join(", ")})`;
}
