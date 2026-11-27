import { ItemId } from '../items/ItemTypes';
import { BlockId } from './BlockId';
import { BlockDefinition, BlockFaces } from './BlockTypes';
import { fixedBlockLoot, NO_BLOCK_LOOT } from './loot/BlockLoot';
import { TileIndex } from './TileIndex';

export type BlockConfig = Pick<BlockDefinition, 'name' | 'hardness' | 'faces'> &
  Partial<Omit<BlockDefinition, 'id' | 'name' | 'hardness' | 'faces'>>;

/** Creates a block from the common opaque, solid, breakable cube defaults. */
export function defineBlock(id: BlockId, config: BlockConfig): BlockDefinition {
  return {
    id,
    solid: true,
    targetable: true,
    transparent: false,
    liquid: false,
    breakable: true,
    preferredTool: 'none',
    minToolTier: 0,
    lightEmission: 0,
    lightOpacity: 15,
    shape: 'cube',
    lootTable: config.breakable === false
      ? NO_BLOCK_LOOT
      : fixedBlockLoot(id as unknown as ItemId),
    ...config,
  };
}

export function allFaces(tile: TileIndex): BlockFaces {
  return [tile, tile, tile, tile, tile, tile];
}

export function columnFaces(side: TileIndex, top: TileIndex, bottom = top): BlockFaces {
  return [side, side, top, bottom, side, side];
}
