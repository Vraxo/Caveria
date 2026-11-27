import { describe, expect, it } from 'vitest';
import { BlockId } from '../../src/content/BlockId';
import { BIOME_DEFINITIONS } from '../../src/content/biomes/BiomeDefinitions';
import { CAVERN_BIOMES, SURFACE_BIOMES } from '../../src/content/biomes/BiomeTypes';
import { ItemId } from '../../src/items/ItemTypes';

describe('BiomeDefinitionRegistry', () => {
  it('contains every typed surface and cavern biome', () => {
    expect(Object.keys(BIOME_DEFINITIONS.surface)).toEqual(expect.arrayContaining([...SURFACE_BIOMES]));
    expect(Object.keys(BIOME_DEFINITIONS.cavern)).toEqual(expect.arrayContaining([...CAVERN_BIOMES]));
  });

  it('selects surface biomes in priority order from elevation and climate', () => {
    expect(BIOME_DEFINITIONS.selectSurface({
      surfaceY: 80, temperatureNoise: -1, humidityNoise: 1,
    }).id).toBe('Alpine Peaks');
    expect(BIOME_DEFINITIONS.selectSurface({
      surfaceY: 60, temperatureNoise: 0.5, humidityNoise: 0,
    }).id).toBe('Desert Dunes');
    expect(BIOME_DEFINITIONS.selectSurface({
      surfaceY: 70, temperatureNoise: 0.5, humidityNoise: 1,
    }).id).toBe('Snowy Taiga');
    expect(BIOME_DEFINITIONS.selectSurface({
      surfaceY: 60, temperatureNoise: 0, humidityNoise: 0.2,
    }).id).toBe('Oak Forest');
    expect(BIOME_DEFINITIONS.selectSurface({
      surfaceY: 60, temperatureNoise: 0, humidityNoise: 0,
    }).id).toBe('Meadows');
  });

  it('declares terrain, environment, tags, and fishing policy as biome data', () => {
    const desert = BIOME_DEFINITIONS.getSurface('Desert Dunes');
    const alpine = BIOME_DEFINITIONS.getSurface('Alpine Peaks');
    const forest = BIOME_DEFINITIONS.getSurface('Oak Forest');

    expect(desert.terrain.shallowSubsurfaceBlock(3, false)).toBe(BlockId.Sandstone);
    expect(alpine.terrain.surfaceBlock(80)).toBe(BlockId.SnowBlock);
    expect(alpine.precipitation).toBe('snow');
    expect(alpine.temperature).toEqual({ day: 17, night: 5 });
    expect(forest.tags).toContain('temperate');
    expect(forest.surfaceWater).toBe('fresh');
    expect(desert.fishingWeightShifts).toContainEqual({
      from: ItemId.RawRiverFish,
      to: ItemId.Stick,
      weight: 10,
    });
    expect(BIOME_DEFINITIONS.getCavern('Crystal Geode Hall').tags).toContain('geode');
  });
});
