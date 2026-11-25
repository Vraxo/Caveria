import { BLOCKS, BlockId, ToolCategory } from '../world/Block';

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

  // Materials
  Stick = 100,
  Coal = 101,
  CrystalShard = 102,

  // Wooden Tools (tier 1)
  WoodenPickaxe = 110,
  WoodenAxe = 111,
  WoodenShovel = 112,

  // Stone Tools (tier 2)
  StonePickaxe = 120,
  StoneAxe = 121,
  StoneShovel = 122,

  // Crystal Tools (tier 3 — Caveria signature!)
  CrystalPickaxe = 130,
}

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
    name: 'Crystal Shard',
    maxStack: 64,
    placeBlockId: null,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1.0,
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
};

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
      return null;
    case BlockId.Grass:
      return createStack(ItemId.Dirt, 1);
    case BlockId.Stone:
      return createStack(ItemId.Cobblestone, 1);
    case BlockId.CoalOre:
      return createStack(ItemId.Coal, 1);
    case BlockId.GlowCrystal:
      return createStack(ItemId.CrystalShard, 2);
    case BlockId.OakLeaves:
      // 25% chance to drop a handy Stick!
      return Math.random() < 0.28 ? createStack(ItemId.Stick, 1) : null;
    default:
      return createStack(blockId as unknown as ItemId, 1);
  }
}
