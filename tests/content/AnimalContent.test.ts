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
    expect(ItemId.RawRabbit).toBe(195);
    expect(ItemId.CookedRabbit).toBe(196);
    expect(getFoodStats(createStack(ItemId.CookedChicken))).toEqual({
      nutrition: 6,
      saturation: 5,
    });
    expect(getFoodStats(createStack(ItemId.CookedMutton))).toEqual({
      nutrition: 8,
      saturation: 7,
    });
    expect(getFoodStats(createStack(ItemId.CookedRabbit))).toEqual({
      nutrition: 7,
      saturation: 6,
    });
  });

  it('registers passive surface animals and poisonous desert threats', () => {
    for (const species of ['chicken', 'sheep', 'rabbit', 'camel', 'lizard', 'vulture']) {
      expect(MOB_DEFINITIONS[species].tags).toEqual(
        expect.arrayContaining(['passive', 'animal', 'surface'])
      );
    }
    for (const species of ['scorpion', 'snake']) {
      expect(MOB_DEFINITIONS[species].tags).toEqual(
        expect.arrayContaining(['hostile', 'animal', 'surface', 'poisonous'])
      );
    }
  });

  it('provides deterministic meat and resource drops', () => {
    const chicken = rollMobLoot('chicken', () => 0.9);
    const sheep = rollMobLoot('sheep', () => 0.9);
    const rabbit = rollMobLoot('rabbit', () => 0.9);
    const scorpion = rollMobLoot('scorpion', () => 0);
    const vulture = rollMobLoot('vulture', () => 0.9);

    expect(chicken.map((stack) => stack.id)).toEqual([
      ItemId.RawChicken,
      ItemId.Feather,
    ]);
    expect(sheep.map((stack) => stack.id)).toEqual([
      ItemId.RawMutton,
      ItemId.Wool,
    ]);
    expect(rabbit).toEqual([createStack(ItemId.RawRabbit)]);
    expect(scorpion).toEqual([createStack(ItemId.CaveChitin)]);
    expect(vulture).toEqual([createStack(ItemId.Feather)]);
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
    expect(getCookingRecipe(createStack(ItemId.RawRabbit), false)?.output)
      .toBe(ItemId.CookedRabbit);
    expect(getCookingRecipe(createStack(ItemId.RawRabbit), true)?.output)
      .toBe(ItemId.CookedRabbit);
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
