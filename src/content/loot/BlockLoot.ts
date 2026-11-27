import { ItemId, ItemStack } from '../../items/ItemTypes';

export type BlockLootCause = 'mined' | 'support-loss';

export interface BlockLootEntry {
  /** Relative selection weight within this pool. */
  weight: number;
  /** Omit the item to represent a no-drop outcome. */
  item?: ItemId;
  minimum?: number;
  maximum?: number;
  /** Chance of selecting maximum instead of minimum when they differ. */
  maximumChance?: number;
}

/** Each pool independently selects at most one entry, allowing tables to yield multiple stacks. */
export interface BlockLootPool {
  entries: ReadonlyArray<BlockLootEntry>;
}

export type BlockLootTable = ReadonlyArray<BlockLootPool>;

export const NO_BLOCK_LOOT: BlockLootTable = Object.freeze([]);

export function fixedBlockLoot(item: ItemId, count = 1): BlockLootTable {
  return [{ entries: [{ item, weight: 1, minimum: count, maximum: count }] }];
}

export function weightedBlockLoot(entries: ReadonlyArray<BlockLootEntry>): BlockLootTable {
  return [{ entries }];
}

export function rollBlockLoot(
  table: BlockLootTable,
  random: () => number = Math.random
): ItemStack[] {
  const drops: ItemStack[] = [];
  for (const pool of table) {
    const totalWeight = pool.entries.reduce((total, entry) => total + entry.weight, 0);
    if (totalWeight <= 0) continue;

    const roll = random() * totalWeight;
    let cumulativeWeight = 0;
    let selected: BlockLootEntry | undefined;
    for (const entry of pool.entries) {
      cumulativeWeight += entry.weight;
      if (roll < cumulativeWeight) {
        selected = entry;
        break;
      }
    }
    // A custom random source may return 1; treat it as the final weighted outcome.
    selected ??= pool.entries.at(-1);
    if (selected?.item === undefined) continue;

    const minimum = selected.minimum ?? 1;
    const maximum = selected.maximum ?? minimum;
    const count = minimum === maximum
      ? minimum
      : (random() < (selected.maximumChance ?? 0.5) ? maximum : minimum);
    drops.push(createLootStack(selected.item, count));
  }
  return drops;
}

export function validateBlockLootTable(table: BlockLootTable, owner: string): void {
  for (const [poolIndex, pool] of table.entries()) {
    if (pool.entries.length === 0) {
      throw new Error(`${owner} loot pool ${poolIndex} is empty`);
    }
    for (const entry of pool.entries) {
      if (!Number.isFinite(entry.weight) || entry.weight <= 0) {
        throw new Error(`${owner} loot entry has a non-positive weight`);
      }
      if (entry.item !== undefined && !VALID_ITEM_IDS.has(entry.item)) {
        throw new Error(`${owner} loot entry references unknown item ${entry.item}`);
      }
      const minimum = entry.minimum ?? 1;
      const maximum = entry.maximum ?? minimum;
      if (!Number.isInteger(minimum) || !Number.isInteger(maximum)
        || minimum < 1 || maximum < minimum) {
        throw new Error(`${owner} loot entry has an invalid count range`);
      }
      const maximumChance = entry.maximumChance ?? 0.5;
      if (maximumChance < 0 || maximumChance > 1) {
        throw new Error(`${owner} loot entry has maximumChance outside 0..1`);
      }
    }
  }
}

const VALID_ITEM_IDS = new Set(
  Object.values(ItemId).filter((value): value is ItemId => typeof value === 'number')
);

function createLootStack(id: ItemId, count: number): ItemStack {
  return { id, count };
}
