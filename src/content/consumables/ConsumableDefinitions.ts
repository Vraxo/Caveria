import { ItemId } from '../../items/ItemTypes';

export type ConsumableActionId =
  | 'healing-poultice'
  | 'antidote'
  | 'warming-stew'
  | 'crystal-tonic'
  | 'crystal-fish-tonic'
  | 'purified-crystal-tonic'
  | 'clean-water'
  | 'dirty-water'
  | 'cave-stew'
  | 'dried-cave-berries'
  | 'smoked-cave-shroom'
  | 'blighted-fish';

export interface ConsumableDefinition {
  item: ItemId;
  action: ConsumableActionId;
  trigger: 'direct' | 'after-food';
  sound: 'medicine' | 'drink' | 'eat';
  returnedItem?: ItemId;
  cooldownSeconds: number;
}

export const CONSUMABLE_DEFINITIONS: Readonly<Partial<Record<ItemId, ConsumableDefinition>>> = {
  [ItemId.HealingPoultice]: direct(ItemId.HealingPoultice, 'healing-poultice', 'medicine'),
  [ItemId.Antidote]: direct(ItemId.Antidote, 'antidote', 'medicine'),
  [ItemId.WarmingStew]: direct(ItemId.WarmingStew, 'warming-stew', 'medicine'),
  [ItemId.CrystalTonic]: direct(ItemId.CrystalTonic, 'crystal-tonic', 'medicine'),
  [ItemId.CrystalFishTonic]: direct(ItemId.CrystalFishTonic, 'crystal-fish-tonic', 'drink', ItemId.GlassBottle),
  [ItemId.PurifiedCrystalTonic]: direct(ItemId.PurifiedCrystalTonic, 'purified-crystal-tonic', 'drink', ItemId.GlassBottle),
  [ItemId.CleanWaterBottle]: direct(ItemId.CleanWaterBottle, 'clean-water', 'drink', ItemId.GlassBottle),
  [ItemId.DirtyWaterBottle]: direct(ItemId.DirtyWaterBottle, 'dirty-water', 'drink', ItemId.GlassBottle),
  [ItemId.CaveStew]: afterFood(ItemId.CaveStew, 'cave-stew'),
  [ItemId.DriedCaveBerries]: afterFood(ItemId.DriedCaveBerries, 'dried-cave-berries'),
  [ItemId.SmokedCaveShroom]: afterFood(ItemId.SmokedCaveShroom, 'smoked-cave-shroom'),
  [ItemId.BlightedFish]: afterFood(ItemId.BlightedFish, 'blighted-fish'),
};

function direct(
  item: ItemId,
  action: ConsumableActionId,
  sound: ConsumableDefinition['sound'],
  returnedItem?: ItemId
): ConsumableDefinition {
  return { item, action, trigger: 'direct', sound, returnedItem, cooldownSeconds: 0.55 };
}

function afterFood(item: ItemId, action: ConsumableActionId): ConsumableDefinition {
  return { item, action, trigger: 'after-food', sound: 'eat', cooldownSeconds: 0.55 };
}
