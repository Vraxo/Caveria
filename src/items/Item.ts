import { BlockId } from '../content/BlockId';
import { BLOCKS } from '../content/BlockRegistry';
import { ToolCategory } from '../gameplay/MiningTypes';

/**
 * ItemId covers placeable blocks (matching BlockId 1..16) + non-block materials & tools (100+).
 */
export enum ItemId {
  // Placeable block items (identical numeric IDs to BlockId)
  Grass = BlockId.Grass,
  Dirt = BlockId.Dirt,
  Stone = BlockId.Stone,
  Cobblestone = BlockId.Cobblestone,
  Sand = BlockId.Sand,
  OakLog = BlockId.OakLog,
  OakLeaves = BlockId.OakLeaves,
  OakPlanks = BlockId.OakPlanks,
  CoalOre = BlockId.CoalOre,
  GoldOre = BlockId.GoldOre,
  Glass = BlockId.Glass,
  Torch = BlockId.Torch,
  GlowCrystal = BlockId.GlowCrystal,
  CraftingTable = BlockId.CraftingTable,
  Sandstone = BlockId.Sandstone,
  Cactus = BlockId.Cactus,
  SnowGrass = BlockId.SnowGrass,
  SnowBlock = BlockId.SnowBlock,
  SpruceLog = BlockId.SpruceLog,
  SpruceLeaves = BlockId.SpruceLeaves,
  DeepSlate = BlockId.DeepSlate,
  MossStone = BlockId.MossStone,
  AmethystCrystal = BlockId.AmethystCrystal,
  CaveShroom = BlockId.CaveShroom,
  DripstoneSpike = BlockId.DripstoneSpike,
  CaveVine = BlockId.CaveVine,
  Furnace = BlockId.Furnace,
  Bed = BlockId.BedFoot,
  Chest = BlockId.Chest,
  Campfire = BlockId.Campfire,

  // Materials
  Stick = 100,
  Coal = 101,
  CrystalShard = 102,
  AmethystShard = 103,
  CaveChitin = 104,
  CaveBerries = 105,
  RoastedCaveShroom = 106,
  CaveStew = 107,
  GoldIngot = 108,
  CactusGreen = 109,

  // Wooden Tools (tier 1)
  WoodenPickaxe = 110,
  WoodenAxe = 111,
  WoodenShovel = 112,
  WoodenSword = 113,

  // Stone Tools (tier 2)
  StonePickaxe = 120,
  StoneAxe = 121,
  StoneShovel = 122,
  StoneSword = 123,

  // Crystal Tools (tier 3 — Caveria signature!)
  CrystalPickaxe = 130,
  CrystalSword = 131,

  // Cave Chitin armor
  ChitinHelmet = 140,
  ChitinChestplate = 141,
  ChitinLeggings = 142,
  ChitinBoots = 143,

  // Gold equipment
  GoldPickaxe = 150,
  GoldAxe = 151,
  GoldShovel = 152,
  GoldSword = 153,
  GoldHelmet = 160,
  GoldChestplate = 161,
  GoldLeggings = 162,
  GoldBoots = 163,
  WovenFiber = 164,
  Bow = 165,
  Arrow = 166,
  WoodenHoe = 167,
  DriedCaveBerries = 168,
  HealingPoultice = 169,
  Antidote = 170,
  WarmingStew = 171,
  CrystalTonic = 172,
  SmokedCaveShroom = 173,
  GlassBottle = 174,
  DirtyWaterBottle = 175,
  CleanWaterBottle = 176,
  PurifiedCrystalTonic = 177,
  FishingRod = 178,
  RawCaveFish = 179,
  RawRiverFish = 180,
  CrystalFish = 181,
  CookedCaveFish = 182,
  CookedRiverFish = 183,
  CrystalFishTonic = 184,
  BlightedFish = 185,
}

export type ArmorSlot = 'helmet' | 'chestplate' | 'leggings' | 'boots';

export interface ItemDefinition {
  id: ItemId;
  name: string;
  maxStack: number;
  /** Non-null if right-clicking places a block in the world */
  placeBlockId: BlockId | null;
  toolCategory: ToolCategory;
  /** 0 = non-tool, 1 = wood, 2 = stone, 3 = crystal */
  toolTier: number;
  /** Mining speed multiplier when matching a block's preferredTool */
  miningSpeed: number;
  /** Melee damage dealt to mobs; empty hands deal 1. */
  attackDamage?: number;
  /** Hunger points and saturation restored when eaten. */
  nutrition?: number;
  saturation?: number;
  armorSlot?: ArmorSlot;
  armorPoints?: number;
  maxDurability?: number;
}

export interface ItemStack {
  id: ItemId;
  count: number;
  durability?: number;
}

function blockItem(blockId: BlockId): ItemDefinition {
  return {
    id: blockId as unknown as ItemId,
    name: BLOCKS[blockId].name,
    maxStack: 64,
    placeBlockId: blockId,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1.0,
  };
}

export const ITEMS: Record<number, ItemDefinition> = {
  [ItemId.Grass]: blockItem(BlockId.Grass),
  [ItemId.Dirt]: blockItem(BlockId.Dirt),
  [ItemId.Stone]: blockItem(BlockId.Stone),
  [ItemId.Cobblestone]: blockItem(BlockId.Cobblestone),
  [ItemId.Sand]: blockItem(BlockId.Sand),
  [ItemId.OakLog]: blockItem(BlockId.OakLog),
  [ItemId.OakLeaves]: blockItem(BlockId.OakLeaves),
  [ItemId.OakPlanks]: blockItem(BlockId.OakPlanks),
  [ItemId.CoalOre]: blockItem(BlockId.CoalOre),
  [ItemId.GoldOre]: blockItem(BlockId.GoldOre),
  [ItemId.Glass]: blockItem(BlockId.Glass),
  [ItemId.Torch]: blockItem(BlockId.Torch),
  [ItemId.GlowCrystal]: blockItem(BlockId.GlowCrystal),
  [ItemId.CraftingTable]: blockItem(BlockId.CraftingTable),
  [ItemId.Sandstone]: blockItem(BlockId.Sandstone),
  [ItemId.Cactus]: blockItem(BlockId.Cactus),
  [ItemId.SnowGrass]: blockItem(BlockId.SnowGrass),
  [ItemId.SnowBlock]: blockItem(BlockId.SnowBlock),
  [ItemId.SpruceLog]: blockItem(BlockId.SpruceLog),
  [ItemId.SpruceLeaves]: blockItem(BlockId.SpruceLeaves),
  [ItemId.DeepSlate]: blockItem(BlockId.DeepSlate),
  [ItemId.MossStone]: blockItem(BlockId.MossStone),
  [ItemId.AmethystCrystal]: blockItem(BlockId.AmethystCrystal),
  [ItemId.CaveShroom]: {
    ...blockItem(BlockId.CaveShroom),
    nutrition: 2,
    saturation: 0.8,
  },
  [ItemId.DripstoneSpike]: blockItem(BlockId.DripstoneSpike),
  [ItemId.CaveVine]: blockItem(BlockId.CaveVine),
  [ItemId.Furnace]: blockItem(BlockId.Furnace),
  [ItemId.Bed]: blockItem(BlockId.BedFoot),
  [ItemId.Chest]: blockItem(BlockId.Chest),
  [ItemId.Campfire]: blockItem(BlockId.Campfire),

  [ItemId.Stick]: {
    id: ItemId.Stick,
    name: 'Stick',
    maxStack: 64,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1.0,
  },
  [ItemId.Coal]: {
    id: ItemId.Coal,
    name: 'Coal',
    maxStack: 64,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1.0,
  },
  [ItemId.CrystalShard]: {
    id: ItemId.CrystalShard,
    name: 'Azure Shard',
    maxStack: 64,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1.0,
  },
  [ItemId.AmethystShard]: {
    id: ItemId.AmethystShard,
    name: 'Amethyst Shard',
    maxStack: 64,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1.0,
  },
  [ItemId.CaveChitin]: {
    id: ItemId.CaveChitin,
    name: 'Cave Chitin',
    maxStack: 64,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1.0,
  },
  [ItemId.CaveBerries]: {
    id: ItemId.CaveBerries,
    name: 'Cave Berries',
    maxStack: 64,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    nutrition: 3,
    saturation: 1.5,
  },
  [ItemId.RoastedCaveShroom]: {
    id: ItemId.RoastedCaveShroom,
    name: 'Roasted Cave Shroom',
    maxStack: 64,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    nutrition: 6,
    saturation: 5,
  },
  [ItemId.CaveStew]: {
    id: ItemId.CaveStew,
    name: 'Cave Stew',
    maxStack: 16,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    nutrition: 8,
    saturation: 8,
  },
  [ItemId.GoldIngot]: {
    id: ItemId.GoldIngot,
    name: 'Gold Ingot',
    maxStack: 64,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
  },
  [ItemId.CactusGreen]: {
    id: ItemId.CactusGreen,
    name: 'Cactus Green',
    maxStack: 64,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
  },
  [ItemId.WovenFiber]: {
    id: ItemId.WovenFiber,
    name: 'Woven Fiber',
    maxStack: 64,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
  },
  [ItemId.Bow]: {
    id: ItemId.Bow,
    name: 'Bow',
    maxStack: 1,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    maxDurability: 256,
  },
  [ItemId.Arrow]: {
    id: ItemId.Arrow,
    name: 'Amethyst Arrow',
    maxStack: 64,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
  },
  [ItemId.WoodenHoe]: {
    id: ItemId.WoodenHoe,
    name: 'Wooden Hoe',
    maxStack: 1,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 1,
    miningSpeed: 1,
    maxDurability: 128,
  },
  [ItemId.DriedCaveBerries]: {
    id: ItemId.DriedCaveBerries,
    name: 'Dried Cave Berries', maxStack: 64, placeBlockId: null,
    toolCategory: 'none', toolTier: 0, miningSpeed: 1, nutrition: 5, saturation: 3.2,
  },
  [ItemId.HealingPoultice]: {
    id: ItemId.HealingPoultice, name: 'Healing Poultice', maxStack: 16, placeBlockId: null,
    toolCategory: 'none', toolTier: 0, miningSpeed: 1,
  },
  [ItemId.Antidote]: {
    id: ItemId.Antidote, name: 'Antidote', maxStack: 16, placeBlockId: null,
    toolCategory: 'none', toolTier: 0, miningSpeed: 1,
  },
  [ItemId.WarmingStew]: {
    id: ItemId.WarmingStew, name: 'Warming Stew', maxStack: 16, placeBlockId: null,
    toolCategory: 'none', toolTier: 0, miningSpeed: 1,
  },
  [ItemId.CrystalTonic]: {
    id: ItemId.CrystalTonic, name: 'Crystal Tonic', maxStack: 8, placeBlockId: null,
    toolCategory: 'none', toolTier: 0, miningSpeed: 1,
  },
  [ItemId.SmokedCaveShroom]: {
    id: ItemId.SmokedCaveShroom, name: 'Smoked Cave Shroom', maxStack: 64, placeBlockId: null,
    toolCategory: 'none', toolTier: 0, miningSpeed: 1, nutrition: 5, saturation: 4,
  },
  [ItemId.GlassBottle]: {
    id: ItemId.GlassBottle, name: 'Glass Bottle', maxStack: 16, placeBlockId: null,
    toolCategory: 'none', toolTier: 0, miningSpeed: 1,
  },
  [ItemId.DirtyWaterBottle]: {
    id: ItemId.DirtyWaterBottle, name: 'Dirty Water Bottle', maxStack: 16, placeBlockId: null,
    toolCategory: 'none', toolTier: 0, miningSpeed: 1,
  },
  [ItemId.CleanWaterBottle]: {
    id: ItemId.CleanWaterBottle, name: 'Clean Water Bottle', maxStack: 16, placeBlockId: null,
    toolCategory: 'none', toolTier: 0, miningSpeed: 1,
  },
  [ItemId.PurifiedCrystalTonic]: {
    id: ItemId.PurifiedCrystalTonic, name: 'Purified Crystal Tonic', maxStack: 8, placeBlockId: null,
    toolCategory: 'none', toolTier: 0, miningSpeed: 1,
  },
  [ItemId.FishingRod]: {
    id: ItemId.FishingRod, name: 'Fishing Rod', maxStack: 1, placeBlockId: null,
    toolCategory: 'none', toolTier: 0, miningSpeed: 1, maxDurability: 96,
  },
  [ItemId.RawCaveFish]: {
    id: ItemId.RawCaveFish, name: 'Raw Cave Fish', maxStack: 64, placeBlockId: null,
    toolCategory: 'none', toolTier: 0, miningSpeed: 1, nutrition: 2, saturation: 0.8,
  },
  [ItemId.RawRiverFish]: {
    id: ItemId.RawRiverFish, name: 'Raw River Fish', maxStack: 64, placeBlockId: null,
    toolCategory: 'none', toolTier: 0, miningSpeed: 1, nutrition: 2, saturation: 1,
  },
  [ItemId.CrystalFish]: {
    id: ItemId.CrystalFish, name: 'Crystal Fish', maxStack: 16, placeBlockId: null,
    toolCategory: 'none', toolTier: 0, miningSpeed: 1, nutrition: 3, saturation: 2,
  },
  [ItemId.CookedCaveFish]: {
    id: ItemId.CookedCaveFish, name: 'Cooked Cave Fish', maxStack: 64, placeBlockId: null,
    toolCategory: 'none', toolTier: 0, miningSpeed: 1, nutrition: 6, saturation: 5,
  },
  [ItemId.CookedRiverFish]: {
    id: ItemId.CookedRiverFish, name: 'Cooked River Fish', maxStack: 64, placeBlockId: null,
    toolCategory: 'none', toolTier: 0, miningSpeed: 1, nutrition: 7, saturation: 6,
  },
  [ItemId.CrystalFishTonic]: {
    id: ItemId.CrystalFishTonic, name: 'Crystal Fish Tonic', maxStack: 8, placeBlockId: null,
    toolCategory: 'none', toolTier: 0, miningSpeed: 1,
  },
  [ItemId.BlightedFish]: {
    id: ItemId.BlightedFish, name: 'Blighted Fish', maxStack: 32, placeBlockId: null,
    toolCategory: 'none', toolTier: 0, miningSpeed: 1, nutrition: 1, saturation: 0,
  },

  // Wooden Tools
  [ItemId.WoodenPickaxe]: {
    id: ItemId.WoodenPickaxe,
    name: 'Wooden Pickaxe',
    maxStack: 1,
    placeBlockId: null,
    toolCategory: 'pickaxe',
    toolTier: 1,
    miningSpeed: 2.4,
    maxDurability: 60,
  },
  [ItemId.WoodenAxe]: {
    id: ItemId.WoodenAxe,
    name: 'Wooden Axe',
    maxStack: 1,
    placeBlockId: null,
    toolCategory: 'axe',
    toolTier: 1,
    miningSpeed: 2.4,
    maxDurability: 60,
  },
  [ItemId.WoodenShovel]: {
    id: ItemId.WoodenShovel,
    name: 'Wooden Shovel',
    maxStack: 1,
    placeBlockId: null,
    toolCategory: 'shovel',
    toolTier: 1,
    miningSpeed: 2.4,
    maxDurability: 60,
  },
  [ItemId.WoodenSword]: {
    id: ItemId.WoodenSword,
    name: 'Wooden Sword',
    maxStack: 1,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 1,
    miningSpeed: 1,
    attackDamage: 4,
    maxDurability: 60,
  },

  // Stone Tools
  [ItemId.StonePickaxe]: {
    id: ItemId.StonePickaxe,
    name: 'Stone Pickaxe',
    maxStack: 1,
    placeBlockId: null,
    toolCategory: 'pickaxe',
    toolTier: 2,
    miningSpeed: 4.2,
    maxDurability: 132,
  },
  [ItemId.StoneAxe]: {
    id: ItemId.StoneAxe,
    name: 'Stone Axe',
    maxStack: 1,
    placeBlockId: null,
    toolCategory: 'axe',
    toolTier: 2,
    miningSpeed: 4.2,
    maxDurability: 132,
  },
  [ItemId.StoneShovel]: {
    id: ItemId.StoneShovel,
    name: 'Stone Shovel',
    maxStack: 1,
    placeBlockId: null,
    toolCategory: 'shovel',
    toolTier: 2,
    miningSpeed: 4.2,
    maxDurability: 132,
  },
  [ItemId.StoneSword]: {
    id: ItemId.StoneSword,
    name: 'Stone Sword',
    maxStack: 1,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 2,
    miningSpeed: 1,
    attackDamage: 6,
    maxDurability: 132,
  },

  // Crystal Pickaxe
  [ItemId.CrystalPickaxe]: {
    id: ItemId.CrystalPickaxe,
    name: 'Crystal Pickaxe',
    maxStack: 1,
    placeBlockId: null,
    toolCategory: 'pickaxe',
    toolTier: 3,
    miningSpeed: 7.5,
    maxDurability: 320,
  },
  [ItemId.CrystalSword]: {
    id: ItemId.CrystalSword,
    name: 'Crystal Sword',
    maxStack: 1,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 3,
    miningSpeed: 1,
    attackDamage: 8,
    maxDurability: 320,
  },
  [ItemId.ChitinHelmet]: {
    id: ItemId.ChitinHelmet,
    name: 'Chitin Helmet',
    maxStack: 1,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    armorSlot: 'helmet',
    armorPoints: 2,
    maxDurability: 90,
  },
  [ItemId.ChitinChestplate]: {
    id: ItemId.ChitinChestplate,
    name: 'Chitin Chestplate',
    maxStack: 1,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    armorSlot: 'chestplate',
    armorPoints: 4,
    maxDurability: 130,
  },
  [ItemId.ChitinLeggings]: {
    id: ItemId.ChitinLeggings,
    name: 'Chitin Leggings',
    maxStack: 1,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    armorSlot: 'leggings',
    armorPoints: 3,
    maxDurability: 120,
  },
  [ItemId.ChitinBoots]: {
    id: ItemId.ChitinBoots,
    name: 'Chitin Boots',
    maxStack: 1,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    armorSlot: 'boots',
    armorPoints: 1,
    maxDurability: 80,
  },
  [ItemId.GoldPickaxe]: {
    id: ItemId.GoldPickaxe,
    name: 'Gold Pickaxe',
    maxStack: 1,
    placeBlockId: null,
    toolCategory: 'pickaxe',
    toolTier: 3,
    miningSpeed: 6.2,
    maxDurability: 96,
  },
  [ItemId.GoldAxe]: {
    id: ItemId.GoldAxe,
    name: 'Gold Axe',
    maxStack: 1,
    placeBlockId: null,
    toolCategory: 'axe',
    toolTier: 3,
    miningSpeed: 6.2,
    maxDurability: 96,
  },
  [ItemId.GoldShovel]: {
    id: ItemId.GoldShovel,
    name: 'Gold Shovel',
    maxStack: 1,
    placeBlockId: null,
    toolCategory: 'shovel',
    toolTier: 3,
    miningSpeed: 6.2,
    maxDurability: 96,
  },
  [ItemId.GoldSword]: {
    id: ItemId.GoldSword,
    name: 'Gold Sword',
    maxStack: 1,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 3,
    miningSpeed: 1,
    attackDamage: 7,
    maxDurability: 110,
  },
  [ItemId.GoldHelmet]: {
    id: ItemId.GoldHelmet,
    name: 'Gold Helmet',
    maxStack: 1,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    armorSlot: 'helmet',
    armorPoints: 3,
    maxDurability: 70,
  },
  [ItemId.GoldChestplate]: {
    id: ItemId.GoldChestplate,
    name: 'Gold Chestplate',
    maxStack: 1,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    armorSlot: 'chestplate',
    armorPoints: 5,
    maxDurability: 100,
  },
  [ItemId.GoldLeggings]: {
    id: ItemId.GoldLeggings,
    name: 'Gold Leggings',
    maxStack: 1,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    armorSlot: 'leggings',
    armorPoints: 4,
    maxDurability: 90,
  },
  [ItemId.GoldBoots]: {
    id: ItemId.GoldBoots,
    name: 'Gold Boots',
    maxStack: 1,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    armorSlot: 'boots',
    armorPoints: 2,
    maxDurability: 65,
  },
};

export function getAttackDamage(stack: ItemStack | null): number {
  return stack ? (ITEMS[stack.id].attackDamage ?? 1) : 1;
}

export function getFoodStats(stack: ItemStack | null): { nutrition: number; saturation: number } | null {
  if (!stack) return null;
  const definition = ITEMS[stack.id];
  if (definition.nutrition === undefined) return null;
  return { nutrition: definition.nutrition, saturation: definition.saturation ?? 0 };
}

export function createStack(id: ItemId, count = 1): ItemStack {
  const def = ITEMS[id];
  const stack: ItemStack = { id, count };
  if (def.maxDurability !== undefined) {
    stack.durability = def.maxDurability;
  }
  return stack;
}

/**
 * Computes how many seconds it takes to break `blockId` while holding `heldStack` (or empty hand).
 * Also returns `canHarvest` (whether breaking yields the item drop).
 */
export function getMiningStats(
  blockId: BlockId,
  heldStack: ItemStack | null
): { durationSeconds: number; canHarvest: boolean } {
  const block = BLOCKS[blockId];
  if (!block || !block.breakable) {
    return { durationSeconds: Infinity, canHarvest: false };
  }

  const itemDef = heldStack ? ITEMS[heldStack.id] : null;
  const toolMatches =
    itemDef !== null &&
    block.preferredTool !== 'none' &&
    itemDef.toolCategory === block.preferredTool;
  const heldTier = toolMatches && itemDef ? itemDef.toolTier : 0;

  const canHarvest = block.minToolTier === 0 || heldTier >= block.minToolTier;

  let speedMultiplier = 1.0;
  if (toolMatches && itemDef) {
    speedMultiplier = itemDef.miningSpeed;
  }

  // Classic Minecraft rule: mining a pickaxe-required block with bare hands takes ~3.3x longer and yields no drop
  const penalty = canHarvest ? 1.0 : 3.2;
  const durationSeconds = Math.max(0.05, (block.hardness * penalty) / speedMultiplier);

  return { durationSeconds, canHarvest };
}

/**
 * Determines what ItemStack drops when `blockId` is harvested in Survival mode.
 */
export function getBlockDrop(blockId: BlockId): ItemStack | null {
  switch (blockId) {
    case BlockId.Air:
    case BlockId.Water:
    case BlockId.Bedrock:
    case BlockId.Glass: // Glass shatters without silk touch
    case BlockId.BedFoot:
    case BlockId.BedHead:
    case BlockId.BerrySprout:
    case BlockId.BerryBush:
    case BlockId.BerryBushMature:
    case BlockId.ShroomSprout:
    case BlockId.ShroomGrowing:
      return null;
    case BlockId.FarmlandDry:
    case BlockId.FarmlandWet:
      return createStack(ItemId.Dirt, 1);
    case BlockId.Grass:
    case BlockId.SnowGrass:
      return createStack(ItemId.Dirt, 1);
    case BlockId.Stone:
      return createStack(ItemId.Cobblestone, 1);
    case BlockId.CoalOre:
      return createStack(ItemId.Coal, 1);
    case BlockId.GlowCrystal:
      return createStack(ItemId.CrystalShard, 2);
    case BlockId.AmethystCrystal:
      return createStack(ItemId.AmethystShard, 2);
    case BlockId.LitFurnace:
      return createStack(ItemId.Furnace, 1);
    case BlockId.LitCampfire:
      return createStack(ItemId.Campfire, 1);
    case BlockId.OakLeaves:
    case BlockId.SpruceLeaves: {
      const roll = Math.random();
      if (roll < 0.2) return createStack(ItemId.CaveBerries, 1 + (Math.random() < 0.25 ? 1 : 0));
      return roll < 0.42 ? createStack(ItemId.Stick, 1) : null;
    }
    case BlockId.CaveVine:
      return Math.random() < 0.72
        ? createStack(ItemId.CaveBerries, 1 + (Math.random() < 0.35 ? 1 : 0))
        : createStack(ItemId.CaveVine, 1);
    default:
      return createStack(blockId as unknown as ItemId, 1);
  }
}
