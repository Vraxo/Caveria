import { BlockId } from '../content/BlockId';
import type { CavernBiome, SurfaceBiome } from '../content/biomes/BiomeTypes';
import { CHUNK_HEIGHT, CHUNK_SIZE, Chunk, SEA_LEVEL } from './Chunk';
import { SeededNoise } from './Noise';
import { BiomeDecoratorRegistry } from './biomes/BiomeDecoratorRegistry';
import { createDefaultBiomeDecoratorRegistry } from './biomes/DefaultBiomeDecorators';

export type { CavernBiome, SurfaceBiome } from '../content/biomes/BiomeTypes';

export class TerrainGen {
  public readonly seed: number;
  private readonly terrainNoise: SeededNoise;
  private readonly tempNoise: SeededNoise;
  private readonly humidityNoise: SeededNoise;
  private readonly caveNoiseA: SeededNoise;
  private readonly caveNoiseB: SeededNoise;
  private readonly caveBiomeNoise: SeededNoise;
  private readonly oreNoise: SeededNoise;

  constructor(
    seed: number,
    private readonly decorators: BiomeDecoratorRegistry = createDefaultBiomeDecoratorRegistry()
  ) {
    this.seed = seed;
    this.terrainNoise = new SeededNoise(seed);
    this.tempNoise = new SeededNoise(seed ^ 0x51f2a93d);
    this.humidityNoise = new SeededNoise(seed ^ 0x7b3e19d5);
    this.caveNoiseA = new SeededNoise(seed ^ 0x9e3779b9);
    this.caveNoiseB = new SeededNoise(seed ^ 0x85ebca6b);
    this.caveBiomeNoise = new SeededNoise(seed ^ 0x2f6e2b11);
    this.oreNoise = new SeededNoise(seed ^ 0xc2b2ae35);
  }

  public getSurfaceBiome(wx: number, wz: number, surfaceY?: number): SurfaceBiome {
    const h = surfaceY ?? this.getSurfaceHeight(wx, wz);
    if (h >= 74) {
      return 'Alpine Peaks';
    }

    const temp = this.tempNoise.fbm2D(wx * 0.0038, wz * 0.0038, 2);
    const humidity = this.humidityNoise.fbm2D(wx * 0.0042 + 120, wz * 0.0042 - 90, 2);

    if (temp > 0.24 && humidity < 0.08) {
      return 'Desert Dunes';
    }
    if (temp < -0.22 || h >= 68) {
      return 'Snowy Taiga';
    }
    if (humidity > 0.06) {
      return 'Oak Forest';
    }
    return 'Meadows';
  }

  public getCavernBiome(wx: number, wz: number): CavernBiome {
    const v = this.caveBiomeNoise.fbm2D(wx * 0.0075, wz * 0.0075, 2);
    if (v > 0.18) {
      return 'Lush Bioluminescent Cavern';
    }
    if (v < -0.18) {
      return 'Crystal Geode Hall';
    }
    return 'Dripstone Depths';
  }

  public getBiomeLabelAt(wx: number, wy: number, wz: number): string {
    const surfaceY = this.getSurfaceHeight(wx, wz);
    if (wy < surfaceY - 8 && wy < 42) {
      return this.getCavernBiome(wx, wz);
    }
    return this.getSurfaceBiome(wx, wz, surfaceY);
  }

  public getSurfaceHeight(wx: number, wz: number): number {
    const continent = this.terrainNoise.fbm2D(wx * 0.0045, wz * 0.0045, 3);
    const detail = this.terrainNoise.fbm2D(wx * 0.016, wz * 0.016, 4);
    const ridgeRaw = 1 - Math.abs(this.terrainNoise.noise2D(wx * 0.008, wz * 0.008));
    const mountainMask = Math.max(0, continent + 0.16);
    const mountains = ridgeRaw * ridgeRaw * mountainMask * 28;

    const h = SEA_LEVEL + 6 + continent * 14 + detail * 8.5 + mountains;
    return Math.max(8, Math.min(CHUNK_HEIGHT - 16, Math.floor(h)));
  }

  public populateChunk(chunk: Chunk): void {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    const heights = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);
    const biomes: SurfaceBiome[] = new Array(CHUNK_SIZE * CHUNK_SIZE);
    const cavBiomes: CavernBiome[] = new Array(CHUNK_SIZE * CHUNK_SIZE);

    // Pass 1: Surface biome blocks, Deepslate strata, Spaghetti + Cathedral Caverns, Ores, Aquifers
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = baseZ + lz;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const colIdx = lz * CHUNK_SIZE + lx;
        const surfaceY = this.getSurfaceHeight(wx, wz);
        const surfBiome = this.getSurfaceBiome(wx, wz, surfaceY);
        const cavBiome = this.getCavernBiome(wx, wz);

        heights[colIdx] = surfaceY;
        biomes[colIdx] = surfBiome;
        cavBiomes[colIdx] = cavBiome;

        const isShore = surfaceY <= SEA_LEVEL + 2;
        const slateBoundary = 25 + Math.floor(this.oreNoise.noise2D(wx * 0.09, wz * 0.09) * 3);

        for (let y = 0; y <= Math.max(surfaceY, SEA_LEVEL); y++) {
          if (y === 0) {
            chunk.set(lx, y, lz, BlockId.Bedrock);
            continue;
          }

          if (y > surfaceY) {
            chunk.set(lx, y, lz, BlockId.Water);
            continue;
          }

          // Determine base solid block from surface biome + depth strata
          let block: BlockId;
          if (y === surfaceY) {
            if (y < SEA_LEVEL - 1) {
              block = BlockId.Dirt;
            } else if (surfBiome === 'Desert Dunes' || isShore) {
              block = BlockId.Sand;
            } else if (surfBiome === 'Alpine Peaks') {
              block = surfaceY >= 79 ? BlockId.SnowBlock : BlockId.Stone;
            } else if (surfBiome === 'Snowy Taiga') {
              block = BlockId.SnowGrass;
            } else {
              block = BlockId.Grass;
            }
          } else if (y >= surfaceY - 3) {
            if (surfBiome === 'Desert Dunes') {
              block = y === surfaceY - 3 ? BlockId.Sandstone : BlockId.Sand;
            } else if (isShore) {
              block = BlockId.Sand;
            } else if (surfBiome === 'Alpine Peaks') {
              block = BlockId.Stone;
            } else {
              block = BlockId.Dirt;
            }
          } else if (surfBiome === 'Desert Dunes' && y >= surfaceY - 6) {
            block = BlockId.Sandstone;
          } else if (y <= slateBoundary) {
            block = BlockId.DeepSlate;
          } else {
            block = BlockId.Stone;
          }

          // 3D Cave & Signature "Caveria" Cathedral Cavern Carving
          const allowSurfaceOpening = surfaceY > SEA_LEVEL + 3;
          const maxCaveY = allowSurfaceOpening ? surfaceY : surfaceY - 4;
          if (y > 2 && y <= maxCaveY) {
            // Winding spaghetti tunnels connecting surface to depths
            const n1 = this.caveNoiseA.noise3D(wx * 0.031, y * 0.042, wz * 0.031);
            const n2 = this.caveNoiseB.noise3D(wx * 0.031 + 57.3, y * 0.042 - 19.1, wz * 0.031 + 83.7);
            const spaghetti = n1 * n1 + n2 * n2 < 0.025;

            // Broad subterranean cathedral halls centered around y=14..32
            let cathedral = false;
            if (y >= 8 && y <= 38) {
              const verticalMask = 1 - Math.pow((y - 22) / 15, 2); // peaks at y=22
              const hallNoise = this.caveNoiseA.noise3D(wx * 0.015 - 31, y * 0.026, wz * 0.015 + 17);
              // Leave occasional natural rock pillars inside massive halls
              const pillarNoise = this.caveNoiseB.noise2D(wx * 0.055, wz * 0.055);
              if (hallNoise + verticalMask * 0.34 > 0.72 && pillarNoise < 0.62) {
                cathedral = true;
              }
            }

            if (spaghetti || cathedral) {
              // Shallow subterranean aquifer pools at the very bottom of deep caverns
              if (y <= 10) {
                chunk.set(lx, y, lz, BlockId.Water);
              } else {
                chunk.set(lx, y, lz, BlockId.Air);
              }
              continue;
            }
          }

          // Ore veins inside Stone & Deepslate
          if (block === BlockId.Stone || block === BlockId.DeepSlate) {
            const coalVal = this.oreNoise.noise3D(wx * 0.11, y * 0.11, wz * 0.11);
            if (coalVal > 0.68) {
              block = BlockId.CoalOre;
            } else if (y < 36) {
              const goldVal = this.oreNoise.noise3D(wx * 0.13 + 120, y * 0.13 + 45, wz * 0.13 - 80);
              if (goldVal > 0.72) {
                block = BlockId.GoldOre;
              }
            }
          }

          chunk.set(lx, y, lz, block);
        }
      }
    }

    const coordinateRandom = (x: number, z: number, salt: number) =>
      this.terrainNoise.coordRandom2D(x, z, salt);
    const crystalNoiseAt = (x: number, y: number, z: number) =>
      this.oreNoise.noise3D(x * 0.21 - 40, y * 0.21 + 90, z * 0.21 + 30);

    // Pass 2: Signature "Caveria" Underground Biome Decoration (y = 3..42)
    for (let lz = 1; lz < CHUNK_SIZE - 1; lz++) {
      const wz = baseZ + lz;
      for (let lx = 1; lx < CHUNK_SIZE - 1; lx++) {
        const wx = baseX + lx;
        const columnIndex = lz * CHUNK_SIZE + lx;
        const cavernBiome = cavBiomes[columnIndex];
        const maxDecorY = Math.min(42, heights[columnIndex] - 5);

        for (let y = 3; y <= maxDecorY; y++) {
          this.decorators.decorateCavern(cavernBiome, {
            chunk,
            lx,
            y,
            lz,
            wx,
            wz,
            current: chunk.get(lx, y, lz),
            below: chunk.get(lx, y - 1, lz),
            above: chunk.get(lx, y + 1, lz),
            random: this.terrainNoise.coordRandom2D(wx + y * 13, wz - y * 7, 41),
            coordinateRandom,
            crystalNoiseAt,
          });
        }
      }
    }

    // Pass 3: Surface Flora per Biome (Oak Trees, Frosted Spruce Pines, Desert Cacti)
    for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
      const wz = baseZ + lz;
      for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
        const wx = baseX + lx;
        const columnIndex = lz * CHUNK_SIZE + lx;
        const surfaceY = heights[columnIndex];
        if (surfaceY <= SEA_LEVEL + 2 || surfaceY >= CHUNK_HEIGHT - 14) continue;

        this.decorators.decorateSurface(biomes[columnIndex], {
          chunk,
          lx,
          lz,
          wx,
          wz,
          surfaceY,
          topBlock: chunk.get(lx, surfaceY, lz),
          random: this.terrainNoise.coordRandom2D(wx, wz, 7),
          coordinateRandom,
        });
      }
    }

    chunk.dirty = true;
  }

}
