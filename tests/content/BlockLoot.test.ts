import { describe, expect, it } from 'vitest';
import { BlockId } from '../../src/content/BlockId';
import { BLOCKS } from '../../src/content/BlockRegistry';
import { rollBlockLoot } from '../../src/content/loot/BlockLoot';
import { ItemId, getBlockDrop, getBlockDrops } from '../../src/items/Item';

function sequence(...values: number[]): () => number {
  return () => {
    const value = values.shift();
    if (value === undefined) throw new Error('Deterministic random sequence exhausted');
    return value;
  };
}

describe('block loot tables', () => {
  it('declares fixed, transformed, and no-drop outcomes in block definitions', () => {
    expect(getBlockDrop(BlockId.Dirt)).toMatchObject({ id: ItemId.Dirt, count: 1 });
    expect(getBlockDrop(BlockId.Grass)).toMatchObject({ id: ItemId.Dirt, count: 1 });
    expect(getBlockDrop(BlockId.Stone)).toMatchObject({ id: ItemId.Cobblestone, count: 1 });
    expect(getBlockDrop(BlockId.CoalOre)).toMatchObject({ id: ItemId.Coal, count: 1 });
    expect(getBlockDrop(BlockId.GlowCrystal)).toMatchObject({ id: ItemId.CrystalShard, count: 2 });
    expect(getBlockDrop(BlockId.LitFurnace)).toMatchObject({ id: ItemId.Furnace, count: 1 });
    expect(getBlockDrop(BlockId.LitCampfire)).toMatchObject({ id: ItemId.Campfire, count: 1 });
    expect(getBlockDrops(BlockId.Glass)).toEqual([]);
    expect(getBlockDrops(BlockId.BerryBushMature)).toEqual([]);
    expect(BLOCKS[BlockId.Stone].lootTable).toBeDefined();
  });

  it('rolls weighted leaf outcomes and variable counts deterministically', () => {
    expect(getBlockDrops(BlockId.OakLeaves, 'mined', sequence(0.1, 0.2)))
      .toEqual([{ id: ItemId.CaveBerries, count: 2 }]);
    expect(getBlockDrops(BlockId.OakLeaves, 'mined', sequence(0.2)))
      .toEqual([{ id: ItemId.Stick, count: 1 }]);
    expect(getBlockDrops(BlockId.SpruceLeaves, 'mined', sequence(0.42))).toEqual([]);
  });

  it('uses a support-loss override instead of randomized mined loot', () => {
    expect(getBlockDrops(BlockId.CaveVine, 'mined', sequence(0.1, 0.9)))
      .toEqual([{ id: ItemId.CaveBerries, count: 1 }]);
    expect(getBlockDrops(BlockId.CaveVine, 'support-loss', sequence(0.1)))
      .toEqual([{ id: ItemId.CaveVine, count: 1 }]);
  });

  it('supports multiple independent pools and therefore multiple stacks', () => {
    const drops = rollBlockLoot([
      { entries: [{ item: ItemId.Stick, weight: 1 }] },
      { entries: [{ item: ItemId.Coal, weight: 1, minimum: 2, maximum: 2 }] },
    ], sequence(0, 0));

    expect(drops).toEqual([
      { id: ItemId.Stick, count: 1 },
      { id: ItemId.Coal, count: 2 },
    ]);
  });
});
