/**
 * Compatibility facade for block-domain imports.
 * Stable IDs, metadata catalogs, rendering tiles, queries, and creative policy
 * are implemented in focused modules under `content` and `gameplay`.
 */
export { BlockId } from '../content/BlockId';
export { TileIndex } from '../content/TileIndex';
export type {
  BlockCatalog,
  BlockDefinition,
  BlockFaces,
  BlockRenderShape,
} from '../content/BlockTypes';
export { BLOCKS } from '../content/BlockRegistry';
export { isBlockOpaque, isBlockSolid } from '../content/BlockQueries';
export type { ToolCategory } from '../gameplay/MiningTypes';
export { HOTBAR_BLOCKS } from '../gameplay/CreativePalette';
