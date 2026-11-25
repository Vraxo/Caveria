import { BlockId } from './BlockId';
import { BLOCKS } from './BlockRegistry';

export function isBlockSolid(id: BlockId): boolean {
  return BLOCKS[id]?.solid ?? false;
}

export function isBlockOpaque(id: BlockId): boolean {
  const definition = BLOCKS[id];
  return definition
    ? definition.solid && !definition.transparent && definition.shape === 'cube'
    : false;
}
