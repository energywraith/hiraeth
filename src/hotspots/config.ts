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
  { id: "floppy-disk-1", label: "Floppy disk 1", points: [[0.0258, 0.8206], [0.0838, 0.8215], [0.0567, 0.8456], [0.0258, 0.8562]] },
  { id: "floppy-disk-2", label: "Floppy disk 2", points: [[0.0836, 0.8096], [0.0890, 0.8008], [0.1387, 0.7863], [0.1571, 0.8000], [0.1627, 0.8033], [0.1580, 0.8145], [0.1560, 0.8271], [0.1437, 0.8288], [0.1290, 0.8271], [0.1039, 0.8209]] },
  { id: "floppy-disk-3", label: "Floppy disk 3", points: [[0.1728, 0.7979], [0.1735, 0.7856], [0.1842, 0.7687], [0.2345, 0.7694], [0.2356, 0.7828], [0.2384, 0.8025], [0.1858, 0.8111], [0.1828, 0.7984]] },
  { id: "floppy-disk-4", label: "Floppy disk 4", points: [[0.2129, 0.8264], [0.2132, 0.8177], [0.2676, 0.8062], [0.2868, 0.8260], [0.2878, 0.8363], [0.2359, 0.8503], [0.2303, 0.8441]] },
  { id: "telescope", label: "Telescope", points: [[0.7076, 0.3677], [0.7168, 0.3657], [0.7462, 0.4000], [0.7462, 0.4058], [0.8572, 0.5242], [0.8608, 0.5203], [0.8306, 0.4833], [0.8310, 0.4735], [0.8339, 0.4670], [0.8387, 0.4632], [0.8648, 0.4929], [0.8675, 0.4897], [0.8842, 0.5087], [0.8893, 0.5024], [0.8979, 0.5118], [0.8961, 0.5245], [0.9020, 0.5346], [0.9027, 0.5488], [0.8957, 0.5577], [0.8968, 0.5651], [0.8905, 0.5746], [0.8981, 0.5836], [0.8997, 0.5925], [0.9026, 0.5979], [0.9062, 0.5858], [0.9153, 0.5973], [0.9148, 0.6062], [0.9266, 0.6180], [0.9420, 0.5737], [0.9515, 0.5823], [0.9354, 0.6305], [0.9428, 0.6419], [0.9110, 0.6598], [0.9069, 0.6407], [0.8940, 0.6461], [0.8866, 0.6368], [0.8905, 0.6247], [0.8859, 0.6187], [0.8823, 0.6228], [0.8773, 0.6180], [0.8688, 0.6212], [0.8280, 0.5777], [0.8230, 0.5911], [0.8213, 0.6037], [0.8241, 0.6157], [0.8224, 0.6257], [0.8660, 0.7011], [0.8692, 0.6993], [0.8933, 0.7436], [0.8835, 0.7572], [0.8599, 0.7112], [0.8599, 0.7059], [0.8292, 0.6548], [0.8352, 0.6785], [0.8340, 0.6853], [0.8770, 0.9305], [0.8583, 0.9562], [0.8170, 0.7149], [0.8146, 0.7635], [0.8082, 1.0000], [0.7842, 1.0000], [0.7856, 0.7159], [0.7766, 0.7552], [0.7769, 0.7612], [0.7702, 0.7881], [0.7638, 0.7893], [0.7537, 0.7750], [0.6959, 1.0000], [0.6795, 1.0000], [0.7655, 0.6533], [0.7766, 0.6544], [0.7760, 0.6385], [0.7848, 0.6325], [0.7856, 0.6272], [0.7753, 0.6227], [0.7649, 0.6074], [0.7684, 0.5891], [0.7720, 0.5887], [0.7790, 0.5633], [0.7713, 0.5520], [0.7794, 0.5250], [0.7250, 0.4626], [0.7190, 0.4645], [0.6887, 0.4294], [0.6887, 0.4114], [0.6929, 0.3934], [0.6993, 0.3794]] },
  { id: "moon", label: "The moon", points: [[0.8768, 0.2435], [0.8745, 0.2864], [0.8592, 0.3408], [0.8317, 0.3717], [0.7955, 0.3754], [0.7667, 0.3507], [0.7489, 0.2950], [0.7458, 0.2592], [0.7524, 0.2239], [0.7614, 0.1886], [0.7764, 0.1633], [0.7910, 0.1490], [0.8129, 0.1416], [0.8335, 0.1453], [0.8540, 0.1652], [0.8695, 0.2007]] },
];

const DEFAULT_HOTSPOTS: Hotspot[] = structuredClone(HOTSPOTS);

export function setHotspotPoint(hotspotIndex: number, pointIndex: number, p: Point): void {
  HOTSPOTS[hotspotIndex].points[pointIndex] = p;
}

/** Inserts a new point at the midpoint of the edge right after `afterIndex`
 * (wrapping around to point 0), so a rough box can be refined into a
 * closer-fitting outline point by point. Returns the new point's index. */
export function insertHotspotPoint(hotspotIndex: number, afterIndex: number): number {
  const points = HOTSPOTS[hotspotIndex].points;
  const a = points[afterIndex];
  const b = points[(afterIndex + 1) % points.length];
  const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  points.splice(afterIndex + 1, 0, mid);
  return afterIndex + 1;
}

/** Removes a point, keeping at least a triangle (3 points) — a polygon needs
 * that many to stay a valid shape. */
export function removeHotspotPoint(hotspotIndex: number, pointIndex: number): void {
  const points = HOTSPOTS[hotspotIndex].points;
  if (points.length <= 3) return;
  points.splice(pointIndex, 1);
}

export function resetHotspots(): void {
  DEFAULT_HOTSPOTS.forEach((h, i) => (HOTSPOTS[i].points = h.points.map((p) => [...p])));
}

export function hotspotClipPath(h: Hotspot): string {
  return `polygon(${h.points.map(([x, y]) => `${x * 100}% ${y * 100}%`).join(", ")})`;
}
