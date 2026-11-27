import { BlockId } from '../../content/BlockId';
import {
  BiomeDecoratorRegistry,
  type CavernDecorationContext,
  type SurfaceDecorationContext,
} from './BiomeDecoratorRegistry';

export function createDefaultBiomeDecoratorRegistry(): BiomeDecoratorRegistry {
  return new BiomeDecoratorRegistry()
    .registerCavern('Lush Bioluminescent Cavern', decorateLushCavern)
    .registerCavern('Crystal Geode Hall', decorateCrystalCavern)
    .registerCavern('Dripstone Depths', decorateDripstoneCavern)
    .registerSurface('Desert Dunes', decorateDesert)
    .registerSurface('Snowy Taiga', decorateSnowyTaiga)
    .registerSurface('Alpine Peaks', () => {})
    .registerSurface('Oak Forest', decorateOakForest)
    .registerSurface('Meadows', decorateMeadows);
}

function decorateLushCavern(context: CavernDecorationContext): void {
  const { chunk, lx, y, lz, wx, wz, current, below, above, random } = context;
  if (current === BlockId.Air) {
    if (isCavernFloor(below)) {
      chunk.set(lx, y - 1, lz, BlockId.MossStone);
      if (random < 0.09) chunk.set(lx, y, lz, BlockId.CaveShroom);
    } else if (isCavernCeiling(above) && random > 0.89) {
      const length = 1 + Math.floor(context.coordinateRandom(wx, wz, y + 99) * 3);
      for (let offset = 0; offset < length; offset++) {
        if (chunk.get(lx, y - offset, lz) !== BlockId.Air) break;
        chunk.set(lx, y - offset, lz, BlockId.CaveVine);
      }
    }
    return;
  }
  decorateExposedCrystal(context, false);
}

function decorateDripstoneCavern(context: CavernDecorationContext): void {
  const { chunk, lx, y, lz, current, below, above, random } = context;
  if (current === BlockId.Air) {
    if ((isCavernFloor(below) && random < 0.12)
      || (isCavernCeiling(above) && random > 0.9)) {
      chunk.set(lx, y, lz, BlockId.DripstoneSpike);
    }
    return;
  }
  decorateExposedCrystal(context, false);
}

function decorateCrystalCavern(context: CavernDecorationContext): void {
  const { chunk, lx, y, lz, current, below, random } = context;
  if (current === BlockId.Air) {
    if (isCavernFloor(below) && random < 0.03) {
      chunk.set(lx, y, lz, BlockId.AmethystCrystal);
    }
    return;
  }
  decorateExposedCrystal(context, true);
}

function decorateExposedCrystal(
  context: CavernDecorationContext,
  geode: boolean
): void {
  const { chunk, lx, y, lz, wx, wz, current } = context;
  if (current !== BlockId.Stone && current !== BlockId.DeepSlate) return;
  if (!touchesAir(context)) return;

  const noise = context.crystalNoiseAt(wx, y, wz);
  if (geode) {
    if (noise > 0.64) {
      const amethyst = context.coordinateRandom(wx + y, wz - y, 77) > 0.45;
      chunk.set(lx, y, lz, amethyst ? BlockId.AmethystCrystal : BlockId.GlowCrystal);
    }
  } else if (noise > 0.81) {
    chunk.set(lx, y, lz, BlockId.GlowCrystal);
  }
}

function isCavernFloor(block: BlockId): boolean {
  return block === BlockId.Stone || block === BlockId.DeepSlate || block === BlockId.MossStone;
}

function isCavernCeiling(block: BlockId): boolean {
  return block === BlockId.Stone || block === BlockId.DeepSlate;
}

function touchesAir({ chunk, lx, y, lz }: CavernDecorationContext): boolean {
  return chunk.get(lx + 1, y, lz) === BlockId.Air
    || chunk.get(lx - 1, y, lz) === BlockId.Air
    || chunk.get(lx, y + 1, lz) === BlockId.Air
    || chunk.get(lx, y - 1, lz) === BlockId.Air
    || chunk.get(lx, y, lz + 1) === BlockId.Air
    || chunk.get(lx, y, lz - 1) === BlockId.Air;
}

function decorateDesert(context: SurfaceDecorationContext): void {
  const { chunk, lx, lz, wx, wz, surfaceY, topBlock, random } = context;
  if (topBlock !== BlockId.Sand || random >= 0.011
    || hasAdjacentSolid(chunk, lx, surfaceY + 1, lz)) return;
  const height = 2 + Math.floor(context.coordinateRandom(wx, wz, 23) * 2);
  for (let offset = 1; offset <= height; offset++) {
    chunk.set(lx, surfaceY + offset, lz, BlockId.Cactus);
  }
}

function decorateSnowyTaiga(context: SurfaceDecorationContext): void {
  const { chunk, lx, lz, wx, wz, surfaceY, topBlock, random } = context;
  if (topBlock !== BlockId.SnowGrass || random >= 0.02
    || hasNearbyTrunk(chunk, lx, surfaceY + 1, lz)) return;
  const height = 6 + Math.floor(context.coordinateRandom(wx, wz, 31) * 3);
  placeSpruceTree(chunk, lx, surfaceY + 1, lz, height);
}

function decorateOakForest(context: SurfaceDecorationContext): void {
  decorateOak(context, 0.025);
}

function decorateMeadows(context: SurfaceDecorationContext): void {
  decorateOak(context, 0.004);
}

function decorateOak(context: SurfaceDecorationContext, chance: number): void {
  const { chunk, lx, lz, wx, wz, surfaceY, topBlock, random } = context;
  if (topBlock !== BlockId.Grass || random >= chance
    || hasNearbyTrunk(chunk, lx, surfaceY + 1, lz)) return;
  const height = 4 + Math.floor(context.coordinateRandom(wx, wz, 19) * 3);
  placeOakTree(chunk, lx, surfaceY + 1, lz, height);
}

function hasAdjacentSolid(chunk: SurfaceDecorationContext['chunk'], lx: number, y: number, lz: number): boolean {
  return chunk.get(lx + 1, y, lz) !== BlockId.Air
    || chunk.get(lx - 1, y, lz) !== BlockId.Air
    || chunk.get(lx, y, lz + 1) !== BlockId.Air
    || chunk.get(lx, y, lz - 1) !== BlockId.Air;
}

function hasNearbyTrunk(chunk: SurfaceDecorationContext['chunk'], lx: number, y: number, lz: number): boolean {
  for (let dz = -3; dz <= 3; dz++) {
    for (let dx = -3; dx <= 3; dx++) {
      const block = chunk.get(lx + dx, y, lz + dz);
      if (block === BlockId.OakLog || block === BlockId.SpruceLog) return true;
    }
  }
  return false;
}

function placeOakTree(
  chunk: SurfaceDecorationContext['chunk'],
  lx: number,
  baseY: number,
  lz: number,
  trunkHeight: number
): void {
  chunk.set(lx, baseY - 1, lz, BlockId.Dirt);
  const canopyStart = baseY + trunkHeight - 2;
  const canopyEnd = baseY + trunkHeight + 1;

  for (let y = canopyStart; y <= canopyEnd; y++) {
    const dy = y - (baseY + trunkHeight);
    const radius = dy >= 0 ? 1 : 2;
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) === radius && Math.abs(dz) === radius
          && (dy === 1 || (dx + dz + y) % 2 === 0)) continue;
        if (chunk.get(lx + dx, y, lz + dz) === BlockId.Air) {
          chunk.set(lx + dx, y, lz + dz, BlockId.OakLeaves);
        }
      }
    }
  }

  for (let offset = 0; offset < trunkHeight; offset++) {
    chunk.set(lx, baseY + offset, lz, BlockId.OakLog);
  }
}

function placeSpruceTree(
  chunk: SurfaceDecorationContext['chunk'],
  lx: number,
  baseY: number,
  lz: number,
  trunkHeight: number
): void {
  chunk.set(lx, baseY - 1, lz, BlockId.Dirt);
  for (let offset = 2; offset <= trunkHeight + 1; offset++) {
    const y = baseY + offset;
    const fromTop = trunkHeight + 1 - offset;
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

  for (let offset = 0; offset < trunkHeight; offset++) {
    chunk.set(lx, baseY + offset, lz, BlockId.SpruceLog);
  }
}
