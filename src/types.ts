export type Point = [number, number];

export type Corners = [Point, Point, Point, Point]; // TL, TR, BR, BL

export interface EdgeBulge {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type EdgeName = keyof EdgeBulge | "all";

export interface Grid {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  bpath: Point[];
}
