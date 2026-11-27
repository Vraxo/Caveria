import { describe, expect, it } from 'vitest';
import { MOB_DEFINITIONS } from '../../src/content/mobs/MobDefinitions';
import { rollMobLoot } from '../../src/content/loot/MobLoot';
import { getCookingRecipe } from '../../src/content/recipes/CookingRecipes';
import { matchCraftingGrid } from '../../src/items/Crafting';
import { createStack, getFoodStats, ItemId } from '../../src/items/Item';

describe('animal content', () => {
  it('keeps stable animal item IDs and food values', () => {
    expect(ItemId.RawChicken).toBe(186);
    expect(ItemId.CookedChicken).toBe(187);
    expect(ItemId.Feather).toBe(188);
    expect(ItemId.RawMutton).toBe(189);
    expect(ItemId.CookedMutton).toBe(190);
    expect(ItemId.Wool).toBe(191);
    expect(ItemId.Shears).toBe(192);
    expect(ItemId.Egg).toBe(193);
    expect(ItemId.CookedEgg).toBe(194);
    expect(getFoodStats(createStack(ItemId.CookedChicken))).toEqual({
      nutrition: 6,
      saturation: 5,
    });
    expect(getFoodStats(createStack(ItemId.CookedMutton))).toEqual({
      nutrition: 8,
      saturation: 7,
    });
  });

  it('registers Chickens and Sheep as passive surface animals', () => {
    expect(MOB_DEFINITIONS.chicken.tags).toEqual(
      expect.arrayContaining(['passive', 'animal', 'surface'])
    );
    expect(MOB_DEFINITIONS.sheep.tags).toEqual(
      expect.arrayContaining(['passive', 'animal', 'surface'])
    );
  });

  it('provides deterministic meat and resource drops', () => {
    const chicken = rollMobLoot('chicken', () => 0.9);
    const sheep = rollMobLoot('sheep', () => 0.9);

    expect(chicken.map((stack) => stack.id)).toEqual([
      ItemId.RawChicken,
      ItemId.Feather,
    ]);
    expect(sheep.map((stack) => stack.id)).toEqual([
      ItemId.RawMutton,
      ItemId.Wool,
    ]);
  });

  it('cooks meat in Furnaces and Campfires', () => {
    expect(getCookingRecipe(createStack(ItemId.RawChicken), false)?.output)
      .toBe(ItemId.CookedChicken);
    expect(getCookingRecipe(createStack(ItemId.RawChicken), true)?.output)
      .toBe(ItemId.CookedChicken);
    expect(getCookingRecipe(createStack(ItemId.RawMutton), false)?.output)
      .toBe(ItemId.CookedMutton);
    expect(getCookingRecipe(createStack(ItemId.RawMutton), true)?.output)
      .toBe(ItemId.CookedMutton);
    expect(getCookingRecipe(createStack(ItemId.Egg), false)?.output)
      .toBe(ItemId.CookedEgg);
  });

  it('uses Wool for fiber and Feathers for arrows', () => {
    const fiber = matchCraftingGrid([
      createStack(ItemId.Wool), null,
      null, null,
    ], 2);
    const shears = matchCraftingGrid([
      null, createStack(ItemId.GoldIngot),
      createStack(ItemId.GoldIngot), null,
    ], 2);
    const arrows = matchCraftingGrid([
      createStack(ItemId.AmethystShard), null, null,
      createStack(ItemId.Stick), null, null,
      createStack(ItemId.Feather), null, null,
    ], 3);

    expect(fiber).toMatchObject({ id: ItemId.WovenFiber, count: 2 });
    expect(shears).toMatchObject({ id: ItemId.Shears, count: 1 });
    expect(arrows).toMatchObject({ id: ItemId.Arrow, count: 4 });
  });
});
