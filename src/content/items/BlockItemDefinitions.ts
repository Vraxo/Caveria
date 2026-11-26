import { BlockId } from '../BlockId';
import { BLOCKS } from '../BlockRegistry';
import { ItemCatalog, ItemDefinition, ItemId } from '../../items/ItemTypes';

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

export const BLOCK_ITEM_DEFINITIONS: ItemCatalog = {
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
};
