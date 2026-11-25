import type * as THREE from 'three';
import { BlockId } from '../content/BlockId';
import { isBlockOpaque } from '../content/BlockQueries';
import { BLOCKS } from '../content/BlockRegistry';
import { CHUNK_HEIGHT, CHUNK_SIZE, Chunk } from './Chunk';
import { FACES } from './meshing/FaceTopology';
import { GeometryBuilder, MeshData } from './meshing/GeometryBuilder';
import { AO_CURVE, LIGHT_CURVE, sampleLightCurve } from './meshing/LightCurves';
import {
  emitCrossGeometry,
  emitTorchGeometry,
  TileUvProvider,
} from './meshing/SpecialShapeEmitters';
import { createBufferGeometry } from './meshing/ThreeGeometryAdapter';

export type WorldBlockGetter = (wx: number, wy: number, wz: number) => BlockId;
export type WorldLightGetter = (wx: number, wy: number, wz: number) => number;

export interface ChunkMeshData {
  opaque: MeshData | null;
  water: MeshData | null;
}

/** Pure voxel-to-typed-array stage; suitable for transfer from a worker. */
export function buildChunkMeshData(
  chunk: Chunk,
  getWorldBlock: WorldBlockGetter,
  getWorldPackedLight: WorldLightGetter,
  atlas: TileUvProvider
): ChunkMeshData {
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

        // Cross-quad flora/stalagmite/vine model (4 double-sided diagonal planes)
        if (def.shape === 'cross') {
          emitCrossGeometry(
            opaque,
            atlas,
            def.faces[0],
            lx,
            y,
            lz,
            samplePackedLight(lx, y, lz),
            def.lightEmission > 0
          );
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

            const skyNorm = sampleLightCurve(avgSky);
            const blkNorm = sampleLightCurve(avgBlk);
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
    opaque: opaque.toMeshData(),
    water: water.toMeshData(),
  };
}

/** Main-thread compatibility adapter used by World; mesh data itself remains Three.js-independent. */
export function buildChunkGeometries(
  chunk: Chunk,
  getWorldBlock: WorldBlockGetter,
  getWorldPackedLight: WorldLightGetter,
  atlas: TileUvProvider
): { opaque: THREE.BufferGeometry | null; water: THREE.BufferGeometry | null } {
  const data = buildChunkMeshData(chunk, getWorldBlock, getWorldPackedLight, atlas);
  return {
    opaque: createBufferGeometry(data.opaque),
    water: createBufferGeometry(data.water),
  };
}
