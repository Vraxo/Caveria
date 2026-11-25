import * as THREE from 'three';
import { TextureAtlas } from '../rendering/TextureAtlas';
import { BLOCKS, BlockId, isBlockOpaque } from './Block';
import { CHUNK_HEIGHT, CHUNK_SIZE, Chunk } from './Chunk';

interface FaceSpec {
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
    /** 3 neighbor offsets in the neighbor plane [side1, side2, corner] for smooth voxel AO */
    ao: [[number, number, number], [number, number, number], [number, number, number]];
  }>;
}

/**
 * Counter-clockwise face definitions with exact UV orientations and voxel AO neighbor offsets.
 */
const FACES: FaceSpec[] = [
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

const AO_CURVE = [0.46, 0.66, 0.84, 1.0];

class GeometryBuilder {
  public positions: number[] = [];
  public normals: number[] = [];
  public uvs: number[] = [];
  public colors: number[] = [];
  public indices: number[] = [];
  public vertexCount = 0;

  public toBufferGeometry(): THREE.BufferGeometry | null {
    if (this.vertexCount === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geo.setIndex(this.indices);
    geo.computeBoundingSphere();
    return geo;
  }
}

export type WorldBlockGetter = (wx: number, wy: number, wz: number) => BlockId;

export function buildChunkGeometries(
  chunk: Chunk,
  getWorldBlock: WorldBlockGetter,
  atlas: TextureAtlas
): { opaque: THREE.BufferGeometry | null; water: THREE.BufferGeometry | null } {
  const opaque = new GeometryBuilder();
  const water = new GeometryBuilder();

  const baseX = chunk.cx * CHUNK_SIZE;
  const baseZ = chunk.cz * CHUNK_SIZE;

  // Fast local-first lookup, falling back to world lookup only across chunk boundaries
  const sampleBlock = (lx: number, y: number, lz: number): BlockId => {
    if (y < 0 || y >= CHUNK_HEIGHT) return BlockId.Air;
    if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
      return chunk.data[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx] as BlockId;
    }
    return getWorldBlock(baseX + lx, y, baseZ + lz);
  };

  const vertexAO = (s1: boolean, s2: boolean, c: boolean): number => {
    if (s1 && s2) return 0;
    return 3 - ((s1 ? 1 : 0) + (s2 ? 1 : 0) + (c ? 1 : 0));
  };

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const blockId = chunk.data[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx] as BlockId;
        if (blockId === BlockId.Air) continue;

        const def = BLOCKS[blockId];
        const isLiquid = def.liquid;
        const builder = isLiquid ? water : opaque;

        // Slightly lower top surface of top-layer water for a classic shoreline look
        const lowerWaterTop = isLiquid && sampleBlock(lx, y + 1, lz) !== BlockId.Water;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nx = lx + face.dir[0];
          const ny = y + face.dir[1];
          const nz = lz + face.dir[2];

          const neighborId = sampleBlock(nx, ny, nz);
          const neighborDef = BLOCKS[neighborId];

          // Face culling rules:
          if (isLiquid) {
            // Water only renders faces touching Air (or non-water transparent like glass/leaves on top)
            if (neighborId === BlockId.Water || neighborDef.solid) continue;
          } else if (def.transparent) {
            // Glass culls against itself; Leaves render outer faces cleanly and cull adjacent leaves for perf
            if (neighborId === blockId || (neighborDef.solid && !neighborDef.transparent)) continue;
          } else {
            // Opaque solid culls against any opaque solid
            if (neighborDef.solid && !neighborDef.transparent) continue;
          }

          const tile = def.faces[face.faceIdx];
          const [u0, v0, u1, v1] = atlas.getTileUVs(tile);
          const baseVertex = builder.vertexCount;

          const aoLevels = [3, 3, 3, 3];

          for (let cIdx = 0; cIdx < 4; cIdx++) {
            const corner = face.corners[cIdx];
            let px = lx + corner.pos[0];
            let py = y + corner.pos[1];
            let pz = lz + corner.pos[2];

            if (lowerWaterTop && corner.pos[1] === 1) {
              py -= 0.12;
            }

            builder.positions.push(px, py, pz);
            builder.normals.push(face.dir[0], face.dir[1], face.dir[2]);
            builder.uvs.push(corner.uv[0] === 0 ? u0 : u1, corner.uv[1] === 0 ? v0 : v1);

            let aoLevel = 3;
            if (!isLiquid) {
              const o1 = isBlockOpaque(sampleBlock(lx + corner.ao[0][0], y + corner.ao[0][1], lz + corner.ao[0][2]));
              const o2 = isBlockOpaque(sampleBlock(lx + corner.ao[1][0], y + corner.ao[1][1], lz + corner.ao[1][2]));
              const oc = isBlockOpaque(sampleBlock(lx + corner.ao[2][0], y + corner.ao[2][1], lz + corner.ao[2][2]));
              aoLevel = vertexAO(o1, o2, oc);
            }
            aoLevels[cIdx] = aoLevel;

            const light = face.shade * AO_CURVE[aoLevel];
            builder.colors.push(light, light, light);
          }

          // Flip quad diagonal when needed to prevent anisotropic AO interpolation artifacts
          if (aoLevels[0] + aoLevels[2] > aoLevels[1] + aoLevels[3]) {
            builder.indices.push(
              baseVertex + 0, baseVertex + 1, baseVertex + 2,
              baseVertex + 0, baseVertex + 2, baseVertex + 3
            );
          } else {
            builder.indices.push(
              baseVertex + 1, baseVertex + 2, baseVertex + 3,
              baseVertex + 1, baseVertex + 3, baseVertex + 0
            );
          }

          builder.vertexCount += 4;
        }
      }
    }
  }

  return {
    opaque: opaque.toBufferGeometry(),
    water: water.toBufferGeometry(),
  };
}
