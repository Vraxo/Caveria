import { World } from '../world/World';

export type WaterQuality = 'fresh' | 'murky' | 'tainted';

/** Deterministic water quality from biome, depth, and coordinates; no per-block save data. */
export function getWaterQuality(world: World, x: number, y: number, z: number): WaterQuality {
  const wx = Math.floor(x);
  const wy = Math.floor(y);
  const wz = Math.floor(z);
  const surface = world.terrainGen.getSurfaceHeight(wx, wz);
  const biome = world.terrainGen.getSurfaceBiomeDefinition(wx, wz, surface);
  const hash = coordinateHash(wx, wy, wz);

  if (wy >= surface - 3) {
    if (biome.surfaceWater === 'fresh') return 'fresh';
    return hash % 5 === 0 ? 'murky' : 'fresh';
  }
  if (wy < 24 || hash % 7 === 0) return 'tainted';
  return 'murky';
}

function coordinateHash(x: number, y: number, z: number): number {
  let value = Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791);
  value ^= value >>> 13;
  return Math.abs(Math.imul(value, 1274126177));
}
