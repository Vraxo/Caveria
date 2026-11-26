import { BlockId } from '../../src/content/BlockId';
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
      getCavernBiome: () => 'Crystal Geode Hall',
    },
  } as unknown as World;
}
