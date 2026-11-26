import * as THREE from 'three';
import { getBlockCollisionHeight, isBlockSolid } from '../content/BlockQueries';
import { World } from '../world/World';

export interface PlayerCollider {
  halfWidth: number;
  height: number;
}

const EPS = 0.0001;

/**
 * Checks whether placing a 1x1x1 solid block at integer coords (bx, by, bz)
 * overlaps with the player's AABB anchored at feet position `pos`.
 */
export function doesBlockIntersectPlayer(
  bx: number,
  by: number,
  bz: number,
  pos: THREE.Vector3,
  collider: PlayerCollider
): boolean {
  const minX = pos.x - collider.halfWidth + EPS;
  const maxX = pos.x + collider.halfWidth - EPS;
  const minY = pos.y + EPS;
  const maxY = pos.y + collider.height - EPS;
  const minZ = pos.z - collider.halfWidth + EPS;
  const maxZ = pos.z + collider.halfWidth - EPS;

  return (
    bx < maxX &&
    bx + 1 > minX &&
    by < maxY &&
    by + 1 > minY &&
    bz < maxZ &&
    bz + 1 > minZ
  );
}

/**
 * Resolves axis-by-axis AABB movement against solid world voxels.
 * Returns whether the player is grounded after Y resolution.
 */
export function moveWithVoxelCollision(
  world: World,
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  dt: number,
  collider: PlayerCollider,
  preventEdgeFall = false
): { onGround: boolean } {
  let onGround = false;

  // Resolve Y axis first
  pos.y += vel.y * dt;
  if (collidesWithWorld(world, pos, collider)) {
    if (vel.y < 0) {
      pos.y = highestCollisionTop(world, pos, collider);
      onGround = true;
    } else if (vel.y > 0) {
      pos.y = lowestCollisionBottom(world, pos, collider) - collider.height - EPS;
    }
    vel.y = 0;
  }

  // Resolve X axis, then prevent a crouching grounded player from leaving all support.
  const previousX = pos.x;
  pos.x += vel.x * dt;
  if (collidesWithWorld(world, pos, collider)) {
    if (vel.x > 0) {
      const right = pos.x + collider.halfWidth;
      pos.x = Math.floor(right) - collider.halfWidth - EPS;
    } else if (vel.x < 0) {
      const left = pos.x - collider.halfWidth;
      pos.x = Math.floor(left) + 1 + collider.halfWidth + EPS;
    }
    vel.x = 0;
  } else if (preventEdgeFall && onGround && !hasGroundSupport(world, pos, collider)) {
    pos.x = previousX;
    vel.x = 0;
  }

  // Resolve Z axis with the same crouch edge protection.
  const previousZ = pos.z;
  pos.z += vel.z * dt;
  if (collidesWithWorld(world, pos, collider)) {
    if (vel.z > 0) {
      const front = pos.z + collider.halfWidth;
      pos.z = Math.floor(front) - collider.halfWidth - EPS;
    } else if (vel.z < 0) {
      const back = pos.z - collider.halfWidth;
      pos.z = Math.floor(back) + 1 + collider.halfWidth + EPS;
    }
    vel.z = 0;
  } else if (preventEdgeFall && onGround && !hasGroundSupport(world, pos, collider)) {
    pos.z = previousZ;
    vel.z = 0;
  }

  return { onGround };
}

export function canOccupyCollider(
  world: World,
  pos: THREE.Vector3,
  collider: PlayerCollider
): boolean {
  return !collidesWithWorld(world, pos, collider);
}

function hasGroundSupport(world: World, pos: THREE.Vector3, collider: PlayerCollider): boolean {
  const minX = Math.floor(pos.x - collider.halfWidth + EPS);
  const maxX = Math.floor(pos.x + collider.halfWidth - EPS);
  const y = Math.floor(pos.y - EPS);
  const minZ = Math.floor(pos.z - collider.halfWidth + EPS);
  const maxZ = Math.floor(pos.z + collider.halfWidth - EPS);
  for (let z = minZ; z <= maxZ; z++) {
    for (let x = minX; x <= maxX; x++) {
      if (isBlockSolid(world.getBlock(x, y, z))) return true;
    }
  }
  return false;
}

function collidesWithWorld(world: World, pos: THREE.Vector3, collider: PlayerCollider): boolean {
  const minX = Math.floor(pos.x - collider.halfWidth + EPS);
  const maxX = Math.floor(pos.x + collider.halfWidth - EPS);
  const minY = Math.floor(pos.y + EPS);
  const maxY = Math.floor(pos.y + collider.height - EPS);
  const minZ = Math.floor(pos.z - collider.halfWidth + EPS);
  const maxZ = Math.floor(pos.z + collider.halfWidth - EPS);
  const playerBottom = pos.y + EPS;
  const playerTop = pos.y + collider.height - EPS;

  for (let y = minY; y <= maxY; y++) {
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        const height = getBlockCollisionHeight(world.getBlock(x, y, z));
        if (height > 0 && playerBottom < y + height && playerTop > y) return true;
      }
    }
  }
  return false;
}

function highestCollisionTop(world: World, pos: THREE.Vector3, collider: PlayerCollider): number {
  const minX = Math.floor(pos.x - collider.halfWidth + EPS);
  const maxX = Math.floor(pos.x + collider.halfWidth - EPS);
  const minZ = Math.floor(pos.z - collider.halfWidth + EPS);
  const maxZ = Math.floor(pos.z + collider.halfWidth - EPS);
  const minY = Math.floor(pos.y - 1);
  const maxY = Math.floor(pos.y + collider.height);
  let top = pos.y;
  for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) {
    const height = getBlockCollisionHeight(world.getBlock(x, y, z));
    if (height > 0 && pos.y < y + height && pos.y + collider.height > y) {
      top = Math.max(top, y + height);
    }
  }
  return top;
}

function lowestCollisionBottom(world: World, pos: THREE.Vector3, collider: PlayerCollider): number {
  const minX = Math.floor(pos.x - collider.halfWidth + EPS);
  const maxX = Math.floor(pos.x + collider.halfWidth - EPS);
  const minZ = Math.floor(pos.z - collider.halfWidth + EPS);
  const maxZ = Math.floor(pos.z + collider.halfWidth - EPS);
  const minY = Math.floor(pos.y);
  const maxY = Math.floor(pos.y + collider.height);
  let bottom = pos.y + collider.height;
  for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) {
    const height = getBlockCollisionHeight(world.getBlock(x, y, z));
    if (height > 0 && pos.y < y + height && pos.y + collider.height > y) {
      bottom = Math.min(bottom, y);
    }
  }
  return bottom;
}
