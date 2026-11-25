import { ToolCategory } from '../gameplay/MiningTypes';
import { BlockId } from './BlockId';
import { TileIndex } from './TileIndex';

export type BlockRenderShape = 'cube' | 'torch' | 'cross';
export type BlockFaces = [TileIndex, TileIndex, TileIndex, TileIndex, TileIndex, TileIndex];

export interface BlockDefinition {
  id: BlockId;
  name: string;
  /** Blocks player movement AABB. */
  solid: boolean;
  /** Raycast can target this block. */
  targetable: boolean;
  /** Adjacent solid blocks must still render their shared face. */
  transparent: boolean;
  /** Rendered in the translucent liquid pass. */
  liquid: boolean;
  breakable: boolean;
  /** Base seconds to break by hand. */
  hardness: number;
  preferredTool: ToolCategory;
  /** Minimum matching tool tier required for drops and full-speed mining. */
  minToolTier: number;
  /** Emitted block light in the inclusive range 0..15. */
  lightEmission: number;
  /** Skylight attenuation in the inclusive range 0..15. */
  lightOpacity: number;
  shape: BlockRenderShape;
  /** Face tiles ordered [positive X, negative X, positive Y, negative Y, positive Z, negative Z]. */
  faces: BlockFaces;
}

export type BlockCatalog = Partial<Record<BlockId, BlockDefinition>>;
