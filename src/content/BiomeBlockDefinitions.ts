import { BlockId } from './BlockId';
import { allFaces, columnFaces, defineBlock } from './BlockDefinitionHelpers';
import { BlockCatalog } from './BlockTypes';
import { TileIndex } from './TileIndex';

export const BIOME_BLOCKS: BlockCatalog = {
  [BlockId.Sandstone]: defineBlock(BlockId.Sandstone, {
    name: 'Sandstone',
    hardness: 1.4,
    faces: columnFaces(TileIndex.SandstoneSide, TileIndex.SandstoneTop),
    preferredTool: 'pickaxe',
    minToolTier: 1,
  }),
  [BlockId.Cactus]: defineBlock(BlockId.Cactus, {
    name: 'Cactus',
    hardness: 0.55,
    faces: columnFaces(TileIndex.CactusSide, TileIndex.CactusTop),
    preferredTool: 'axe',
    contactDamage: 1,
  }),
  [BlockId.SnowGrass]: defineBlock(BlockId.SnowGrass, {
    name: 'Snowy Grass',
    hardness: 0.75,
    faces: columnFaces(TileIndex.SnowGrassSide, TileIndex.SnowTop, TileIndex.Dirt),
    preferredTool: 'shovel',
  }),
  [BlockId.SnowBlock]: defineBlock(BlockId.SnowBlock, {
    name: 'Snow Block',
    hardness: 0.45,
    faces: allFaces(TileIndex.SnowTop),
    preferredTool: 'shovel',
  }),
  [BlockId.SpruceLog]: defineBlock(BlockId.SpruceLog, {
    name: 'Spruce Log',
    hardness: 1.6,
    // Spruce bark intentionally shares the existing end-grain tile with oak logs.
    faces: columnFaces(TileIndex.SpruceLogSide, TileIndex.OakLogTop),
    preferredTool: 'axe',
  }),
  [BlockId.SpruceLeaves]: defineBlock(BlockId.SpruceLeaves, {
    name: 'Spruce Needles',
    hardness: 0.25,
    faces: allFaces(TileIndex.SpruceLeaves),
    transparent: true,
    lightOpacity: 1,
  }),
};
