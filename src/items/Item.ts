import { BlockId } from '../content/BlockId';
import { BLOCKS } from '../content/BlockRegistry';
import { ITEMS } from '../content/items/ItemRegistry';
import { rollBlockLoot, type BlockLootCause } from '../content/loot/BlockLoot';
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

/** Rolls every stack declared by the block's context-specific loot table. */
export function getBlockDrops(
  blockId: BlockId,
  cause: BlockLootCause = 'mined',
  random: () => number = Math.random
): ItemStack[] {
  const definition = BLOCKS[blockId];
  const table = cause === 'support-loss'
    ? definition.supportLossLootTable ?? definition.lootTable
    : definition.lootTable;
  return rollBlockLoot(table, random);
}

/** Compatibility helper for callers that only accept one stack. */
export function getBlockDrop(
  blockId: BlockId,
  random: () => number = Math.random
): ItemStack | null {
  return getBlockDrops(blockId, 'mined', random)[0] ?? null;
}
