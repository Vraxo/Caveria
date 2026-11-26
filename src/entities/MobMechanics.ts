import * as THREE from 'three';
import { BlockId } from '../content/BlockId';
import { isBlockSolid } from '../content/BlockQueries';
import { World } from '../world/World';
import { MobHit, MobSpeciesId } from './MobTypes';

export interface GroundMobBody {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  onGround: boolean;
}

export interface GroundMobShape {
  radius: number;
  height: number;
}

export interface MovementIntent {
  directionX: number;
  directionZ: number;
  speed: number;
}

export interface GroundMovementResult {
  collidedHorizontally: boolean;
}

interface GroundMovementOptions {
  response: number;
  gravity?: number;
  terminalVelocity?: number;
}

const DEFAULT_GRAVITY = 22;
const DEFAULT_TERMINAL_VELOCITY = -18;

/**
 * Applies shared ground-creature acceleration, gravity, floor collision, and body collision.
 * Species retain ownership of what a horizontal collision means for their behavior.
 */
export function moveGroundMob(
  body: GroundMobBody,
  intent: MovementIntent,
  shape: GroundMobShape,
  world: World,
  dt: number,
  options: GroundMovementOptions
): GroundMovementResult {
  const blend = Math.min(1, dt * options.response);
  body.velocity.x += (intent.directionX * intent.speed - body.velocity.x) * blend;
  body.velocity.z += (intent.directionZ * intent.speed - body.velocity.z) * blend;
  body.velocity.y = Math.max(
    options.terminalVelocity ?? DEFAULT_TERMINAL_VELOCITY,
    body.velocity.y - (options.gravity ?? DEFAULT_GRAVITY) * dt
  );

  moveVertically(body, world, dt);

  const nextX = body.position.x + body.velocity.x * dt;
  const nextZ = body.position.z + body.velocity.z * dt;
  if (canGroundMobOccupy(nextX, body.position.y, nextZ, body.onGround, shape, world)) {
    body.position.x = nextX;
    body.position.z = nextZ;
    return { collidedHorizontally: false };
  }
  return { collidedHorizontally: true };
}

function moveVertically(body: GroundMobBody, world: World, dt: number): void {
  const nextY = body.position.y + body.velocity.y * dt;
  const floorIsSolid = body.velocity.y < 0
    && isBlockSolid(world.getBlock(body.position.x, nextY - 0.02, body.position.z));

  if (floorIsSolid) {
    body.position.y = Math.floor(nextY - 0.02) + 1;
    body.velocity.y = 0;
    body.onGround = true;
    return;
  }

  body.position.y = nextY;
  body.onGround = false;
}

function canGroundMobOccupy(
  x: number,
  y: number,
  z: number,
  requireSupport: boolean,
  shape: GroundMobShape,
  world: World
): boolean {
  for (const offsetX of [-shape.radius, shape.radius]) {
    for (const offsetZ of [-shape.radius, shape.radius]) {
      const lowerBlock = world.getBlock(x + offsetX, y + 0.08, z + offsetZ);
      const upperBlock = world.getBlock(x + offsetX, y + shape.height, z + offsetZ);
      if (isBlockSolid(lowerBlock) || isBlockSolid(upperBlock)) return false;
    }
  }
  return !requireSupport || isBlockSolid(world.getBlock(x, y - 0.08, z));
}

interface RaycastableMob {
  id: number;
  position: THREE.Vector3;
  health: number;
}

interface MobRaycastOptions {
  species: MobSpeciesId;
  name: string;
  maxHealth: number;
  shape: GroundMobShape;
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  maxDistance: number;
  blockDistance: number;
}

/** Returns the nearest mob body reached before terrain. */
export function raycastMobs(
  mobs: ReadonlyArray<RaycastableMob>,
  options: MobRaycastOptions
): MobHit | null {
  const ray = new THREE.Ray(options.origin, options.direction.clone().normalize());
  const hitPoint = new THREE.Vector3();
  let closest: MobHit | null = null;

  for (const mob of mobs) {
    const bounds = mobBounds(mob.position, options.shape);
    if (!ray.intersectBox(bounds, hitPoint)) continue;

    const distance = options.origin.distanceTo(hitPoint);
    if (distance > options.maxDistance || distance >= options.blockDistance) continue;
    if (!closest || distance < closest.distance) {
      closest = {
        species: options.species,
        entityId: mob.id,
        id: mob.id,
        name: options.name,
        distance,
        health: mob.health,
        maxHealth: options.maxHealth,
      };
    }
  }
  return closest;
}

function mobBounds(position: THREE.Vector3, shape: GroundMobShape): THREE.Box3 {
  return new THREE.Box3(
    new THREE.Vector3(
      position.x - shape.radius,
      position.y,
      position.z - shape.radius
    ),
    new THREE.Vector3(
      position.x + shape.radius,
      position.y + shape.height,
      position.z + shape.radius
    )
  );
}

interface GroundSpawnSearchOptions {
  attempts: number;
  minimumRadius: number;
  radiusVariance: number;
  scanAbove: number;
  scanBelow: number;
  acceptsColumn?: (x: number, z: number) => boolean;
  acceptsCandidate?: (x: number, y: number, z: number) => boolean;
}

/**
 * Searches random columns around a center for two empty blocks over a solid floor.
 * Optional predicates let a species add biome, light, or similar environmental rules.
 */
export function findGroundMobSpawn(
  world: World,
  center: THREE.Vector3,
  options: GroundSpawnSearchOptions
): THREE.Vector3 | null {
  for (let attempt = 0; attempt < options.attempts; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = options.minimumRadius + Math.random() * options.radiusVariance;
    const x = Math.floor(center.x + Math.cos(angle) * radius);
    const z = Math.floor(center.z + Math.sin(angle) * radius);
    if (options.acceptsColumn && !options.acceptsColumn(x, z)) continue;

    const topY = Math.floor(center.y + options.scanAbove);
    const bottomY = center.y - options.scanBelow;
    for (let y = topY; y >= bottomY; y--) {
      if (options.acceptsCandidate && !options.acceptsCandidate(x, y, z)) continue;
      if (isOpenGroundSpawn(world, x, y, z)) {
        return new THREE.Vector3(x + 0.5, y, z + 0.5);
      }
    }
  }
  return null;
}

function isOpenGroundSpawn(world: World, x: number, y: number, z: number): boolean {
  return world.getBlock(x, y, z) === BlockId.Air
    && world.getBlock(x, y + 1, z) === BlockId.Air
    && isBlockSolid(world.getBlock(x, y - 1, z));
}
