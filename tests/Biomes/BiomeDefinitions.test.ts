import { describe, expect, it } from 'vitest';
import { BlockId } from '../../src/content/BlockId';
import { BIOME_DEFINITIONS } from '../../src/Biomes/BiomeDefinitions';
import { CAVERN_BIOMES, SURFACE_BIOMES } from '../../src/Biomes/BiomeTypes';
import { ItemId } from '../../src/items/ItemTypes';
import { Chunk, CHUNK_SIZE, SEA_LEVEL } from '../../src/world/Chunk';
import { TerrainGen } from '../../src/world/TerrainGen';

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
      surfaceY: 70, temperatureNoise: -0.5, humidityNoise: 1,
    }).id).toBe('Snowy Taiga');
    expect(BIOME_DEFINITIONS.selectSurface({
      surfaceY: 60, temperatureNoise: 0, humidityNoise: 0.2,
    }).id).toBe('Oak Forest');
    expect(BIOME_DEFINITIONS.selectSurface({
      surfaceY: 60, temperatureNoise: 0, humidityNoise: 0,
    }).id).toBe('Meadows');
    expect(BIOME_DEFINITIONS.selectSurface({
      surfaceY: 80, temperatureNoise: 0.4, humidityNoise: 0,
    }).id).toBe('Desert Dunes');
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

  it('keeps a temperate buffer so deserts and cold snow biomes never touch directly', () => {
    for (let temp = -0.08; temp <= 0.24; temp += 0.04) {
      for (const humidity of [-0.5, 0, 0.5]) {
        for (const surfaceY of [64, 82]) {
          const biome = BIOME_DEFINITIONS.selectSurface({
            surfaceY,
            temperatureNoise: temp,
            humidityNoise: humidity,
          });
          expect(biome.tags).not.toContain('arid');
          expect(biome.tags).not.toContain('cold');
        }
      }
    }
  });

  it('uses snowy/rocky shorelines instead of sand in cold biomes and snowy borders', () => {
    const snowy = BIOME_DEFINITIONS.getSurface('Snowy Taiga');
    const alpine = BIOME_DEFINITIONS.getSurface('Alpine Peaks');
    expect(snowy.terrain.shoreSurfaceBlock(SEA_LEVEL + 1, SEA_LEVEL)).toBe(BlockId.SnowBlock);
    expect(snowy.terrain.shoreSurfaceBlock(SEA_LEVEL, SEA_LEVEL)).toBe(BlockId.Stone);
    expect(snowy.terrain.shallowSubsurfaceBlock(1, true)).toBe(BlockId.Dirt);
    expect(alpine.terrain.shoreSurfaceBlock(SEA_LEVEL + 1, SEA_LEVEL)).toBe(BlockId.SnowBlock);
    expect(alpine.terrain.shallowSubsurfaceBlock(1, true)).toBe(BlockId.Stone);

    // Find a real Snowy Taiga shoreline chunk and verify zero sand blocks appear on cold columns.
    const gen = new TerrainGen(1337, undefined, undefined, 'compact');
    let checkedColdShores = 0;
    for (let cx = -24; cx <= 24 && checkedColdShores < 3; cx++) {
      for (let cz = -24; cz <= 24 && checkedColdShores < 3; cz++) {
        const wx = cx * CHUNK_SIZE + 8;
        const wz = cz * CHUNK_SIZE + 8;
        const h = gen.getSurfaceHeight(wx, wz);
        if (h <= SEA_LEVEL + 2 && gen.getSurfaceBiome(wx, wz, h) === 'Snowy Taiga') {
          const chunk = new Chunk(cx, cz);
          gen.populateChunk(chunk);
          for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
              const colX = cx * CHUNK_SIZE + lx;
              const colZ = cz * CHUNK_SIZE + lz;
              const colH = gen.getSurfaceHeight(colX, colZ);
              if (gen.getSurfaceBiome(colX, colZ, colH) === 'Snowy Taiga') {
                expect(chunk.get(lx, colH, lz)).not.toBe(BlockId.Sand);
              }
            }
          }
          checkedColdShores++;
        }
      }
    }
    expect(checkedColdShores).toBeGreaterThan(0);
  });
});
