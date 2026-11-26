import { ToolCategory } from '../gameplay/MiningTypes';
import { BlockId } from './BlockId';
import { TileIndex } from './TileIndex';

export type BlockRenderShape = 'cube' | 'torch' | 'cross' | 'bed' | 'chest';
export type BlockUseBehaviorId = string;
export type BlockBreakBehaviorId = string;
export type BlockSupportBehavior = 'floor' | 'floor-or-ceiling' | 'ceiling-chain';
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
  /** Optional semantic behavior resolved by the block-use registry. */
  useBehavior?: BlockUseBehaviorId;
  /** Composable cleanup/effect behaviors resolved before this block is removed. */
  breakBehaviors?: ReadonlyArray<BlockBreakBehaviorId>;
  /** Placement and support-cascade rule. */
  supportBehavior?: BlockSupportBehavior;
  /** Fixed item-equivalent block drop when support collapses. */
  unsupportedDrop?: BlockId;
  /** Can be replaced by ordinary block placement. */
  replaceable?: boolean;
  /** Ambient warmth contributed to nearby players. */
  heatSource?: number;
  /** Contact damage dealt by this block once per hazard tick. */
  contactDamage?: number;
  /** Face tiles ordered [positive X, negative X, positive Y, negative Y, positive Z, negative Z]. */
  faces: BlockFaces;
}

export type BlockCatalog = Partial<Record<BlockId, BlockDefinition>>;
