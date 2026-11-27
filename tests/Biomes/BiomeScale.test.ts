import { describe, expect, it } from 'vitest';
import { TerrainGen } from '../../src/world/TerrainGen';

function createTerrain(seed: number, biomeSize: 'compact' | 'standard' | 'large'): TerrainGen {
  return new TerrainGen(seed, undefined, undefined, biomeSize);
}

function countBiomeRuns(terrain: TerrainGen, layer: 'surface' | 'cavern' = 'surface'): number {
  const biomeAt = (x: number) => layer === 'surface'
    ? terrain.getSurfaceBiome(x, 0)
    : terrain.getCavernBiome(x, 0);
  let previous = biomeAt(-1000);
  let runs = 1;
  for (let x = -996; x <= 1000; x += 4) {
    const biome = biomeAt(x);
    if (biome === previous) continue;
    previous = biome;
    runs++;
  }
  return runs;
}

describe('surface biome scale', () => {
  it('forms broad climate regions instead of cycling every few dozen blocks', () => {
    const totalRuns = [1, 42, 123456, 0xc0ffee]
      .map((seed) => countBiomeRuns(new TerrainGen(seed)))
      .reduce((total, runs) => total + runs, 0);

    // Four 2,000-block transects should contain broad regions, not dozens of strips each.
    expect(totalRuns).toBeLessThanOrEqual(60);
  });

  it('keeps generation deterministic for each seed and preset', () => {
    for (const size of ['compact', 'standard', 'large'] as const) {
      const first = createTerrain(4242, size);
      const second = createTerrain(4242, size);
      const samples = [-800, -123, 0, 317, 999];
      expect(samples.map((x) => first.getSurfaceBiome(x, 91)))
        .toEqual(samples.map((x) => second.getSurfaceBiome(x, 91)));
      expect(samples.map((x) => first.getCavernBiome(x, -207)))
        .toEqual(samples.map((x) => second.getCavernBiome(x, -207)));
    }
  });

  it('orders transition frequency from Compact through Standard to Large', () => {
    const seeds = [1, 42, 123456, 0xc0ffee];
    const runs = (size: 'compact' | 'standard' | 'large') => seeds
      .map((seed) => countBiomeRuns(createTerrain(seed, size)))
      .reduce((total, count) => total + count, 0);

    expect(runs('compact')).toBeGreaterThan(runs('standard'));
    expect(runs('standard')).toBeGreaterThan(runs('large'));

    const cavernRuns = (size: 'compact' | 'standard' | 'large') => seeds
      .map((seed) => countBiomeRuns(createTerrain(seed, size), 'cavern'))
      .reduce((total, count) => total + count, 0);
    expect(cavernRuns('compact')).toBeGreaterThan(cavernRuns('standard'));
    expect(cavernRuns('standard')).toBeGreaterThan(cavernRuns('large'));
  });
});
