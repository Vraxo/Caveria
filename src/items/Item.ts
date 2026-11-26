import { BlockId } from '../content/BlockId';
import { BLOCKS } from '../content/BlockRegistry';
import { ITEMS } from '../content/items/ItemRegistry';
import { ItemId, ItemStack } from './ItemTypes';

export { ITEMS } from '../content/items/ItemRegistry';
export * from './ItemTypes';

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
