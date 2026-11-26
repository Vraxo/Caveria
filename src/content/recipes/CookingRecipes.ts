import { ItemId, ItemStack } from '../../items/ItemTypes';

export interface FurnaceRecipe {
  output: ItemId;
  count: number;
  seconds: number;
}

interface CookingRecipeDefinition extends FurnaceRecipe {
  input: ItemId;
  campfire?: FurnaceRecipe;
}

export const COOKING_RECIPES: ReadonlyArray<CookingRecipeDefinition> = [
  { input: ItemId.GoldOre, output: ItemId.GoldIngot, count: 1, seconds: 8 },
  { input: ItemId.Sand, output: ItemId.Glass, count: 1, seconds: 6 },
  {
    input: ItemId.CaveShroom,
    output: ItemId.RoastedCaveShroom,
    count: 1,
    seconds: 5,
    campfire: { output: ItemId.SmokedCaveShroom, count: 1, seconds: 6 },
  },
  {
    input: ItemId.CaveBerries,
    output: ItemId.DriedCaveBerries,
    count: 1,
    seconds: 4,
    campfire: { output: ItemId.DriedCaveBerries, count: 1, seconds: 4 },
  },
  {
    input: ItemId.DirtyWaterBottle,
    output: ItemId.CleanWaterBottle,
    count: 1,
    seconds: 6,
    campfire: { output: ItemId.CleanWaterBottle, count: 1, seconds: 10 },
  },
  {
    input: ItemId.RawCaveFish,
    output: ItemId.CookedCaveFish,
    count: 1,
    seconds: 5,
    campfire: { output: ItemId.CookedCaveFish, count: 1, seconds: 8 },
  },
  {
    input: ItemId.RawRiverFish,
    output: ItemId.CookedRiverFish,
    count: 1,
    seconds: 5,
    campfire: { output: ItemId.CookedRiverFish, count: 1, seconds: 8 },
  },
  {
    input: ItemId.BlightedFish,
    output: ItemId.CookedCaveFish,
    count: 1,
    seconds: 8,
    campfire: { output: ItemId.CookedCaveFish, count: 1, seconds: 12 },
  },
  { input: ItemId.Cactus, output: ItemId.CactusGreen, count: 1, seconds: 6 },
];

export const FURNACE_RECIPES: Readonly<Partial<Record<ItemId, FurnaceRecipe>>> = Object.fromEntries(
  COOKING_RECIPES.map(({ input, output, count, seconds }) => [input, { output, count, seconds }])
);

export const FURNACE_FUELS: Readonly<Partial<Record<ItemId, number>>> = {
  [ItemId.Coal]: 80,
  [ItemId.OakLog]: 15,
  [ItemId.SpruceLog]: 15,
  [ItemId.OakPlanks]: 15,
  [ItemId.Stick]: 5,
  [ItemId.Torch]: 8,
};

const COOKING_BY_INPUT = new Map(COOKING_RECIPES.map((recipe) => [recipe.input, recipe]));

export function getFurnaceRecipe(stack: ItemStack | null): FurnaceRecipe | null {
  return getCookingRecipe(stack, false);
}

export function getCookingRecipe(stack: ItemStack | null, campfire: boolean): FurnaceRecipe | null {
  if (!stack) return null;
  const definition = COOKING_BY_INPUT.get(stack.id);
  if (!definition) return null;
  if (campfire) return definition.campfire ?? null;
  return { output: definition.output, count: definition.count, seconds: definition.seconds };
}

export function getFuelSeconds(stack: ItemStack | null): number {
  return stack ? (FURNACE_FUELS[stack.id] ?? 0) : 0;
}
