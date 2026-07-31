import type { Point } from "../types";

export interface Constellation {
  name: string;
  /** Fractional (0-1) coordinates within the sky view's fixed-aspect content
   * box (see CONTENT_ASPECT in skyView.ts) — same convention as HOTSPOTS/
   * SKY_MASK elsewhere in the project, kept aspect-safe across window sizes. */
  stars: Point[];
  /** Index pairs into `stars`, drawn as connecting lines. */
  lines: [number, number][];
  /** Index into `stars` the label is anchored near. */
  labelAt: number;
  /** Shown in the sky view's caption when the constellation is clicked —
   * see the click handling in skyView.ts. */
  meaning: string;
}

// Real relative sky positions, not arbitrary silhouettes. Each star's
// [fx, fy] was computed from its actual J2000 right ascension/declination,
// projected with a north-celestial-pole-centered azimuthal-equidistant
// projection (ρ = 90° − dec, θ = RA − rotated so the whole group sits inside
// the content box) and scaled isotropically for CONTENT_ASPECT (fy uses a
// 16/9-larger step per degree than fx, since a fraction of height covers
// fewer real pixels than the same fraction of width). That keeps every
// shape and every constellation's position *relative to the others* true to
// life — e.g. the line through Merak and Dubhe really does point at
// Polaris here, same as the real "pointer stars" trick.
//
// The absolute rotation/scale/center were picked for framing only (which
// moment of the night we're depicting is artistic license — circumpolar
// constellations wheel around Polaris all night and all year), but the
// projection itself was NOT mirrored, so handedness matches what an
// observer actually sees looking up, not a star atlas's outside-in view.
// All four are circumpolar from mid-northern latitudes — always up
// together, never below the horizon — so grouping them here needed no
// particular date or time to be real.
//
// To add another real constellation later: look up its stars' J2000 RA/dec,
// then reuse this projection (φ0 = 195°, center [0.5, 0.24], scale = 0.0058
// per degree in fx) so it stays consistent with the ones already here.
export const CONSTELLATIONS: Constellation[] = [
  {
    name: "the plough",
    stars: [
      [0.676, 0.520], // Alkaid
      [0.665, 0.452], // Mizar
      [0.673, 0.408], // Alioth
      [0.681, 0.350], // Megrez
      [0.705, 0.327], // Phecda
      [0.695, 0.243], // Merak
      [0.664, 0.245], // Dubhe
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
    meaning: "These seven stars have guided travelers for thousands of years. Just follow the two stars at the front of the bowl and they point straight to Polaris, the North Star, so you never really get lost.",
  },
  {
    name: "cassiopeia",
    stars: [
      [0.329, 0.145], // Caph
      [0.324, 0.093], // Schedar
      [0.352, 0.093], // Gamma Cassiopeiae
      [0.361, 0.058], // Ruchbah
      [0.389, 0.053], // Segin
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
    labelAt: 4,
    meaning: "Cassiopeia and the plough circle Polaris together all night, like two hands on a clock, always on opposite sides. As one climbs higher, the other sinks lower, then hours later, they swap.",
  },
  {
    name: "the little dipper",
    stars: [
      [0.497, 0.234], // Polaris
      [0.497, 0.275], // Yildun
      [0.503, 0.322], // Epsilon Ursae Minoris
      [0.523, 0.359], // Zeta Ursae Minoris
      [0.549, 0.378], // Kochab
      [0.544, 0.410], // Pherkad
      [0.515, 0.384], // Eta Ursae Minoris
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
    meaning: "Polaris, the star at the tip of the handle, is the only one in the whole sky that doesn't seem to move. Every other star slowly circles around it all night, like the sky is a giant pinwheel and Polaris is the pin.",
  },
  {
    name: "cepheus",
    stars: [
      [0.356, 0.361], // Alderamin
      [0.396, 0.318], // Alfirk
      [0.429, 0.218], // Errai
      [0.362, 0.251], // Iota Cephei
      [0.320, 0.310], // Zeta Cephei
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 0],
    ],
    labelAt: 0,
    meaning: "It's shaped like a child's drawing of a house, a little pointed roof and all, right next to the North Star. Of all the constellations, it might be the one that actually looks like what it's named for.",
  },
];

export const PLANET = {
  pos: [0.42, 0.62] as Point,
  // Base unit for sizing the rendered public/saturn.png sprite, in screen px
  // at viewScale 1 — NOT the sprite's half-width itself. skyView.ts draws
  // the sprite (rings included) at radius*2.1 half-width, and hit-testing/
  // click-to-zoom both size themselves off that same radius*2.1, so this one
  // number controls the planet's on-screen size everywhere consistently.
  radius: 9,
  name: "saturn",
  meaning: "Saturn is the only planet in the solar system less dense than water. If you could find a bathtub big enough, it would float.",
};

export const MOON = {
  pos: [0.78, 0.70] as Point,
  // Half-width the public/moon.png sprite is drawn at, in screen px at
  // viewScale 1 — see the comment on PLANET.radius above.
  radius: 46,
  name: "the moon",
  meaning: "In an old Greek story, the moon fell in love with a shepherd, Endymion, sleeping in a cave. She asked for him to sleep forever so he'd never grow old, and every night since, she comes down just to watch over him while he dreams.",
};

export const CAPTION = "Same sky, most nights. Somehow it never stopped being worth looking at.";
