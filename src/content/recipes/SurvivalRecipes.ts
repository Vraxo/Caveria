import { ItemId } from '../../items/ItemTypes';
import { CraftingRecipe } from './RecipeTypes';

const P = ItemId.OakPlanks;
const S = ItemId.Stick;
const C = ItemId.Cobblestone;
const K = ItemId.Coal;
const X = ItemId.CrystalShard;
const A = ItemId.AmethystShard;
const M = ItemId.CaveShroom;
const B = ItemId.CaveBerries;
const V = ItemId.CaveVine;
const F = ItemId.WovenFiber;
const _ = null;

export const SURVIVAL_RECIPES: ReadonlyArray<CraftingRecipe> = [
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
    name: 'Campfire',
    pattern: [
      [_, S, _],
      [S, K, S],
      [ItemId.OakLog, ItemId.OakLog, ItemId.OakLog],
    ],
    outputId: ItemId.Campfire,
    outputCount: 1,
  },
  {
    name: 'Campfire (Spruce)',
    pattern: [
      [_, S, _],
      [S, K, S],
      [ItemId.SpruceLog, ItemId.SpruceLog, ItemId.SpruceLog],
    ],
    outputId: ItemId.Campfire,
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
    name: 'Fishing Rod',
    pattern: [
      [_, _, S],
      [_, S, F],
      [S, _, F],
    ],
    outputId: ItemId.FishingRod,
    outputCount: 1,
  },
  {
    name: 'Fishing Rod (Mirrored)',
    pattern: [
      [S, _, _],
      [F, S, _],
      [F, _, S],
    ],
    outputId: ItemId.FishingRod,
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
  {
    name: 'Glass Bottle',
    pattern: [
      [ItemId.Glass, _, ItemId.Glass],
      [_, ItemId.Glass, _],
    ],
    outputId: ItemId.GlassBottle,
    outputCount: 3,
  },
  {
    name: 'Cactus Water',
    pattern: [[ItemId.CactusGreen], [ItemId.GlassBottle]],
    outputId: ItemId.CleanWaterBottle,
    outputCount: 1,
  },
  {
    name: 'Healing Poultice',
    pattern: [[F], [M]],
    outputId: ItemId.HealingPoultice,
    outputCount: 1,
  },
  {
    name: 'Antidote',
    pattern: [[B, ItemId.CactusGreen, M]],
    outputId: ItemId.Antidote,
    outputCount: 1,
  },
  {
    name: 'Warming Stew',
    pattern: [
      [ItemId.RoastedCaveShroom, ItemId.DriedCaveBerries],
      [ItemId.DriedCaveBerries, ItemId.RoastedCaveShroom],
    ],
    outputId: ItemId.WarmingStew,
    outputCount: 1,
  },
  {
    name: 'Crystal Tonic',
    pattern: [[A], [ItemId.DriedCaveBerries], [M]],
    outputId: ItemId.CrystalTonic,
    outputCount: 1,
  },
  {
    name: 'Azure Crystal Tonic',
    pattern: [[X], [ItemId.DriedCaveBerries], [M]],
    outputId: ItemId.CrystalTonic,
    outputCount: 1,
  },
  {
    name: 'Crystal Fish Tonic',
    pattern: [[ItemId.CrystalFish], [ItemId.CleanWaterBottle]],
    outputId: ItemId.CrystalFishTonic,
    outputCount: 1,
  },
  {
    name: 'Purified Crystal Tonic',
    pattern: [
      [A, ItemId.CleanWaterBottle],
      [ItemId.DriedCaveBerries, M],
    ],
    outputId: ItemId.PurifiedCrystalTonic,
    outputCount: 1,
  },
  {
    name: 'Purified Azure Tonic',
    pattern: [
      [X, ItemId.CleanWaterBottle],
      [ItemId.DriedCaveBerries, M],
    ],
    outputId: ItemId.PurifiedCrystalTonic,
    outputCount: 1,
  },

];
