import * as THREE from 'three';
import { BlockId } from '../content/BlockId';
import { BLOCKS } from '../content/BlockRegistry';
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

/** Finds the first visible water voxel without making water generally targetable. */
export function raycastWater(
  world: World,
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  maxDistance = 6
): VoxelHit | null {
  const dir = direction.clone().normalize();
  let lastX = Number.NaN;
  let lastY = Number.NaN;
  let lastZ = Number.NaN;
  for (let distance = 0; distance <= maxDistance; distance += 0.08) {
    const x = Math.floor(origin.x + dir.x * distance);
    const y = Math.floor(origin.y + dir.y * distance);
    const z = Math.floor(origin.z + dir.z * distance);
    if (x === lastX && y === lastY && z === lastZ) continue;
    lastX = x; lastY = y; lastZ = z;
    const blockId = world.getBlock(x, y, z);
    if (blockId === BlockId.Water) {
      return { blockX: x, blockY: y, blockZ: z, normalX: 0, normalY: 0, normalZ: 0, blockId, distance };
    }
    if (blockId !== BlockId.Air && BLOCKS[blockId].targetable) return null;
  }
  return null;
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
    // Targetable blocks (solid blocks + torches; water & air are skipped)
    if (id !== BlockId.Air && BLOCKS[id].targetable) {
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
