import { BlockId } from '../../src/content/BlockId';
import { BIOME_DEFINITIONS } from '../../src/content/biomes/BiomeDefinitions';
import { SurfaceBiome } from '../../src/world/TerrainGen';
import { World } from '../../src/world/World';

interface FakeWorldOptions {
  getBlock?: (x: number, y: number, z: number) => BlockId;
  surfaceHeight?: number;
  surfaceBiome?: SurfaceBiome;
  packedLight?: number;
}

export function createFakeWorld(options: FakeWorldOptions = {}): World {
  return {
    getBlock: options.getBlock ?? ((_x, y, _z) => y < 0 ? BlockId.Stone : BlockId.Air),
    getPackedLight: () => options.packedLight ?? 0,
    terrainGen: {
      getSurfaceHeight: () => options.surfaceHeight ?? 0,
      getSurfaceBiome: () => options.surfaceBiome ?? 'Meadows',
      getSurfaceBiomeDefinition: () =>
        BIOME_DEFINITIONS.getSurface(options.surfaceBiome ?? 'Meadows'),
      getCavernBiome: () => 'Crystal Geode Hall',
      getCavernBiomeDefinition: () => BIOME_DEFINITIONS.getCavern('Crystal Geode Hall'),
    },
  } as unknown as World;
}
