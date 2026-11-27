import { describe, expect, it, vi } from 'vitest';
import { AudioManager } from '../../src/audio/AudioManager';
import { BlockId } from '../../src/content/BlockId';
import {
  CROP_DEFINITIONS,
  getCropDefinition,
  getCropForBlock,
  getCropForSeed,
} from '../../src/content/crops/CropDefinitions';
import { FarmingManager } from '../../src/gameplay/FarmingManager';
import { ItemId, ItemStack } from '../../src/items/Item';
import { Player } from '../../src/player/Player';
import { WeatherSystem } from '../../src/rendering/WeatherSystem';
import { World } from '../../src/world/World';

function key(x: number, y: number, z: number): string {
  return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
}

describe('crop definition registry', () => {
  it('indexes crop identity, planting items, and every growth-stage block', () => {
    expect(getCropDefinition('berries')).toBe(CROP_DEFINITIONS.berries);
    expect(getCropForSeed(ItemId.CaveBerries)?.id).toBe('berries');
    expect(getCropForSeed(ItemId.CaveShroom)?.id).toBe('shroom');
    expect(getCropForSeed(ItemId.Stick)).toBeNull();
    expect(getCropForBlock(BlockId.BerryBushMature)?.id).toBe('berries');
    expect(getCropForBlock(BlockId.ShroomGrowing)?.id).toBe('shroom');
    expect(getCropDefinition('unknown')).toBeNull();
  });

  it('drives planting, stage progression, harvest yield, and replanting', () => {
    const blocks = new Map<string, BlockId>([
      [key(0, 0, 0), BlockId.Dirt],
      [key(2, 0, 0), BlockId.Water],
    ]);
    const world = {
      getBlock: (x: number, y: number, z: number) => blocks.get(key(x, y, z)) ?? BlockId.Air,
      setBlock: (x: number, y: number, z: number, block: BlockId) => {
        if (block === BlockId.Air) blocks.delete(key(x, y, z));
        else blocks.set(key(x, y, z), block);
        return true;
      },
      getPackedLight: () => 0xff,
      isPositionLoaded: () => true,
    } as unknown as World;
    const player = {
      position: { x: 10, y: 10, z: 10 },
      velocity: { y: 0 },
    } as unknown as Player;
    const weather = { intensity: 0 } as unknown as WeatherSystem;
    const audio = { playFarmGrowth: vi.fn() } as unknown as AudioManager;
    const drops: ItemStack[] = [];
    const farms = new FarmingManager(
      world,
      player,
      weather,
      audio,
      undefined,
      (_x, _y, _z, stack) => drops.push(stack),
      () => 0
    );

    expect(farms.use(0, 0, 0, ItemId.WoodenHoe)).toBe('tilled');
    expect(farms.use(0, 0, 0, ItemId.CaveBerries)).toBe('planted');
    expect(world.getBlock(0, 1, 0)).toBe(BlockId.BerrySprout);

    farms.update(33);
    farms.update(33);
    expect(world.getBlock(0, 1, 0)).toBe(BlockId.BerryBushMature);

    expect(farms.use(0, 1, 0, null)).toBe('harvested');
    expect(drops).toEqual([{ id: ItemId.CaveBerries, count: 2 }]);
    expect(world.getBlock(0, 1, 0)).toBe(BlockId.BerrySprout);
    expect(farms.snapshots()[0]).toMatchObject({ crop: 'berries', stage: 0 });
  });
});
