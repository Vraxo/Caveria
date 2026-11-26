import { BlockId } from './BlockId';
import { BLOCKS } from './BlockRegistry';

export function isBlockSolid(id: BlockId): boolean {
  return BLOCKS[id]?.solid ?? false;
}

export function getBlockCollisionHeight(id: BlockId): number {
  if (id === BlockId.BedFoot || id === BlockId.BedHead) return 9 / 16;
  if (id === BlockId.Chest) return 14 / 16;
  return isBlockSolid(id) ? 1 : 0;
}

export function isBlockOpaque(id: BlockId): boolean {
  const definition = BLOCKS[id];
  return definition
    ? definition.solid && !definition.transparent && definition.shape === 'cube'
    : false;
}
