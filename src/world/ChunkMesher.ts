import * as THREE from 'three';
import { TextureAtlas } from '../rendering/TextureAtlas';
import { BLOCKS, BlockId, TileIndex, isBlockOpaque } from './Block';
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
    /** 3 neighbor offsets in the neighbor plane [side1, side2, corner] for smooth voxel AO & light */
    ao: [[number, number, number], [number, number, number], [number, number, number]];
  }>;
}

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

// Classic non-linear Minecraft-like light curve for 0..15
const LIGHT_CURVE: number[] = [];
for (let i = 0; i <= 15; i++) {
  LIGHT_CURVE.push(Math.pow(i / 15, 1.85));
}

class GeometryBuilder {
  public positions: number[] = [];
  public normals: number[] = [];
  public uvs: number[] = [];
  /**
   * Vertex color channels encode lighting for real-time GPU day/night shader:
   * - R = directional shade * vertex AO (0..1)
   * - G = smooth skylight intensity (0..1)
   * - B = smooth block-light intensity (0..1)
   */
  public colors: number[] = [];
  public indices: number[] = [];
  public vertexCount = 0;

  public pushQuad(
    v0: [number, number, number],
    v1: [number, number, number],
    v2: [number, number, number],
    v3: [number, number, number],
    normal: [number, number, number],
    u0: number,
    v0uv: number,
    u1: number,
    v1uv: number,
    shade: number,
    sky: number,
    blk: number
  ): void {
    const base = this.vertexCount;
    this.positions.push(
      v0[0], v0[1], v0[2],
      v1[0], v1[1], v1[2],
      v2[0], v2[1], v2[2],
      v3[0], v3[1], v3[2]
    );
    for (let i = 0; i < 4; i++) {
      this.normals.push(normal[0], normal[1], normal[2]);
      this.colors.push(shade, sky, blk);
    }
    this.uvs.push(u0, v0uv, u1, v0uv, u1, v1uv, u0, v1uv);
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.vertexCount += 4;
  }

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
export type WorldLightGetter = (wx: number, wy: number, wz: number) => number;

export function buildChunkGeometries(
  chunk: Chunk,
  getWorldBlock: WorldBlockGetter,
  getWorldPackedLight: WorldLightGetter,
  atlas: TextureAtlas
): { opaque: THREE.BufferGeometry | null; water: THREE.BufferGeometry | null } {
  const opaque = new GeometryBuilder();
  const water = new GeometryBuilder();

  const baseX = chunk.cx * CHUNK_SIZE;
  const baseZ = chunk.cz * CHUNK_SIZE;

  const sampleBlock = (lx: number, y: number, lz: number): BlockId => {
    if (y < 0 || y >= CHUNK_HEIGHT) return BlockId.Air;
    if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
      return chunk.data[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx] as BlockId;
    }
    return getWorldBlock(baseX + lx, y, baseZ + lz);
  };

  const samplePackedLight = (lx: number, y: number, lz: number): number => {
    if (y >= CHUNK_HEIGHT) return 0xf0;
    if (y < 0) return 0x00;
    if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
      return chunk.light[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
    }
    return getWorldPackedLight(baseX + lx, y, baseZ + lz);
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

        // Special compact 3D Torch model (2/16 wide, 10/16 tall)
        if (def.shape === 'torch') {
          emitTorchGeometry(opaque, atlas, lx, y, lz, samplePackedLight(lx, y, lz));
          continue;
        }

        const isLiquid = def.liquid;
        const isEmissive = def.lightEmission > 0;
        const builder = isLiquid ? water : opaque;
        const lowerWaterTop = isLiquid && sampleBlock(lx, y + 1, lz) !== BlockId.Water;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nx = lx + face.dir[0];
          const ny = y + face.dir[1];
          const nz = lz + face.dir[2];

          const neighborId = sampleBlock(nx, ny, nz);

          if (isLiquid) {
            if (neighborId === BlockId.Water || isBlockOpaque(neighborId)) continue;
          } else if (def.transparent) {
            if (neighborId === blockId || isBlockOpaque(neighborId)) continue;
          } else {
            if (isBlockOpaque(neighborId)) continue;
          }

          const tile = def.faces[face.faceIdx];
          const [u0, v0, u1, v1] = atlas.getTileUVs(tile);
          const baseVertex = builder.vertexCount;

          const aoLevels = [3, 3, 3, 3];
          const cornerLightSum = [0, 0, 0, 0];
          const centerPacked = samplePackedLight(nx, ny, nz);
          const centerSky = (centerPacked >> 4) & 0xf;
          const centerBlk = centerPacked & 0xf;

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

            if (isEmissive) {
              // Emissive blocks like GlowCrystal shine brightly on all faces
              aoLevels[cIdx] = 3;
              cornerLightSum[cIdx] = 30;
              builder.colors.push(1.0, LIGHT_CURVE[centerSky], 1.0);
              continue;
            }

            const s1x = lx + corner.ao[0][0];
            const s1y = y + corner.ao[0][1];
            const s1z = lz + corner.ao[0][2];

            const s2x = lx + corner.ao[1][0];
            const s2y = y + corner.ao[1][1];
            const s2z = lz + corner.ao[1][2];

            const cxPos = lx + corner.ao[2][0];
            const cyPos = y + corner.ao[2][1];
            const czPos = lz + corner.ao[2][2];

            const o1 = isBlockOpaque(sampleBlock(s1x, s1y, s1z));
            const o2 = isBlockOpaque(sampleBlock(s2x, s2y, s2z));
            const oc = isBlockOpaque(sampleBlock(cxPos, cyPos, czPos));

            const aoLevel = isLiquid ? 3 : vertexAO(o1, o2, oc);
            aoLevels[cIdx] = aoLevel;

            // Smooth 4-voxel average for skylight & block light across non-opaque neighbors
            let skySum = centerSky;
            let blkSum = centerBlk;
            let count = 1;

            if (!o1) {
              const p1 = samplePackedLight(s1x, s1y, s1z);
              skySum += (p1 >> 4) & 0xf;
              blkSum += p1 & 0xf;
              count++;
            }
            if (!o2) {
              const p2 = samplePackedLight(s2x, s2y, s2z);
              skySum += (p2 >> 4) & 0xf;
              blkSum += p2 & 0xf;
              count++;
            }
            if (!(o1 && o2) && !oc) {
              const pc = samplePackedLight(cxPos, cyPos, czPos);
              skySum += (pc >> 4) & 0xf;
              blkSum += pc & 0xf;
              count++;
            }

            const avgSky = skySum / count;
            const avgBlk = blkSum / count;

            const skyNorm = sampleCurve(avgSky);
            const blkNorm = sampleCurve(avgBlk);
            const shadeAO = face.shade * AO_CURVE[aoLevel];

            cornerLightSum[cIdx] = shadeAO * Math.max(skyNorm, blkNorm);
            builder.colors.push(shadeAO, skyNorm, blkNorm);
          }

          if (
            Math.abs(cornerLightSum[0] - cornerLightSum[2]) <
            Math.abs(cornerLightSum[1] - cornerLightSum[3])
          ) {
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

function sampleCurve(level: number): number {
  const clamped = Math.max(0, Math.min(15, level));
  const lo = Math.floor(clamped);
  const hi = Math.min(15, lo + 1);
  const frac = clamped - lo;
  return LIGHT_CURVE[lo] * (1 - frac) + LIGHT_CURVE[hi] * frac;
}

function emitTorchGeometry(
  builder: GeometryBuilder,
  atlas: TextureAtlas,
  lx: number,
  y: number,
  lz: number,
  packedLight: number
): void {
  const x0 = lx + 7 / 16;
  const x1 = lx + 9 / 16;
  const z0 = lz + 7 / 16;
  const z1 = lz + 9 / 16;
  const y0 = y;
  const y1 = y + 10 / 16;

  const skyNorm = LIGHT_CURVE[(packedLight >> 4) & 0xf];
  const blkNorm = 1.0;

  // Side sub-UV: x=7..9, y=6..16 in the 16x16 Torch tile
  const [su0, sv0, su1, sv1] = atlas.getSubTileUVs(TileIndex.Torch, 7, 6, 9, 16);
  // Top ember sub-UV: x=7..9, y=6..8
  const [tu0, tv0, tu1, tv1] = atlas.getSubTileUVs(TileIndex.Torch, 7, 6, 9, 8);

  // +X
  builder.pushQuad(
    [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1],
    [1, 0, 0], su0, sv0, su1, sv1, 0.95, skyNorm, blkNorm
  );
  // -X
  builder.pushQuad(
    [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0],
    [-1, 0, 0], su0, sv0, su1, sv1, 0.95, skyNorm, blkNorm
  );
  // +Z
  builder.pushQuad(
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    [0, 0, 1], su0, sv0, su1, sv1, 0.98, skyNorm, blkNorm
  );
  // -Z
  builder.pushQuad(
    [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0],
    [0, 0, -1], su0, sv0, su1, sv1, 0.98, skyNorm, blkNorm
  );
  // +Y top ember
  builder.pushQuad(
    [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0],
    [0, 1, 0], tu0, tv0, tu1, tv1, 1.0, skyNorm, blkNorm
  );
}
