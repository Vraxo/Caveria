import { describe, expect, it } from 'vitest';
import { TerrainGen } from '../../src/world/TerrainGen';

function countBiomeRuns(terrain: TerrainGen): number {
  let previous = terrain.getSurfaceBiome(-1000, 0);
  let runs = 1;
  for (let x = -996; x <= 1000; x += 4) {
    const biome = terrain.getSurfaceBiome(x, 0);
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
});
