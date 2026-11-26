import { ItemId, ItemStack, createStack } from './Item';

export interface CraftingRecipe {
  name: string;
  /** Shaped pattern trimmed to minimal bounding box (rows of columns, null = empty) */
  pattern: ReadonlyArray<ReadonlyArray<ItemId | null>>;
  outputId: ItemId;
  outputCount: number;
}

const P = ItemId.OakPlanks;
const S = ItemId.Stick;
const C = ItemId.Cobblestone;
const D = ItemId.DeepSlate;
const K = ItemId.Coal;
const X = ItemId.CrystalShard;
const A = ItemId.AmethystShard;
const M = ItemId.CaveShroom;
const B = ItemId.CaveBerries;
const H = ItemId.CaveChitin;
const G = ItemId.GoldIngot;
const V = ItemId.CaveVine;
const F = ItemId.WovenFiber;
const _ = null;

export const RECIPES: ReadonlyArray<CraftingRecipe> = [
  // 1x1: Oak or Spruce Log -> 4 Planks
  {
    name: 'Oak Planks',
    pattern: [[ItemId.OakLog]],
    outputId: ItemId.OakPlanks,
    outputCount: 4,
  },
  {
    name: 'Planks (Spruce)',
    pattern: [[ItemId.SpruceLog]],
    outputId: ItemId.OakPlanks,
    outputCount: 4,
  },
  // 1x2: 2 Planks vertically -> 4 Sticks
  {
    name: 'Sticks',
    pattern: [[P], [P]],
    outputId: ItemId.Stick,
    outputCount: 4,
  },
  // 2x2: 4 Planks -> Crafting Table
  {
    name: 'Crafting Table',
    pattern: [
      [P, P],
      [P, P],
    ],
    outputId: ItemId.CraftingTable,
    outputCount: 1,
  },
  {
    name: 'Woven Fiber',
    pattern: [
      [V, V],
      [V, V],
    ],
    outputId: ItemId.WovenFiber,
    outputCount: 4,
  },
  {
    name: 'Bed',
    pattern: [
      [F, F, F],
      [P, P, P],
    ],
    outputId: ItemId.Bed,
    outputCount: 1,
  },
  {
    name: 'Chest',
    pattern: [
      [P, P, P],
      [P, _, P],
      [P, P, P],
    ],
    outputId: ItemId.Chest,
    outputCount: 1,
  },
  {
    name: 'Bow',
    pattern: [
      [_, S, F],
      [S, _, F],
      [_, S, F],
    ],
    outputId: ItemId.Bow,
    outputCount: 1,
  },
  {
    name: 'Bow (Mirrored)',
    pattern: [
      [F, S, _],
      [F, _, S],
      [F, S, _],
    ],
    outputId: ItemId.Bow,
    outputCount: 1,
  },
  {
    name: 'Amethyst Arrows',
    pattern: [[A], [S], [F]],
    outputId: ItemId.Arrow,
    outputCount: 4,
  },
  {
    name: 'Repair Bow',
    pattern: [[ItemId.Bow], [F]],
    outputId: ItemId.Bow,
    outputCount: 1,
  },
  // 3x3: Cobblestone ring -> Furnace
  {
    name: 'Furnace',
    pattern: [
      [C, C, C],
      [C, _, C],
      [C, C, C],
    ],
    outputId: ItemId.Furnace,
    outputCount: 1,
  },
  // 1x2: Coal over Stick -> 4 Torches
  {
    name: 'Torches (Coal)',
    pattern: [[K], [S]],
    outputId: ItemId.Torch,
    outputCount: 4,
  },
  // 1x2: Crystal Shard over Stick -> 6 Torches
  {
    name: 'Torches (Crystal)',
    pattern: [[X], [S]],
    outputId: ItemId.Torch,
    outputCount: 6,
  },
  // 2x2: 4 Crystal Shards -> 1 Azure Crystal Block
  {
    name: 'Azure Crystal',
    pattern: [
      [X, X],
      [X, X],
    ],
    outputId: ItemId.GlowCrystal,
    outputCount: 1,
  },
  // 2x2: 4 Amethyst Shards -> 1 Amethyst Geode Block
  {
    name: 'Amethyst Geode',
    pattern: [
      [A, A],
      [A, A],
    ],
    outputId: ItemId.AmethystCrystal,
    outputCount: 1,
  },
  // 1x2: Amethyst Shard over Stick -> 6 Torches
  {
    name: 'Torches (Amethyst)',
    pattern: [[A], [S]],
    outputId: ItemId.Torch,
    outputCount: 6,
  },
  // 2x2: 4 Sand -> 1 Sandstone
  {
    name: 'Sandstone',
    pattern: [
      [ItemId.Sand, ItemId.Sand],
      [ItemId.Sand, ItemId.Sand],
    ],
    outputId: ItemId.Sandstone,
    outputCount: 1,
  },
  {
    name: 'Cave Stew',
    pattern: [
      [M, B],
      [B, M],
    ],
    outputId: ItemId.CaveStew,
    outputCount: 1,
  },

  // --- 3x3 Crafting Table Equipment Recipes ---

  {
    name: 'Chitin Helmet',
    pattern: [
      [H, H, H],
      [H, _, H],
    ],
    outputId: ItemId.ChitinHelmet,
    outputCount: 1,
  },
  {
    name: 'Chitin Chestplate',
    pattern: [
      [H, _, H],
      [H, H, H],
      [H, H, H],
    ],
    outputId: ItemId.ChitinChestplate,
    outputCount: 1,
  },
  {
    name: 'Chitin Leggings',
    pattern: [
      [H, H, H],
      [H, _, H],
      [H, _, H],
    ],
    outputId: ItemId.ChitinLeggings,
    outputCount: 1,
  },
  {
    name: 'Chitin Boots',
    pattern: [
      [H, _, H],
      [H, _, H],
    ],
    outputId: ItemId.ChitinBoots,
    outputCount: 1,
  },
  {
    name: 'Repair Chitin Helmet',
    pattern: [[ItemId.ChitinHelmet], [H]],
    outputId: ItemId.ChitinHelmet,
    outputCount: 1,
  },
  {
    name: 'Repair Chitin Chestplate',
    pattern: [[ItemId.ChitinChestplate], [H]],
    outputId: ItemId.ChitinChestplate,
    outputCount: 1,
  },
  {
    name: 'Repair Chitin Leggings',
    pattern: [[ItemId.ChitinLeggings], [H]],
    outputId: ItemId.ChitinLeggings,
    outputCount: 1,
  },
  {
    name: 'Repair Chitin Boots',
    pattern: [[ItemId.ChitinBoots], [H]],
    outputId: ItemId.ChitinBoots,
    outputCount: 1,
  },
  {
    name: 'Gold Helmet',
    pattern: [
      [G, G, G],
      [G, _, G],
    ],
    outputId: ItemId.GoldHelmet,
    outputCount: 1,
  },
  {
    name: 'Gold Chestplate',
    pattern: [
      [G, _, G],
      [G, G, G],
      [G, G, G],
    ],
    outputId: ItemId.GoldChestplate,
    outputCount: 1,
  },
  {
    name: 'Gold Leggings',
    pattern: [
      [G, G, G],
      [G, _, G],
      [G, _, G],
    ],
    outputId: ItemId.GoldLeggings,
    outputCount: 1,
  },
  {
    name: 'Gold Boots',
    pattern: [
      [G, _, G],
      [G, _, G],
    ],
    outputId: ItemId.GoldBoots,
    outputCount: 1,
  },
  {
    name: 'Repair Gold Helmet',
    pattern: [[ItemId.GoldHelmet], [G]],
    outputId: ItemId.GoldHelmet,
    outputCount: 1,
  },
  {
    name: 'Repair Gold Chestplate',
    pattern: [[ItemId.GoldChestplate], [G]],
    outputId: ItemId.GoldChestplate,
    outputCount: 1,
  },
  {
    name: 'Repair Gold Leggings',
    pattern: [[ItemId.GoldLeggings], [G]],
    outputId: ItemId.GoldLeggings,
    outputCount: 1,
  },
  {
    name: 'Repair Gold Boots',
    pattern: [[ItemId.GoldBoots], [G]],
    outputId: ItemId.GoldBoots,
    outputCount: 1,
  },

  // Wooden Tools
  {
    name: 'Wooden Pickaxe',
    pattern: [
      [P, P, P],
      [_, S, _],
      [_, S, _],
    ],
    outputId: ItemId.WoodenPickaxe,
    outputCount: 1,
  },
  {
    name: 'Wooden Axe',
    pattern: [
      [P, P],
      [P, S],
      [_, S],
    ],
    outputId: ItemId.WoodenAxe,
    outputCount: 1,
  },
  {
    name: 'Wooden Axe (Mirrored)',
    pattern: [
      [P, P],
      [S, P],
      [S, _],
    ],
    outputId: ItemId.WoodenAxe,
    outputCount: 1,
  },
  {
    name: 'Wooden Shovel',
    pattern: [[P], [S], [S]],
    outputId: ItemId.WoodenShovel,
    outputCount: 1,
  },
  {
    name: 'Wooden Sword',
    pattern: [[P], [P], [S]],
    outputId: ItemId.WoodenSword,
    outputCount: 1,
  },

  // Stone Tools
  {
    name: 'Stone Pickaxe',
    pattern: [
      [C, C, C],
      [_, S, _],
      [_, S, _],
    ],
    outputId: ItemId.StonePickaxe,
    outputCount: 1,
  },
  {
    name: 'Stone Axe',
    pattern: [
      [C, C],
      [C, S],
      [_, S],
    ],
    outputId: ItemId.StoneAxe,
    outputCount: 1,
  },
  {
    name: 'Stone Axe (Mirrored)',
    pattern: [
      [C, C],
      [S, C],
      [S, _],
    ],
    outputId: ItemId.StoneAxe,
    outputCount: 1,
  },
  {
    name: 'Stone Shovel',
    pattern: [[C], [S], [S]],
    outputId: ItemId.StoneShovel,
    outputCount: 1,
  },
  {
    name: 'Stone Sword',
    pattern: [[C], [C], [S]],
    outputId: ItemId.StoneSword,
    outputCount: 1,
  },

  // Deepslate Pickaxe -> Stone Pickaxe
  {
    name: 'Stone Pickaxe (Deepslate)',
    pattern: [
      [D, D, D],
      [_, S, _],
      [_, S, _],
    ],
    outputId: ItemId.StonePickaxe,
    outputCount: 1,
  },

  // Gold equipment: fast tier-3 tools with moderate durability.
  {
    name: 'Gold Pickaxe',
    pattern: [
      [G, G, G],
      [_, S, _],
      [_, S, _],
    ],
    outputId: ItemId.GoldPickaxe,
    outputCount: 1,
  },
  {
    name: 'Gold Axe',
    pattern: [
      [G, G],
      [G, S],
      [_, S],
    ],
    outputId: ItemId.GoldAxe,
    outputCount: 1,
  },
  {
    name: 'Gold Axe (Mirrored)',
    pattern: [
      [G, G],
      [S, G],
      [S, _],
    ],
    outputId: ItemId.GoldAxe,
    outputCount: 1,
  },
  {
    name: 'Gold Shovel',
    pattern: [[G], [S], [S]],
    outputId: ItemId.GoldShovel,
    outputCount: 1,
  },
  {
    name: 'Gold Sword',
    pattern: [[G], [G], [S]],
    outputId: ItemId.GoldSword,
    outputCount: 1,
  },

  // Crystal Pickaxe (Caveria tier-3 — Azure or Amethyst Shards!)
  {
    name: 'Crystal Pickaxe',
    pattern: [
      [X, X, X],
      [_, S, _],
      [_, S, _],
    ],
    outputId: ItemId.CrystalPickaxe,
    outputCount: 1,
  },
  {
    name: 'Crystal Pickaxe (Amethyst)',
    pattern: [
      [A, A, A],
      [_, S, _],
      [_, S, _],
    ],
    outputId: ItemId.CrystalPickaxe,
    outputCount: 1,
  },
  {
    name: 'Crystal Sword',
    pattern: [[X], [X], [S]],
    outputId: ItemId.CrystalSword,
    outputCount: 1,
  },
  {
    name: 'Crystal Sword (Amethyst)',
    pattern: [[A], [A], [S]],
    outputId: ItemId.CrystalSword,
    outputCount: 1,
  },
];

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
