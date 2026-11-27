import type * as THREE from 'three';
import { BlockId } from '../content/BlockId';
import { BLOCKS } from '../content/BlockRegistry';
import { CHUNK_HEIGHT, CHUNK_SIZE, Chunk } from './Chunk';
import { FACES } from './meshing/FaceTopology';
import { GeometryBuilder, MeshData } from './meshing/GeometryBuilder';
import { AO_CURVE, LIGHT_CURVE, sampleLightCurve } from './meshing/LightCurves';
import {
  emitBedGeometry,
  emitChestGeometry,
  emitCrossGeometry,
  emitTorchGeometry,
  TileUvProvider,
} from './meshing/SpecialShapeEmitters';
import { createBufferGeometry } from './meshing/ThreeGeometryAdapter';

export type WorldBlockGetter = (wx: number, wy: number, wz: number) => BlockId;
export type WorldLightGetter = (wx: number, wy: number, wz: number) => number;
export type MesherChunkLookup = (cx: number, cz: number) => Chunk | undefined;

export interface ChunkMeshData {
  opaque: MeshData | null;
  water: MeshData | null;
}

const LAYER_SIZE = CHUNK_SIZE * CHUNK_SIZE;

// Flat LUTs avoid BLOCKS[id] object dereferences in hot meshing loops.
const BLOCK_OPAQUE = new Uint8Array(256);
const BLOCK_TRANSPARENT = new Uint8Array(256);
const BLOCK_LIQUID = new Uint8Array(256);
const BLOCK_EMISSIVE = new Uint8Array(256);
for (const [key, def] of Object.entries(BLOCKS)) {
  const id = Number(key);
  if (Number.isInteger(id) && id >= 0 && id < 256) {
    BLOCK_OPAQUE[id] = !def.transparent && !def.liquid && def.shape === 'cube' ? 1 : 0;
    BLOCK_TRANSPARENT[id] = def.transparent ? 1 : 0;
    BLOCK_LIQUID[id] = def.liquid ? 1 : 0;
    BLOCK_EMISSIVE[id] = def.lightEmission > 0 ? 1 : 0;
  }
}

// Reusable module-level builders avoid allocating fresh typed arrays per chunk.
const sharedOpaqueBuilder = new GeometryBuilder();
const sharedWaterBuilder = new GeometryBuilder();

/** Pure voxel-to-typed-array stage; suitable for transfer from a worker. */
export function buildChunkMeshData(
  chunk: Chunk,
  getWorldBlock: WorldBlockGetter,
  getWorldPackedLight: WorldLightGetter,
  atlas: TileUvProvider,
  getChunk?: MesherChunkLookup
): ChunkMeshData {
  const opaque = sharedOpaqueBuilder;
  const water = sharedWaterBuilder;
  opaque.reset();
  water.reset();

  const cx = chunk.cx;
  const cz = chunk.cz;
  const baseX = cx * CHUNK_SIZE;
  const baseZ = cz * CHUNK_SIZE;
  const data = chunk.data;
  const light = chunk.light;

  const maxY = chunk.maxNonAirY >= 0 ? chunk.maxNonAirY : chunk.recomputeMaxNonAirY();
  if (maxY < 0) return { opaque: null, water: null };

  // Pre-fetch the 3x3 chunk neighborhood once so border & AO samples never call string-keyed maps.
  let n00: Chunk | undefined;
  let n10: Chunk | undefined;
  let n20: Chunk | undefined;
  let n01: Chunk | undefined;
  let n21: Chunk | undefined;
  let n02: Chunk | undefined;
  let n12: Chunk | undefined;
  let n22: Chunk | undefined;
  const hasGrid = getChunk !== undefined;
  if (getChunk) {
    n00 = getChunk(cx - 1, cz - 1);
    n10 = getChunk(cx, cz - 1);
    n20 = getChunk(cx + 1, cz - 1);
    n01 = getChunk(cx - 1, cz);
    n21 = getChunk(cx + 1, cz);
    n02 = getChunk(cx - 1, cz + 1);
    n12 = getChunk(cx, cz + 1);
    n22 = getChunk(cx + 1, cz + 1);
  }

  const neighborChunkFor = (lx: number, lz: number): Chunk | undefined => {
    if (lz < 0) {
      if (lx < 0) return n00;
      if (lx >= CHUNK_SIZE) return n20;
      return n10;
    }
    if (lz >= CHUNK_SIZE) {
      if (lx < 0) return n02;
      if (lx >= CHUNK_SIZE) return n22;
      return n12;
    }
    return lx < 0 ? n01 : n21;
  };

  const sampleBlock = (lx: number, y: number, lz: number): number => {
    if (y < 0 || y >= CHUNK_HEIGHT) return 0;
    if ((lx | lz) >= 0 && lx < CHUNK_SIZE && lz < CHUNK_SIZE) {
      return data[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
    }
    if (hasGrid) {
      const nc = neighborChunkFor(lx, lz);
      return nc ? nc.data[(y * CHUNK_SIZE + (lz & 15)) * CHUNK_SIZE + (lx & 15)] : 0;
    }
    return getWorldBlock(baseX + lx, y, baseZ + lz);
  };

  const samplePackedLight = (lx: number, y: number, lz: number): number => {
    if (y >= CHUNK_HEIGHT) return 0xf0;
    if (y < 0) return 0x00;
    if ((lx | lz) >= 0 && lx < CHUNK_SIZE && lz < CHUNK_SIZE) {
      return light[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
    }
    if (hasGrid) {
      const nc = neighborChunkFor(lx, lz);
      return nc ? nc.light[(y * CHUNK_SIZE + (lz & 15)) * CHUNK_SIZE + (lx & 15)] : 0xf0;
    }
    return getWorldPackedLight(baseX + lx, y, baseZ + lz);
  };

  for (let y = 0; y <= maxY; y++) {
    const yBase = y * LAYER_SIZE;
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const rowBase = yBase + lz * CHUNK_SIZE;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const blockId = data[rowBase + lx] as BlockId;
        if (blockId === BlockId.Air) continue;

        const def = BLOCKS[blockId];
        const shape = def.shape;

        if (shape !== 'cube') {
          if (shape === 'torch') {
            emitTorchGeometry(opaque, atlas, lx, y, lz, light[rowBase + lx]);
          } else if (shape === 'bed') {
            emitBedGeometry(
              opaque,
              atlas,
              def.faces,
              lx,
              y,
              lz,
              samplePackedLight(lx, y + 1, lz)
            );
          } else if (shape === 'chest') {
            emitChestGeometry(
              opaque,
              atlas,
              def.faces,
              lx,
              y,
              lz,
              samplePackedLight(lx, y + 1, lz)
            );
          } else if (shape === 'cross') {
            emitCrossGeometry(
              opaque,
              atlas,
              def.faces[0],
              lx,
              y,
              lz,
              light[rowBase + lx],
              BLOCK_EMISSIVE[blockId] === 1
            );
          }
          continue;
        }

        const isLiquid = BLOCK_LIQUID[blockId] === 1;
        const isTransparent = BLOCK_TRANSPARENT[blockId] === 1;
        const isEmissive = BLOCK_EMISSIVE[blockId] === 1;
        const builder = isLiquid ? water : opaque;
        const lowerWaterTop = isLiquid && sampleBlock(lx, y + 1, lz) !== BlockId.Water;
        const faces = def.faces;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const dir = face.dir;
          const nx = lx + dir[0];
          const ny = y + dir[1];
          const nz = lz + dir[2];

          const neighborId = sampleBlock(nx, ny, nz);

          if (isLiquid) {
            if (neighborId === BlockId.Water || BLOCK_OPAQUE[neighborId] === 1) continue;
          } else if (isTransparent) {
            if (neighborId === blockId || BLOCK_OPAQUE[neighborId] === 1) continue;
          } else {
            if (BLOCK_OPAQUE[neighborId] === 1) continue;
          }

          const uvBounds = atlas.getTileUVs(faces[face.faceIdx]);
          const u0 = uvBounds[0];
          const v0 = uvBounds[1];
          const u1 = uvBounds[2];
          const v1 = uvBounds[3];

          builder.ensureVertexCapacity(4);
          builder.ensureIndexCapacity(6);
          const baseVertex = builder.vertexCount;

          const centerPacked = samplePackedLight(nx, ny, nz);
          const centerSky = (centerPacked >> 4) & 0xf;
          const centerBlk = centerPacked & 0xf;
          const faceShade = face.shade;
          const d0 = dir[0];
          const d1 = dir[1];
          const d2 = dir[2];
          const corners = face.corners;

          let cl0 = 0;
          let cl1 = 0;
          let cl2 = 0;
          let cl3 = 0;

          for (let cIdx = 0; cIdx < 4; cIdx++) {
            const corner = corners[cIdx];
            const cPos = corner.pos;
            const px = lx + cPos[0];
            let py = y + cPos[1];
            const pz = lz + cPos[2];
            if (lowerWaterTop && cPos[1] === 1) py -= 0.12;

            const u = corner.uv[0] === 0 ? u0 : u1;
            const v = corner.uv[1] === 0 ? v0 : v1;

            if (isEmissive) {
              if (cIdx === 0) cl0 = 30;
              else if (cIdx === 1) cl1 = 30;
              else if (cIdx === 2) cl2 = 30;
              else cl3 = 30;
              builder.pushVertexFast(px, py, pz, d0, d1, d2, u, v, 1.0, LIGHT_CURVE[centerSky], 1.0);
              continue;
            }

            const ao = corner.ao;
            const ao0 = ao[0];
            const ao1 = ao[1];
            const ao2 = ao[2];

            const s1x = lx + ao0[0];
            const s1y = y + ao0[1];
            const s1z = lz + ao0[2];

            const s2x = lx + ao1[0];
            const s2y = y + ao1[1];
            const s2z = lz + ao1[2];

            const cxPos = lx + ao2[0];
            const cyPos = y + ao2[1];
            const czPos = lz + ao2[2];

            const o1 = BLOCK_OPAQUE[sampleBlock(s1x, s1y, s1z)];
            const o2 = BLOCK_OPAQUE[sampleBlock(s2x, s2y, s2z)];
            const oc = BLOCK_OPAQUE[sampleBlock(cxPos, cyPos, czPos)];

            const aoLevel = isLiquid ? 3 : o1 && o2 ? 0 : 3 - (o1 + o2 + oc);

            let skySum = centerSky;
            let blkSum = centerBlk;
            let count = 1;

            if (!o1) {
              const p1 = samplePackedLight(s1x, s1y, s1z);
              skySum += p1 >> 4;
              blkSum += p1 & 0xf;
              count++;
            }
            if (!o2) {
              const p2 = samplePackedLight(s2x, s2y, s2z);
              skySum += p2 >> 4;
              blkSum += p2 & 0xf;
              count++;
            }
            if (!(o1 && o2) && !oc) {
              const pc = samplePackedLight(cxPos, cyPos, czPos);
              skySum += pc >> 4;
              blkSum += pc & 0xf;
              count++;
            }

            const invCount = 1 / count;
            const skyNorm = sampleLightCurve(skySum * invCount);
            const blkNorm = sampleLightCurve(blkSum * invCount);
            const shadeAO = faceShade * AO_CURVE[aoLevel];
            const cl = shadeAO * (skyNorm > blkNorm ? skyNorm : blkNorm);

            if (cIdx === 0) cl0 = cl;
            else if (cIdx === 1) cl1 = cl;
            else if (cIdx === 2) cl2 = cl;
            else cl3 = cl;

            builder.pushVertexFast(px, py, pz, d0, d1, d2, u, v, shadeAO, skyNorm, blkNorm);
          }

          if (Math.abs(cl0 - cl2) < Math.abs(cl1 - cl3)) {
            builder.pushQuadIndicesFast(
              baseVertex, baseVertex + 1, baseVertex + 2,
              baseVertex, baseVertex + 2, baseVertex + 3
            );
          } else {
            builder.pushQuadIndicesFast(
              baseVertex + 1, baseVertex + 2, baseVertex + 3,
              baseVertex + 1, baseVertex + 3, baseVertex
            );
          }
        }
      }
    }
  }

  return {
    opaque: opaque.toMeshData(),
    water: water.toMeshData(),
  };
}

/** Main-thread compatibility adapter used by World; mesh data itself remains Three.js-independent. */
export function buildChunkGeometries(
  chunk: Chunk,
  getWorldBlock: WorldBlockGetter,
  getWorldPackedLight: WorldLightGetter,
  atlas: TileUvProvider,
  getChunk?: MesherChunkLookup
): { opaque: THREE.BufferGeometry | null; water: THREE.BufferGeometry | null } {
  const data = buildChunkMeshData(chunk, getWorldBlock, getWorldPackedLight, atlas, getChunk);
  return {
    opaque: createBufferGeometry(data.opaque),
    water: createBufferGeometry(data.water),
  };
}
