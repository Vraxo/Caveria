import { RECIPES } from '../content/recipes/CraftingRecipeRegistry';
import { ItemStack, createStack } from './Item';

export { RECIPES } from '../content/recipes/CraftingRecipeRegistry';
export type { CraftingRecipe } from '../content/recipes/RecipeTypes';


/**
 * Matches a flat `gridSize x gridSize` crafting grid (`gridSize` = 2 or 3) against all shaped recipes
 * by trimming empty outer rows/columns so 1x1 or 1x2 recipes work in any position!
 */
export function matchCraftingGrid(
  grid: ReadonlyArray<ItemStack | null>,
  gridSize: 2 | 3
): ItemStack | null {
  let minR: number = gridSize;
  let maxR = -1;
  let minC: number = gridSize;
  let maxC = -1;

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const cell = grid[r * gridSize + c];
      if (cell && cell.count > 0) {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
  }

  if (maxR === -1) return null; // Grid is completely empty

  const height = maxR - minR + 1;
  const width = maxC - minC + 1;

  for (const recipe of RECIPES) {
    if (recipe.pattern.length !== height) continue;
    if (recipe.pattern[0].length !== width) continue;

    let matches = true;
    for (let r = 0; r < height && matches; r++) {
      for (let c = 0; c < width; c++) {
        const expected = recipe.pattern[r][c];
        const actualStack = grid[(minR + r) * gridSize + (minC + c)];
        const actualId = actualStack && actualStack.count > 0 ? actualStack.id : null;
        if (actualId !== expected) {
          matches = false;
          break;
        }
      }
    }

    if (matches) {
      return createStack(recipe.outputId, recipe.outputCount);
    }
  }

  return null;
}
