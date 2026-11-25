import * as THREE from 'three';
import { BLOCKS, BlockId } from '../world/Block';
import { World } from '../world/World';

export interface VoxelHit {
  blockX: number;
  blockY: number;
  blockZ: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  blockId: BlockId;
  distance: number;
}

/**
 * Amanatides & Woo fast 3D DDA voxel traversal.
 */
export function raycastVoxel(
  world: World,
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  maxDistance = 6.0
): VoxelHit | null {
  const dir = direction.clone().normalize();

  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  const stepX = dir.x > 0 ? 1 : dir.x < 0 ? -1 : 0;
  const stepY = dir.y > 0 ? 1 : dir.y < 0 ? -1 : 0;
  const stepZ = dir.z > 0 ? 1 : dir.z < 0 ? -1 : 0;

  const tDeltaX = stepX !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dir.z) : Infinity;

  let tMaxX =
    stepX > 0
      ? (x + 1 - origin.x) * tDeltaX
      : stepX < 0
      ? (origin.x - x) * tDeltaX
      : Infinity;
  let tMaxY =
    stepY > 0
      ? (y + 1 - origin.y) * tDeltaY
      : stepY < 0
      ? (origin.y - y) * tDeltaY
      : Infinity;
  let tMaxZ =
    stepZ > 0
      ? (z + 1 - origin.z) * tDeltaZ
      : stepZ < 0
      ? (origin.z - z) * tDeltaZ
      : Infinity;

  let normalX = 0;
  let normalY = 0;
  let normalZ = 0;
  let dist = 0;

  while (dist <= maxDistance) {
    const id = world.getBlock(x, y, z);
    // Solid blocks are targetable (water is skipped so you can mine/build underwater)
    if (id !== BlockId.Air && BLOCKS[id].solid) {
      return {
        blockX: x,
        blockY: y,
        blockZ: z,
        normalX,
        normalY,
        normalZ,
        blockId: id,
        distance: dist,
      };
    }

    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        x += stepX;
        dist = tMaxX;
        tMaxX += tDeltaX;
        normalX = -stepX;
        normalY = 0;
        normalZ = 0;
      } else {
        z += stepZ;
        dist = tMaxZ;
        tMaxZ += tDeltaZ;
        normalX = 0;
        normalY = 0;
        normalZ = -stepZ;
      }
    } else {
      if (tMaxY < tMaxZ) {
        y += stepY;
        dist = tMaxY;
        tMaxY += tDeltaY;
        normalX = 0;
        normalY = -stepY;
        normalZ = 0;
      } else {
        z += stepZ;
        dist = tMaxZ;
        tMaxZ += tDeltaZ;
        normalX = 0;
        normalY = 0;
        normalZ = -stepZ;
      }
    }
  }

  return null;
}
