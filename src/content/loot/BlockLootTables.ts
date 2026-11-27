import { ItemId } from '../../items/ItemTypes';
import { weightedBlockLoot } from './BlockLoot';

export const LEAF_BLOCK_LOOT = weightedBlockLoot([
  { item: ItemId.CaveBerries, weight: 20, minimum: 1, maximum: 2, maximumChance: 0.25 },
  { item: ItemId.Stick, weight: 22 },
  { weight: 58 },
]);

export const CAVE_VINE_BLOCK_LOOT = weightedBlockLoot([
  { item: ItemId.CaveBerries, weight: 72, minimum: 1, maximum: 2, maximumChance: 0.35 },
  { item: ItemId.CaveVine, weight: 28 },
]);
