import { ItemId, ItemStack, createStack } from '../../items/Item';

interface MobLootEntry {
  item: ItemId;
  chance: number;
  minimum: number;
  maximum: number;
  maximumChance?: number;
}

export const MOB_LOOT_TABLES: Readonly<Record<string, ReadonlyArray<MobLootEntry>>> = {
  'crystal-mite': [
    { item: ItemId.AmethystShard, chance: 0.22, minimum: 1, maximum: 1 },
  ],
  'cave-crawler': [
    { item: ItemId.CaveChitin, chance: 1, minimum: 1, maximum: 2, maximumChance: 0.3 },
  ],
};

export function rollMobLoot(tableId: string, random: () => number = Math.random): ItemStack[] {
  const entries = MOB_LOOT_TABLES[tableId];
  if (!entries) throw new Error(`Unknown mob loot table: ${tableId}`);
  const drops: ItemStack[] = [];
  for (const entry of entries) {
    if (entry.chance < 1 && random() >= entry.chance) continue;
    const count = entry.minimum === entry.maximum
      ? entry.minimum
      : (random() < (entry.maximumChance ?? 0.5) ? entry.maximum : entry.minimum);
    drops.push(createStack(entry.item, count));
  }
  return drops;
}
