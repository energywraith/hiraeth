import type { Point } from "../types";

export interface Constellation {
  name: string;
  /** Fractional (0-1) coordinates within the sky view's virtual canvas —
   * same convention as HOTSPOTS/SKY_MASK elsewhere in the project. */
  stars: Point[];
  /** Index pairs into `stars`, drawn as connecting lines. */
  lines: [number, number][];
  /** Index into `stars` the label is anchored near. */
  labelAt: number;
}

// Stylized, not astronomically precise — recognizable silhouettes rather
// than a real star chart. Positioned in the upper third of the virtual sky
// so they read as "up and away" from the moon, which sits lower and larger.
export const CONSTELLATIONS: Constellation[] = [
  {
    name: "the plough",
    stars: [
      [0.100, 0.242], // Alkaid
      [0.129, 0.228], // Mizar
      [0.158, 0.216], // Alioth
      [0.186, 0.210], // Megrez
      [0.180, 0.190], // Phecda
      [0.225, 0.182], // Merak
      [0.247, 0.202], // Dubhe
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 3],
    ],
    labelAt: 0,
  },
{
  name: "cassiopeia",
  stars: [
    [0.710, 0.112],
    [0.725, 0.150],
    [0.745, 0.147],
    [0.760, 0.180],
    [0.775, 0.155],
  ],
  lines: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
  ],
  labelAt: 4,
}
];

export const PLANET = {
  pos: [0.42, 0.62] as Point,
  radius: 9,
  ringTilt: 0.32,
  color: "#d9b98a",
  ringColor: "rgba(217, 185, 138, 0.55)",
};

export const MOON = {
  pos: [0.78, 0.70] as Point,
  radius: 46,
};

export const CAPTION = "Same sky, most nights. Somehow it never stopped being worth looking at.";
