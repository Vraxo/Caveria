export interface FaceSpec {
  /** Face normal */
  dir: [number, number, number];
  /** Face index into BlockDefinition.faces */
  faceIdx: number;
  /** Directional sunlight shade multiplier */
  shade: number;
  /** 4 vertices in counter-clockwise winding order + their UV corner [uIdx, vIdx] */
  corners: Array<{
    pos: [number, number, number];
    uv: [0 | 1, 0 | 1];
    /** 3 neighbor offsets in the neighbor plane [side1, side2, corner] for smooth voxel AO & light */
    ao: [[number, number, number], [number, number, number], [number, number, number]];
  }>;
}

export const FACES: FaceSpec[] = [
  // +X (East)
  {
    dir: [1, 0, 0],
    faceIdx: 0,
    shade: 0.72,
    corners: [
      { pos: [1, 0, 1], uv: [0, 0], ao: [[1, -1, 0], [1, 0, 1], [1, -1, 1]] },
      { pos: [1, 0, 0], uv: [1, 0], ao: [[1, -1, 0], [1, 0, -1], [1, -1, -1]] },
      { pos: [1, 1, 0], uv: [1, 1], ao: [[1, 1, 0], [1, 0, -1], [1, 1, -1]] },
      { pos: [1, 1, 1], uv: [0, 1], ao: [[1, 1, 0], [1, 0, 1], [1, 1, 1]] },
    ],
  },
  // -X (West)
  {
    dir: [-1, 0, 0],
    faceIdx: 1,
    shade: 0.72,
    corners: [
      { pos: [0, 0, 0], uv: [0, 0], ao: [[-1, -1, 0], [-1, 0, -1], [-1, -1, -1]] },
      { pos: [0, 0, 1], uv: [1, 0], ao: [[-1, -1, 0], [-1, 0, 1], [-1, -1, 1]] },
      { pos: [0, 1, 1], uv: [1, 1], ao: [[-1, 1, 0], [-1, 0, 1], [-1, 1, 1]] },
      { pos: [0, 1, 0], uv: [0, 1], ao: [[-1, 1, 0], [-1, 0, -1], [-1, 1, -1]] },
    ],
  },
  // +Y (Top)
  {
    dir: [0, 1, 0],
    faceIdx: 2,
    shade: 1.0,
    corners: [
      { pos: [0, 1, 1], uv: [0, 0], ao: [[-1, 1, 0], [0, 1, 1], [-1, 1, 1]] },
      { pos: [1, 1, 1], uv: [1, 0], ao: [[1, 1, 0], [0, 1, 1], [1, 1, 1]] },
      { pos: [1, 1, 0], uv: [1, 1], ao: [[1, 1, 0], [0, 1, -1], [1, 1, -1]] },
      { pos: [0, 1, 0], uv: [0, 1], ao: [[-1, 1, 0], [0, 1, -1], [-1, 1, -1]] },
    ],
  },
  // -Y (Bottom)
  {
    dir: [0, -1, 0],
    faceIdx: 3,
    shade: 0.5,
    corners: [
      { pos: [0, 0, 0], uv: [0, 0], ao: [[-1, -1, 0], [0, -1, -1], [-1, -1, -1]] },
      { pos: [1, 0, 0], uv: [1, 0], ao: [[1, -1, 0], [0, -1, -1], [1, -1, -1]] },
      { pos: [1, 0, 1], uv: [1, 1], ao: [[1, -1, 0], [0, -1, 1], [1, -1, 1]] },
      { pos: [0, 0, 1], uv: [0, 1], ao: [[-1, -1, 0], [0, -1, 1], [-1, -1, 1]] },
    ],
  },
  // +Z (South)
  {
    dir: [0, 0, 1],
    faceIdx: 4,
    shade: 0.86,
    corners: [
      { pos: [0, 0, 1], uv: [0, 0], ao: [[-1, 0, 1], [0, -1, 1], [-1, -1, 1]] },
      { pos: [1, 0, 1], uv: [1, 0], ao: [[1, 0, 1], [0, -1, 1], [1, -1, 1]] },
      { pos: [1, 1, 1], uv: [1, 1], ao: [[1, 0, 1], [0, 1, 1], [1, 1, 1]] },
      { pos: [0, 1, 1], uv: [0, 1], ao: [[-1, 0, 1], [0, 1, 1], [-1, 1, 1]] },
    ],
  },
  // -Z (North)
  {
    dir: [0, 0, -1],
    faceIdx: 5,
    shade: 0.86,
    corners: [
      { pos: [1, 0, 0], uv: [0, 0], ao: [[1, 0, -1], [0, -1, -1], [1, -1, -1]] },
      { pos: [0, 0, 0], uv: [1, 0], ao: [[-1, 0, -1], [0, -1, -1], [-1, -1, -1]] },
      { pos: [0, 1, 0], uv: [1, 1], ao: [[-1, 0, -1], [0, 1, -1], [-1, 1, -1]] },
      { pos: [1, 1, 0], uv: [0, 1], ao: [[1, 0, -1], [0, 1, -1], [1, 1, -1]] },
    ],
  },
];

