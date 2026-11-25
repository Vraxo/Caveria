import { BlockId } from '../content/BlockId';
import { CHUNK_HEIGHT, CHUNK_SIZE, Chunk, SEA_LEVEL } from './Chunk';
import { SeededNoise } from './Noise';

export type SurfaceBiome = 'Desert Dunes' | 'Snowy Taiga' | 'Alpine Peaks' | 'Oak Forest' | 'Meadows';
export type CavernBiome = 'Lush Bioluminescent Cavern' | 'Crystal Geode Hall' | 'Dripstone Depths';

export class TerrainGen {
  public readonly seed: number;
  private readonly terrainNoise: SeededNoise;
  private readonly tempNoise: SeededNoise;
  private readonly humidityNoise: SeededNoise;
  private readonly caveNoiseA: SeededNoise;
  private readonly caveNoiseB: SeededNoise;
  private readonly caveBiomeNoise: SeededNoise;
  private readonly oreNoise: SeededNoise;

  constructor(seed: number) {
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

    // Pass 2: Signature "Caveria" Underground Biome Decoration (y = 3..42)
    for (let lz = 1; lz < CHUNK_SIZE - 1; lz++) {
      const wz = baseZ + lz;
      for (let lx = 1; lx < CHUNK_SIZE - 1; lx++) {
        const wx = baseX + lx;
        const cavBiome = cavBiomes[lz * CHUNK_SIZE + lx];
        const surfaceY = heights[lz * CHUNK_SIZE + lx];
        const maxDecorY = Math.min(42, surfaceY - 5);

        for (let y = 3; y <= maxDecorY; y++) {
          const cur = chunk.get(lx, y, lz);

          if (cur === BlockId.Air) {
            const below = chunk.get(lx, y - 1, lz);
            const above = chunk.get(lx, y + 1, lz);
            const r = this.terrainNoise.coordRandom2D(wx + y * 13, wz - y * 7, 41);

            // Floor decorations (resting on stone/deepslate/moss)
            const validFloor =
              below === BlockId.Stone || below === BlockId.DeepSlate || below === BlockId.MossStone;
            // Ceiling decorations (hanging under stone/deepslate)
            const validCeiling = above === BlockId.Stone || above === BlockId.DeepSlate;

            if (cavBiome === 'Lush Bioluminescent Cavern') {
              if (validFloor) {
                // Convert cave floor to Lush Moss!
                chunk.set(lx, y - 1, lz, BlockId.MossStone);
                if (r < 0.09) {
                  chunk.set(lx, y, lz, BlockId.CaveShroom);
                }
              } else if (validCeiling && r > 0.89) {
                // Hang 1..3 block glowing cave vine tendrils
                const vineLen = 1 + Math.floor(this.terrainNoise.coordRandom2D(wx, wz, y + 99) * 3);
                for (let v = 0; v < vineLen; v++) {
                  if (chunk.get(lx, y - v, lz) === BlockId.Air) {
                    chunk.set(lx, y - v, lz, BlockId.CaveVine);
                  } else {
                    break;
                  }
                }
              }
            } else if (cavBiome === 'Dripstone Depths') {
              if (validFloor && r < 0.12) {
                chunk.set(lx, y, lz, BlockId.DripstoneSpike);
              } else if (validCeiling && r > 0.9) {
                chunk.set(lx, y, lz, BlockId.DripstoneSpike);
              }
            } else if (cavBiome === 'Crystal Geode Hall') {
              if (validFloor && r < 0.03) {
                chunk.set(lx, y, lz, BlockId.AmethystCrystal);
              }
            }
          } else if (cur === BlockId.Stone || cur === BlockId.DeepSlate) {
            // Embed glowing Azure & Amethyst crystals along exposed cavern walls/ceilings
            const touchesAir =
              chunk.get(lx + 1, y, lz) === BlockId.Air ||
              chunk.get(lx - 1, y, lz) === BlockId.Air ||
              chunk.get(lx, y + 1, lz) === BlockId.Air ||
              chunk.get(lx, y - 1, lz) === BlockId.Air ||
              chunk.get(lx, y, lz + 1) === BlockId.Air ||
              chunk.get(lx, y, lz - 1) === BlockId.Air;
            if (!touchesAir) continue;

            const cNoise = this.oreNoise.noise3D(wx * 0.21 - 40, y * 0.21 + 90, wz * 0.21 + 30);
            if (cavBiome === 'Crystal Geode Hall') {
              if (cNoise > 0.64) {
                const useAmethyst = this.terrainNoise.coordRandom2D(wx + y, wz - y, 77) > 0.45;
                chunk.set(lx, y, lz, useAmethyst ? BlockId.AmethystCrystal : BlockId.GlowCrystal);
              }
            } else if (cNoise > 0.81) {
              chunk.set(lx, y, lz, BlockId.GlowCrystal);
            }
          }
        }
      }
    }

    // Pass 3: Surface Flora per Biome (Oak Trees, Frosted Spruce Pines, Desert Cacti)
    for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
      const wz = baseZ + lz;
      for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
        const wx = baseX + lx;
        const colIdx = lz * CHUNK_SIZE + lx;
        const surfaceY = heights[colIdx];
        const biome = biomes[colIdx];

        if (surfaceY <= SEA_LEVEL + 2 || surfaceY >= CHUNK_HEIGHT - 14) continue;
        const topBlock = chunk.get(lx, surfaceY, lz);
        const r = this.terrainNoise.coordRandom2D(wx, wz, 7);

        if (biome === 'Desert Dunes' && topBlock === BlockId.Sand) {
          if (r < 0.011 && !this.hasAdjacentSolid(chunk, lx, surfaceY + 1, lz)) {
            const cactusH = 2 + Math.floor(this.terrainNoise.coordRandom2D(wx, wz, 23) * 2); // 2..3
            for (let i = 1; i <= cactusH; i++) {
              chunk.set(lx, surfaceY + i, lz, BlockId.Cactus);
            }
          }
        } else if (biome === 'Snowy Taiga' && topBlock === BlockId.SnowGrass) {
          if (r < 0.02 && !this.hasNearbyTrunk(chunk, lx, surfaceY + 1, lz)) {
            const pineH = 6 + Math.floor(this.terrainNoise.coordRandom2D(wx, wz, 31) * 3); // 6..8
            this.placeSpruceTree(chunk, lx, surfaceY + 1, lz, pineH);
          }
        } else if ((biome === 'Oak Forest' || biome === 'Meadows') && topBlock === BlockId.Grass) {
          const chance = biome === 'Oak Forest' ? 0.025 : 0.004;
          if (r < chance && !this.hasNearbyTrunk(chunk, lx, surfaceY + 1, lz)) {
            const trunkH = 4 + Math.floor(this.terrainNoise.coordRandom2D(wx, wz, 19) * 3);
            this.placeOakTree(chunk, lx, surfaceY + 1, lz, trunkH);
          }
        }
      }
    }

    chunk.dirty = true;
  }

  private hasAdjacentSolid(chunk: Chunk, lx: number, y: number, lz: number): boolean {
    return (
      chunk.get(lx + 1, y, lz) !== BlockId.Air ||
      chunk.get(lx - 1, y, lz) !== BlockId.Air ||
      chunk.get(lx, y, lz + 1) !== BlockId.Air ||
      chunk.get(lx, y, lz - 1) !== BlockId.Air
    );
  }

  private hasNearbyTrunk(chunk: Chunk, lx: number, y: number, lz: number): boolean {
    for (let dz = -3; dz <= 3; dz++) {
      for (let dx = -3; dx <= 3; dx++) {
        const b = chunk.get(lx + dx, y, lz + dz);
        if (b === BlockId.OakLog || b === BlockId.SpruceLog) {
          return true;
        }
      }
    }
    return false;
  }

  private placeOakTree(chunk: Chunk, lx: number, baseY: number, lz: number, trunkHeight: number): void {
    chunk.set(lx, baseY - 1, lz, BlockId.Dirt);

    const canopyStart = baseY + trunkHeight - 2;
    const canopyEnd = baseY + trunkHeight + 1;

    for (let y = canopyStart; y <= canopyEnd; y++) {
      const dy = y - (baseY + trunkHeight);
      const radius = dy >= 0 ? 1 : 2;

      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (
            Math.abs(dx) === radius &&
            Math.abs(dz) === radius &&
            (dy === 1 || (dx + dz + y) % 2 === 0)
          ) {
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

  private placeSpruceTree(chunk: Chunk, lx: number, baseY: number, lz: number, trunkHeight: number): void {
    chunk.set(lx, baseY - 1, lz, BlockId.Dirt);

    // Tiered conical alpine spruce needles
    for (let i = 2; i <= trunkHeight + 1; i++) {
      const y = baseY + i;
      const fromTop = trunkHeight + 1 - i;
      const radius = fromTop === 0 ? 0 : fromTop % 2 === 1 ? 1 : 2;

      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (radius === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          if (chunk.get(lx + dx, y, lz + dz) === BlockId.Air) {
            chunk.set(lx + dx, y, lz + dz, BlockId.SpruceLeaves);
          }
        }
      }
    }

    for (let i = 0; i < trunkHeight; i++) {
      chunk.set(lx, baseY + i, lz, BlockId.SpruceLog);
    }
  }
}
