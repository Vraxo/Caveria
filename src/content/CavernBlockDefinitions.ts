import { BLOCK_BREAK } from './BlockCapabilities';
import { BlockId } from './BlockId';
import { allFaces, defineBlock } from './BlockDefinitionHelpers';
import { BlockCatalog } from './BlockTypes';
import { TileIndex } from './TileIndex';

export const CAVERN_BLOCKS: BlockCatalog = {
  [BlockId.DeepSlate]: defineBlock(BlockId.DeepSlate, {
    name: 'Deepslate',
    hardness: 2.5,
    faces: allFaces(TileIndex.DeepSlate),
    preferredTool: 'pickaxe',
    minToolTier: 1,
  }),
  [BlockId.MossStone]: defineBlock(BlockId.MossStone, {
    name: 'Lush Moss',
    hardness: 0.8,
    faces: allFaces(TileIndex.MossStone),
    preferredTool: 'shovel',
  }),
  [BlockId.AmethystCrystal]: defineBlock(BlockId.AmethystCrystal, {
    name: 'Amethyst Geode',
    hardness: 1.5,
    faces: allFaces(TileIndex.AmethystCrystal),
    preferredTool: 'pickaxe',
    minToolTier: 1,
    lightEmission: 13,
  }),
  [BlockId.CaveShroom]: defineBlock(BlockId.CaveShroom, {
    name: 'Glowshroom',
    hardness: 0.1,
    faces: allFaces(TileIndex.CaveShroom),
    solid: false,
    transparent: true,
    lightEmission: 11,
    lightOpacity: 0,
    shape: 'cross',
    supportBehavior: 'floor',
    breakBehaviors: [BLOCK_BREAK.farm, BLOCK_BREAK.disturbedShroom],
  }),
  [BlockId.DripstoneSpike]: defineBlock(BlockId.DripstoneSpike, {
    name: 'Dripstone Spike',
    hardness: 0.9,
    faces: allFaces(TileIndex.DripstoneSpike),
    solid: false,
    transparent: true,
    preferredTool: 'pickaxe',
    lightOpacity: 0,
    shape: 'cross',
    supportBehavior: 'floor-or-ceiling',
  }),
  [BlockId.CaveVine]: defineBlock(BlockId.CaveVine, {
    name: 'Glow Vine',
    hardness: 0.12,
    faces: allFaces(TileIndex.CaveVine),
    solid: false,
    transparent: true,
    lightEmission: 12,
    lightOpacity: 0,
    shape: 'cross',
    supportBehavior: 'ceiling-chain',
    unsupportedDrop: BlockId.CaveVine,
  }),
};
