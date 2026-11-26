import { CraftingRecipe } from './RecipeTypes';
import { EQUIPMENT_RECIPES } from './EquipmentRecipes';
import { SURVIVAL_RECIPES } from './SurvivalRecipes';

function buildRecipeRegistry(...groups: ReadonlyArray<ReadonlyArray<CraftingRecipe>>): ReadonlyArray<CraftingRecipe> {
  const recipes = groups.flat();
  const names = new Set<string>();
  for (const recipe of recipes) {
    if (names.has(recipe.name)) throw new Error(`Duplicate crafting recipe name: ${recipe.name}`);
    names.add(recipe.name);
    if (recipe.outputCount <= 0) throw new Error(`Invalid output count for ${recipe.name}`);
    if (recipe.pattern.length < 1 || recipe.pattern.length > 3) throw new Error(`Invalid recipe height for ${recipe.name}`);
    if (recipe.pattern.some((row) => row.length !== recipe.pattern[0].length || row.length < 1 || row.length > 3)) {
      throw new Error(`Invalid recipe width for ${recipe.name}`);
    }
  }
  return recipes;
}

export const RECIPES = buildRecipeRegistry(SURVIVAL_RECIPES, EQUIPMENT_RECIPES);
