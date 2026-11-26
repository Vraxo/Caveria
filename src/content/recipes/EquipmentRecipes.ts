import { ItemId } from '../../items/ItemTypes';
import { CraftingRecipe } from './RecipeTypes';

const P = ItemId.OakPlanks;
const S = ItemId.Stick;
const C = ItemId.Cobblestone;
const D = ItemId.DeepSlate;
const X = ItemId.CrystalShard;
const A = ItemId.AmethystShard;
const H = ItemId.CaveChitin;
const G = ItemId.GoldIngot;
const _ = null;

export const EQUIPMENT_RECIPES: ReadonlyArray<CraftingRecipe> = [

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
    name: 'Wooden Hoe',
    pattern: [
      [P, P],
      [_, S],
      [_, S],
    ],
    outputId: ItemId.WoodenHoe,
    outputCount: 1,
  },
  {
    name: 'Wooden Hoe (Mirrored)',
    pattern: [
      [P, P],
      [S, _],
      [S, _],
    ],
    outputId: ItemId.WoodenHoe,
    outputCount: 1,
  },
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
  },];
