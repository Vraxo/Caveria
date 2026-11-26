import { ItemId } from '../../items/ItemTypes';
import { SurfaceBiome } from '../../world/TerrainGen';
import { WaterQuality } from '../../gameplay/WaterQuality';

export interface FishingLootEntry {
  item: ItemId;
  weight: number;
}

type FishingLootTableId = 'freshSurface' | 'freshDeep' | 'murkySurface' | 'murkyDeep' | 'tainted';

export const FISHING_LOOT_TABLES: Readonly<Record<FishingLootTableId, ReadonlyArray<FishingLootEntry>>> = {
  freshSurface: [
    { item: ItemId.RawRiverFish, weight: 52 },
    { item: ItemId.RawCaveFish, weight: 15 },
    { item: ItemId.CrystalFish, weight: 7 },
    { item: ItemId.Stick, weight: 9 },
    { item: ItemId.GlassBottle, weight: 7 },
    { item: ItemId.Coal, weight: 5 },
    { item: ItemId.GoldIngot, weight: 2 },
  ],
  freshDeep: [
    { item: ItemId.RawRiverFish, weight: 18 },
    { item: ItemId.RawCaveFish, weight: 48 },
    { item: ItemId.CrystalFish, weight: 9 },
    { item: ItemId.Stick, weight: 9 },
    { item: ItemId.GlassBottle, weight: 7 },
    { item: ItemId.Coal, weight: 5 },
    { item: ItemId.GoldIngot, weight: 2 },
  ],
  murkySurface: [
    { item: ItemId.RawCaveFish, weight: 36 },
    { item: ItemId.RawRiverFish, weight: 24 },
    { item: ItemId.CrystalFish, weight: 4 },
    { item: ItemId.Stick, weight: 17 },
    { item: ItemId.GlassBottle, weight: 10 },
    { item: ItemId.Coal, weight: 7 },
    { item: ItemId.CrystalShard, weight: 2 },
  ],
  murkyDeep: [
    { item: ItemId.RawCaveFish, weight: 48 },
    { item: ItemId.RawRiverFish, weight: 12 },
    { item: ItemId.CrystalFish, weight: 4 },
    { item: ItemId.Stick, weight: 17 },
    { item: ItemId.GlassBottle, weight: 10 },
    { item: ItemId.Coal, weight: 7 },
    { item: ItemId.CrystalShard, weight: 2 },
  ],
  tainted: [
    { item: ItemId.BlightedFish, weight: 43 },
    { item: ItemId.RawCaveFish, weight: 22 },
    { item: ItemId.CrystalFish, weight: 3 },
    { item: ItemId.Stick, weight: 15 },
    { item: ItemId.GlassBottle, weight: 10 },
    { item: ItemId.Coal, weight: 6 },
    { item: ItemId.GoldIngot, weight: 1 },
  ],
};

export const FISHING_BIOME_WEIGHT_SHIFTS: Readonly<Partial<Record<SurfaceBiome, ReadonlyArray<{
  from: ItemId;
  to: ItemId;
  weight: number;
}>>>> = {
  'Desert Dunes': [{ from: ItemId.RawRiverFish, to: ItemId.Stick, weight: 10 }],
};

export function getFishingLootTable(quality: WaterQuality, deep: boolean): ReadonlyArray<FishingLootEntry> {
  if (quality === 'tainted') return FISHING_LOOT_TABLES.tainted;
  if (quality === 'murky') return FISHING_LOOT_TABLES[deep ? 'murkyDeep' : 'murkySurface'];
  return FISHING_LOOT_TABLES[deep ? 'freshDeep' : 'freshSurface'];
}
