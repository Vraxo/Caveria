import { describe, expect, it, vi } from 'vitest';
import { BlockId } from '../../src/content/BlockId';
import { CAVERN_BIOMES, SURFACE_BIOMES } from '../../src/content/biomes/BiomeTypes';
import { Chunk } from '../../src/world/Chunk';
import {
  BiomeDecoratorRegistry,
  type CavernDecorationContext,
  type SurfaceDecorationContext,
} from '../../src/world/biomes/BiomeDecoratorRegistry';
import { createDefaultBiomeDecoratorRegistry } from '../../src/world/biomes/DefaultBiomeDecorators';

function cavernContext(chunk: Chunk): CavernDecorationContext {
  return {
    chunk,
    lx: 8,
    y: 20,
    lz: 8,
    wx: 8,
    wz: 8,
    current: chunk.get(8, 20, 8),
    below: chunk.get(8, 19, 8),
    above: chunk.get(8, 21, 8),
    random: 0.01,
    coordinateRandom: () => 0,
    crystalNoiseAt: () => 0,
  };
}

function surfaceContext(chunk: Chunk): SurfaceDecorationContext {
  return {
    chunk,
    lx: 8,
    lz: 8,
    wx: 8,
    wz: 8,
    surfaceY: 50,
    topBlock: chunk.get(8, 50, 8),
    random: 0,
    coordinateRandom: () => 0,
  };
}

describe('BiomeDecoratorRegistry', () => {
  it('registers every known surface and cavern biome', () => {
    const registry = createDefaultBiomeDecoratorRegistry();

    for (const biome of SURFACE_BIOMES) expect(registry.hasSurface(biome)).toBe(true);
    for (const biome of CAVERN_BIOMES) expect(registry.hasCavern(biome)).toBe(true);
  });

  it('dispatches default underground and surface decoration policy', () => {
    const registry = createDefaultBiomeDecoratorRegistry();
    const cavern = new Chunk(0, 0);
    cavern.set(8, 19, 8, BlockId.Stone);

    registry.decorateCavern('Lush Bioluminescent Cavern', cavernContext(cavern));

    expect(cavern.get(8, 19, 8)).toBe(BlockId.MossStone);
    expect(cavern.get(8, 20, 8)).toBe(BlockId.CaveShroom);

    const surface = new Chunk(0, 0);
    surface.set(8, 50, 8, BlockId.Sand);
    registry.decorateSurface('Desert Dunes', surfaceContext(surface));

    expect(surface.get(8, 51, 8)).toBe(BlockId.Cactus);
    expect(surface.get(8, 52, 8)).toBe(BlockId.Cactus);
  });

  it('rejects duplicate decorators and missing dispatch targets', () => {
    const cavernDecorator = vi.fn();
    const registry = new BiomeDecoratorRegistry()
      .registerCavern('Crystal Geode Hall', cavernDecorator)
      .registerSurface('Meadows', () => {});
    const chunk = new Chunk(0, 0);

    registry.decorateCavern('Crystal Geode Hall', cavernContext(chunk));
    expect(cavernDecorator).toHaveBeenCalledOnce();
    expect(() => registry.registerCavern('Crystal Geode Hall', () => {}))
      .toThrow('Duplicate cavern biome decorator');
    expect(() => registry.registerSurface('Meadows', () => {}))
      .toThrow('Duplicate surface biome decorator');
    expect(() => registry.decorateSurface('Oak Forest', surfaceContext(chunk)))
      .toThrow('Missing surface biome decorator');
  });
});
