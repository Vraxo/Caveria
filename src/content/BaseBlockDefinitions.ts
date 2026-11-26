import { BlockId } from './BlockId';
import { allFaces, columnFaces, defineBlock } from './BlockDefinitionHelpers';
import { BlockCatalog } from './BlockTypes';
import { TileIndex } from './TileIndex';

export const BASE_BLOCKS: BlockCatalog = {
  [BlockId.Air]: defineBlock(BlockId.Air, {
    name: 'Air',
    hardness: 0,
    faces: allFaces(TileIndex.Dirt),
    solid: false,
    targetable: false,
    transparent: true,
    breakable: false,
    lightOpacity: 0,
  }),
  [BlockId.Grass]: defineBlock(BlockId.Grass, {
    name: 'Grass Block',
    hardness: 0.75,
    faces: columnFaces(TileIndex.GrassSide, TileIndex.GrassTop, TileIndex.Dirt),
    preferredTool: 'shovel',
  }),
  [BlockId.Dirt]: defineBlock(BlockId.Dirt, {
    name: 'Dirt', hardness: 0.65, faces: allFaces(TileIndex.Dirt), preferredTool: 'shovel',
  }),
  [BlockId.Stone]: defineBlock(BlockId.Stone, {
    name: 'Stone', hardness: 1.8, faces: allFaces(TileIndex.Stone), preferredTool: 'pickaxe', minToolTier: 1,
  }),
  [BlockId.Cobblestone]: defineBlock(BlockId.Cobblestone, {
    name: 'Cobblestone', hardness: 2, faces: allFaces(TileIndex.Cobblestone), preferredTool: 'pickaxe', minToolTier: 1,
  }),
  [BlockId.Sand]: defineBlock(BlockId.Sand, {
    name: 'Sand', hardness: 0.6, faces: allFaces(TileIndex.Sand), preferredTool: 'shovel',
  }),
  [BlockId.OakLog]: defineBlock(BlockId.OakLog, {
    name: 'Oak Log', hardness: 1.6, faces: columnFaces(TileIndex.OakLogSide, TileIndex.OakLogTop), preferredTool: 'axe',
  }),
  [BlockId.OakLeaves]: defineBlock(BlockId.OakLeaves, {
    name: 'Oak Leaves', hardness: 0.25, faces: allFaces(TileIndex.OakLeaves), transparent: true, lightOpacity: 1,
  }),
  [BlockId.OakPlanks]: defineBlock(BlockId.OakPlanks, {
    name: 'Oak Planks', hardness: 1.5, faces: allFaces(TileIndex.OakPlanks), preferredTool: 'axe',
  }),
  [BlockId.CoalOre]: defineBlock(BlockId.CoalOre, {
    name: 'Coal Ore', hardness: 2.4, faces: allFaces(TileIndex.CoalOre), preferredTool: 'pickaxe', minToolTier: 1,
  }),
  [BlockId.GoldOre]: defineBlock(BlockId.GoldOre, {
    name: 'Gold Ore', hardness: 3, faces: allFaces(TileIndex.GoldOre), preferredTool: 'pickaxe', minToolTier: 2,
  }),
  [BlockId.Glass]: defineBlock(BlockId.Glass, {
    name: 'Glass', hardness: 0.4, faces: allFaces(TileIndex.Glass), transparent: true, lightOpacity: 0,
  }),
  [BlockId.Water]: defineBlock(BlockId.Water, {
    name: 'Water',
    hardness: 0,
    faces: allFaces(TileIndex.Water),
    solid: false,
    targetable: false,
    transparent: true,
    liquid: true,
    breakable: false,
    lightOpacity: 2,
  }),
  [BlockId.Bedrock]: defineBlock(BlockId.Bedrock, {
    name: 'Bedrock', hardness: Infinity, faces: allFaces(TileIndex.Bedrock), breakable: false, minToolTier: 99,
  }),
  [BlockId.Torch]: defineBlock(BlockId.Torch, {
    name: 'Torch',
    hardness: 0.05,
    faces: allFaces(TileIndex.Torch),
    solid: false,
    transparent: true,
    lightEmission: 14,
    lightOpacity: 0,
    shape: 'torch',
  }),
  [BlockId.GlowCrystal]: defineBlock(BlockId.GlowCrystal, {
    name: 'Azure Crystal',
    hardness: 1.4,
    faces: allFaces(TileIndex.GlowCrystal),
    preferredTool: 'pickaxe',
    minToolTier: 1,
    lightEmission: 15,
  }),
  [BlockId.CraftingTable]: defineBlock(BlockId.CraftingTable, {
    name: 'Crafting Table',
    hardness: 1.6,
    faces: columnFaces(TileIndex.CraftingTableSide, TileIndex.CraftingTableTop, TileIndex.OakPlanks),
    preferredTool: 'axe',
  }),
  [BlockId.Furnace]: defineBlock(BlockId.Furnace, {
    name: 'Furnace',
    hardness: 2.8,
    faces: columnFaces(TileIndex.FurnaceSide, TileIndex.FurnaceTop),
    preferredTool: 'pickaxe',
    minToolTier: 1,
  }),
  [BlockId.LitFurnace]: defineBlock(BlockId.LitFurnace, {
    name: 'Lit Furnace',
    hardness: 2.8,
    faces: columnFaces(TileIndex.LitFurnaceSide, TileIndex.FurnaceTop),
    preferredTool: 'pickaxe',
    minToolTier: 1,
    lightEmission: 12,
  }),
  [BlockId.BedFoot]: defineBlock(BlockId.BedFoot, {
    name: 'Bed',
    hardness: 0.35,
    faces: columnFaces(TileIndex.BedSide, TileIndex.BedFootTop, TileIndex.OakPlanks),
    preferredTool: 'axe',
    transparent: true,
    lightOpacity: 0,
    shape: 'bed',
  }),
  [BlockId.BedHead]: defineBlock(BlockId.BedHead, {
    name: 'Bed',
    hardness: 0.35,
    faces: columnFaces(TileIndex.BedSide, TileIndex.BedHeadTop, TileIndex.OakPlanks),
    preferredTool: 'axe',
    transparent: true,
    lightOpacity: 0,
    shape: 'bed',
  }),
  [BlockId.Chest]: defineBlock(BlockId.Chest, {
    name: 'Chest',
    hardness: 1.8,
    faces: [
      TileIndex.ChestSide,
      TileIndex.ChestSide,
      TileIndex.ChestTop,
      TileIndex.OakPlanks,
      TileIndex.ChestFront,
      TileIndex.ChestSide,
    ],
    preferredTool: 'axe',
    transparent: true,
    lightOpacity: 0,
    shape: 'chest',
  }),
  [BlockId.FarmlandDry]: defineBlock(BlockId.FarmlandDry, {
    name: 'Dry Farmland', hardness: 0.65,
    faces: columnFaces(TileIndex.Dirt, TileIndex.FarmlandDry, TileIndex.Dirt),
    preferredTool: 'shovel',
  }),
  [BlockId.FarmlandWet]: defineBlock(BlockId.FarmlandWet, {
    name: 'Hydrated Farmland', hardness: 0.65,
    faces: columnFaces(TileIndex.Dirt, TileIndex.FarmlandWet, TileIndex.Dirt),
    preferredTool: 'shovel',
  }),
  [BlockId.BerrySprout]: defineBlock(BlockId.BerrySprout, {
    name: 'Berry Sprout', hardness: 0.08, faces: allFaces(TileIndex.BerrySprout),
    solid: false, transparent: true, lightOpacity: 0, shape: 'cross',
  }),
  [BlockId.BerryBush]: defineBlock(BlockId.BerryBush, {
    name: 'Growing Berry Bush', hardness: 0.12, faces: allFaces(TileIndex.BerryBush),
    solid: false, transparent: true, lightOpacity: 0, shape: 'cross',
  }),
  [BlockId.BerryBushMature]: defineBlock(BlockId.BerryBushMature, {
    name: 'Mature Berry Bush', hardness: 0.15, faces: allFaces(TileIndex.BerryBushMature),
    solid: false, transparent: true, lightOpacity: 0, shape: 'cross',
  }),
  [BlockId.ShroomSprout]: defineBlock(BlockId.ShroomSprout, {
    name: 'Cave Shroom Sprout', hardness: 0.06, faces: allFaces(TileIndex.ShroomSprout),
    solid: false, transparent: true, lightOpacity: 0, shape: 'cross',
  }),
  [BlockId.ShroomGrowing]: defineBlock(BlockId.ShroomGrowing, {
    name: 'Growing Cave Shroom', hardness: 0.08, faces: allFaces(TileIndex.ShroomGrowing),
    solid: false, transparent: true, lightOpacity: 0, shape: 'cross',
  }),
  [BlockId.Campfire]: defineBlock(BlockId.Campfire, {
    name: 'Campfire', hardness: 0.7, faces: allFaces(TileIndex.Campfire),
    preferredTool: 'axe', solid: false, transparent: true, lightOpacity: 0, shape: 'cross',
  }),
  [BlockId.LitCampfire]: defineBlock(BlockId.LitCampfire, {
    name: 'Lit Campfire', hardness: 0.7, faces: allFaces(TileIndex.LitCampfire),
    preferredTool: 'axe', solid: false, transparent: true, lightOpacity: 0, shape: 'cross', lightEmission: 14,
  }),
};
