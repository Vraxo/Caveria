import { BlockId } from '../content/BlockId';
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

export type ItemCatalog = Partial<Record<ItemId, ItemDefinition>>;

