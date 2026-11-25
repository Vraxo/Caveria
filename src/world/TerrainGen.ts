import { BlockId } from './Block';
import { CHUNK_HEIGHT, CHUNK_SIZE, Chunk, SEA_LEVEL } from './Chunk';
import { SeededNoise } from './Noise';

export class TerrainGen {
  public readonly seed: number;
  private readonly terrainNoise: SeededNoise;
  private readonly caveNoiseA: SeededNoise;
  private readonly caveNoiseB: SeededNoise;
  private readonly oreNoise: SeededNoise;

  constructor(seed: number) {
    this.seed = seed;
    this.terrainNoise = new SeededNoise(seed);
    this.caveNoiseA = new SeededNoise(seed ^ 0x9e3779b9);
    this.caveNoiseB = new SeededNoise(seed ^ 0x85ebca6b);
    this.oreNoise = new SeededNoise(seed ^ 0xc2b2ae35);
  }

  public getSurfaceHeight(wx: number, wz: number): number {
    // Broad continentalness + rolling hills + rocky ridges
    const continent = this.terrainNoise.fbm2D(wx * 0.0045, wz * 0.0045, 3);
    const detail = this.terrainNoise.fbm2D(wx * 0.016, wz * 0.016, 4);
    const ridgeRaw = 1 - Math.abs(this.terrainNoise.noise2D(wx * 0.008, wz * 0.008));
    const mountainMask = Math.max(0, continent + 0.15);
    const mountains = ridgeRaw * ridgeRaw * mountainMask * 24;

    const h = SEA_LEVEL + 6 + continent * 14 + detail * 9 + mountains;
    return Math.max(8, Math.min(CHUNK_HEIGHT - 16, Math.floor(h)));
  }

  public populateChunk(chunk: Chunk): void {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    const heights = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);

    // Pass 1: Base terrain, caves, ores, water
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = baseZ + lz;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const surfaceY = this.getSurfaceHeight(wx, wz);
        heights[lz * CHUNK_SIZE + lx] = surfaceY;

        const isBeach = surfaceY <= SEA_LEVEL + 2;

        for (let y = 0; y <= Math.max(surfaceY, SEA_LEVEL); y++) {
          if (y === 0) {
            chunk.set(lx, y, lz, BlockId.Bedrock);
            continue;
          }

          if (y > surfaceY) {
            // Underwater column above terrain
            chunk.set(lx, y, lz, BlockId.Water);
            continue;
          }

          // Determine solid block before cave carving
          let block: BlockId;
          if (y === surfaceY) {
            if (y < SEA_LEVEL - 1) {
              block = BlockId.Dirt;
            } else if (isBeach) {
              block = BlockId.Sand;
            } else {
              block = BlockId.Grass;
            }
          } else if (y >= surfaceY - 3) {
            block = isBeach ? BlockId.Sand : BlockId.Dirt;
          } else {
            block = BlockId.Stone;
          }

          // 3D Spaghetti & Cavern carving (avoid flooding oceans through seabed)
          const allowSurfaceOpening = surfaceY > SEA_LEVEL + 3;
          const maxCaveY = allowSurfaceOpening ? surfaceY : surfaceY - 4;
          if (y > 2 && y <= maxCaveY) {
            const n1 = this.caveNoiseA.noise3D(wx * 0.032, y * 0.042, wz * 0.032);
            const n2 = this.caveNoiseB.noise3D(wx * 0.032 + 57.3, y * 0.042 - 19.1, wz * 0.032 + 83.7);
            const tunnel = n1 * n1 + n2 * n2;

            // Occasional deep larger caverns ("Caveria" signature!)
            const cavern = y < 34 ? this.caveNoiseA.noise3D(wx * 0.018, y * 0.025, wz * 0.018) : 0;

            if (tunnel < 0.026 || cavern > 0.66) {
              chunk.set(lx, y, lz, BlockId.Air);
              continue;
            }
          }

          // Ore veins inside stone
          if (block === BlockId.Stone) {
            const coalVal = this.oreNoise.noise3D(wx * 0.11, y * 0.11, wz * 0.11);
            if (coalVal > 0.68) {
              block = BlockId.CoalOre;
            } else if (y < 34) {
              const goldVal = this.oreNoise.noise3D(wx * 0.13 + 120, y * 0.13 + 45, wz * 0.13 - 80);
              if (goldVal > 0.74) {
                block = BlockId.GoldOre;
              }
            }
          }

          chunk.set(lx, y, lz, block);
        }
      }
    }

    // Pass 2: Oak trees (kept away from chunk border so leaves don't clip across chunks)
    for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
      const wz = baseZ + lz;
      for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
        const wx = baseX + lx;
        const surfaceY = heights[lz * CHUNK_SIZE + lx];

        if (surfaceY <= SEA_LEVEL + 3 || surfaceY >= CHUNK_HEIGHT - 12) continue;
        if (chunk.get(lx, surfaceY, lz) !== BlockId.Grass) continue;

        const forestDensity = this.terrainNoise.noise2D(wx * 0.01, wz * 0.01);
        const treeChance = forestDensity > 0.1 ? 0.022 : 0.005;
        const r = this.terrainNoise.coordRandom2D(wx, wz, 7);

        if (r < treeChance && !this.hasNearbyTrunk(chunk, lx, surfaceY + 1, lz)) {
          const heightRand = this.terrainNoise.coordRandom2D(wx, wz, 19);
          const trunkHeight = 4 + Math.floor(heightRand * 3); // 4..6
          this.placeOakTree(chunk, lx, surfaceY + 1, lz, trunkHeight);
        }
      }
    }

    chunk.dirty = true;
  }

  private hasNearbyTrunk(chunk: Chunk, lx: number, y: number, lz: number): boolean {
    for (let dz = -3; dz <= 3; dz++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (chunk.get(lx + dx, y, lz + dz) === BlockId.OakLog) {
          return true;
        }
      }
    }
    return false;
  }

  private placeOakTree(chunk: Chunk, lx: number, baseY: number, lz: number, trunkHeight: number): void {
    // Dirt under trunk
    chunk.set(lx, baseY - 1, lz, BlockId.Dirt);

    const canopyStart = baseY + trunkHeight - 2;
    const canopyEnd = baseY + trunkHeight + 1;

    for (let y = canopyStart; y <= canopyEnd; y++) {
      const dy = y - (baseY + trunkHeight);
      const radius = dy >= 0 ? 1 : 2;

      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          // Round off the 4 extreme corners slightly
          if (Math.abs(dx) === radius && Math.abs(dz) === radius && (dy === 1 || (dx + dz + y) % 2 === 0)) {
            continue;
          }
          if (chunk.get(lx + dx, y, lz + dz) === BlockId.Air) {
            chunk.set(lx + dx, y, lz + dz, BlockId.OakLeaves);
          }
        }
      }
    }

    for (let i = 0; i < trunkHeight; i++) {
      chunk.set(lx, baseY + i, lz, BlockId.OakLog);
    }
  }
}
