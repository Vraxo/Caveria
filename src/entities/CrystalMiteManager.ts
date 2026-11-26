import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { BlockId } from '../content/BlockId';
import { isBlockSolid } from '../content/BlockQueries';
import { CRYSTAL_MITE_ID, MOB_DEFINITIONS } from '../content/mobs/MobDefinitions';
import { rollMobLoot } from '../content/loot/MobLoot';
import { Player } from '../player/Player';
import { BreakParticles } from '../rendering/BreakParticles';
import { DroppedItemManager } from '../rendering/DroppedItems';
import { World } from '../world/World';
import { MobHit, MobSpeciesController, MobTag } from './MobTypes';
import {
  CrystalMiteVisual,
  createCrystalMiteVisual,
  disposeCrystalMiteVisual,
  updateCrystalMiteVisual,
} from './CrystalMiteVisual';

export type CrystalMiteHit = MobHit;

type CrystalMiteActivity = 'idle' | 'wandering' | 'inspecting-crystal' | 'fleeing-player';

interface CrystalMiteState {
  // Identity and health
  id: number;
  health: number;

  // World motion
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  onGround: boolean;

  // Behavior
  activity: CrystalMiteActivity;
  activityTimer: number;
  facingAngle: number;
  targetCrystal: THREE.Vector3 | null;

  // Feedback
  age: number;
  hurtTimer: number;
  chirpTimer: number;

  // Rendering
  visual: CrystalMiteVisual;
}

interface PlayerRelation {
  awayX: number;
  awayZ: number;
  distance: number;
}

interface MovementIntent {
  directionX: number;
  directionZ: number;
  speed: number;
}

const DEFINITION = MOB_DEFINITIONS[CRYSTAL_MITE_ID];

const INITIAL_SPAWN_DELAY = 1.2;
const PLAYER_FLEE_DISTANCE = 4.8;
const CRYSTAL_REACHED_DISTANCE = 0.75;
const WANDER_STOP_SECONDS = 0.7;
const WANDER_SPEED = 0.72;
const FLEE_SPEED = 2.25;
const MOVEMENT_RESPONSE = 5.5;
const GRAVITY = 22;
const TERMINAL_VELOCITY = -18;
const DESPAWN_DEPTH_BELOW_SURFACE = 5;
const SPAWN_ATTEMPTS = 14;
const SPAWN_MINIMUM_RADIUS = 7;
const SPAWN_RADIUS_VARIANCE = 13;
const SPAWN_SCAN_ABOVE_PLAYER = 5;
const SPAWN_SCAN_BELOW_PLAYER = 7;
const MINIMUM_SPAWN_SPACING = 3;
const GEODE_SPAWN_CHANCE_ELSEWHERE = 0.18;
const CRYSTAL_INSPECTION_CHANCE = 0.55;
const CRYSTAL_SEARCH_RADIUS = 4;
const CHIRP_DISTANCE = 13;
const HURT_INVULNERABILITY_SECONDS = 0.28;

const BODY_RADIUS = DEFINITION.radius;
const BODY_HEIGHT = DEFINITION.height;

const NO_MOVEMENT: MovementIntent = { directionX: 0, directionZ: 0, speed: 0 };

/**
 * Owns the complete Crystal Mite lifecycle.
 *
 * Frame order: spawn scheduling → timers → sensing → behavior → movement → animation → sound.
 * Behavior priority: flee nearby players, otherwise inspect crystals, otherwise wander or idle.
 */
export class CrystalMiteManager implements MobSpeciesController {
  public readonly species = CRYSTAL_MITE_ID;
  public readonly tags: ReadonlySet<MobTag> = new Set(DEFINITION.tags);

  private readonly mites: CrystalMiteState[] = [];
  private nextId = 1;
  private spawnTimer = INITIAL_SPAWN_DELAY;



  constructor(
    private readonly scene: THREE.Scene,
    private readonly world: World,
    private readonly player: Player,
    private readonly drops: DroppedItemManager,
    private readonly particles: BreakParticles,
    private readonly audio: AudioManager
  ) {}

  // ---- Public species contract ------------------------------------------------

  public get count(): number {
    return this.mites.length;
  }

  public hasWithin(position: THREE.Vector3, radius: number): boolean {
    const radiusSquared = radius * radius;
    return this.mites.some(
      (mite) => mite.position.distanceToSquared(position) <= radiusSquared
    );
  }

  public update(dt: number): void {
    this.updateSpawning(dt);
    for (let index = this.mites.length - 1; index >= 0; index--) {
      this.updateMite(index, dt);
    }
  }

  public raycast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    blockDistance = maxDistance
  ): CrystalMiteHit | null {
    const ray = new THREE.Ray(origin, direction.clone().normalize());
    const hitPoint = new THREE.Vector3();
    let closest: CrystalMiteHit | null = null;

    for (const mite of this.mites) {
      if (!ray.intersectBox(this.hitBoxFor(mite), hitPoint)) continue;
      const distance = origin.distanceTo(hitPoint);
      if (distance > maxDistance || distance >= blockDistance) continue;
      if (!closest || distance < closest.distance) {
        closest = this.describeHit(mite, distance);
      }
    }
    return closest;
  }

  public damage(id: number, amount: number, direction: THREE.Vector3): boolean {
    const index = this.mites.findIndex((mite) => mite.id === id);
    if (index < 0) return false;

    const mite = this.mites[index];
    if (mite.hurtTimer > 0) return false;

    this.applyDamage(mite, amount, direction);
    if (mite.health <= 0) this.killMite(index);
    return true;
  }

  // ---- Per-frame lifecycle ----------------------------------------------------

  private updateSpawning(dt: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;

    this.spawnTimer = DEFINITION.spawnDelay.minimum
      + Math.random() * DEFINITION.spawnDelay.variance;
    this.trySpawn();
  }

  private updateMite(index: number, dt: number): void {
    const mite = this.mites[index];
    this.tickTimers(mite, dt);

    const player = this.relationToPlayer(mite);
    if (player.distance > DEFINITION.despawnDistance) {
      this.removeMite(index);
      return;
    }

    const movement = this.chooseMovement(mite, player);
    this.applyMovement(mite, movement, dt);
    this.updateAnimation(mite);
    this.updateChirping(mite, player.distance);
  }

  private tickTimers(mite: CrystalMiteState, dt: number): void {
    mite.age += dt;
    mite.activityTimer -= dt;
    mite.chirpTimer -= dt;
    mite.hurtTimer = Math.max(0, mite.hurtTimer - dt);
  }

  private relationToPlayer(mite: CrystalMiteState): PlayerRelation {
    const awayX = mite.position.x - this.player.position.x;
    const awayZ = mite.position.z - this.player.position.z;
    return { awayX, awayZ, distance: Math.hypot(awayX, awayZ) };
  }

  // ---- Behavior ---------------------------------------------------------------

  private chooseMovement(mite: CrystalMiteState, player: PlayerRelation): MovementIntent {
    if (player.distance < PLAYER_FLEE_DISTANCE) {
      return this.fleeFromPlayer(mite, player);
    }

    if (mite.activityTimer <= 0) this.chooseNewActivity(mite);
    if (mite.targetCrystal) return this.moveTowardCrystal(mite);
    if (mite.activityTimer > WANDER_STOP_SECONDS) return this.wander(mite);

    mite.activity = 'idle';
    return NO_MOVEMENT;
  }

  private fleeFromPlayer(
    mite: CrystalMiteState,
    player: PlayerRelation
  ): MovementIntent {
    const inverseDistance = 1 / Math.max(0.001, player.distance);
    mite.activity = 'fleeing-player';
    mite.targetCrystal = null;
    return {
      directionX: player.awayX * inverseDistance,
      directionZ: player.awayZ * inverseDistance,
      speed: FLEE_SPEED,
    };
  }

  private moveTowardCrystal(mite: CrystalMiteState): MovementIntent {
    const targetX = mite.targetCrystal!.x - mite.position.x;
    const targetZ = mite.targetCrystal!.z - mite.position.z;
    const distance = Math.hypot(targetX, targetZ);

    if (distance < CRYSTAL_REACHED_DISTANCE) {
      mite.activity = 'idle';
      mite.targetCrystal = null;
      mite.activityTimer = 1.2 + Math.random() * 2.4;
      return NO_MOVEMENT;
    }

    mite.activity = 'inspecting-crystal';
    return {
      directionX: targetX / distance,
      directionZ: targetZ / distance,
      speed: WANDER_SPEED,
    };
  }

  private wander(mite: CrystalMiteState): MovementIntent {
    mite.activity = 'wandering';
    return {
      directionX: Math.sin(mite.facingAngle),
      directionZ: Math.cos(mite.facingAngle),
      speed: WANDER_SPEED,
    };
  }

  private chooseNewActivity(mite: CrystalMiteState): void {
    mite.targetCrystal = Math.random() < CRYSTAL_INSPECTION_CHANCE
      ? this.findNearbyCrystal(mite.position)
      : null;
    mite.facingAngle = Math.random() * Math.PI * 2;
    mite.activity = mite.targetCrystal ? 'inspecting-crystal' : 'wandering';
    mite.activityTimer = mite.targetCrystal
      ? 3 + Math.random() * 3
      : 1.4 + Math.random() * 3.8;
  }

  private findNearbyCrystal(position: THREE.Vector3): THREE.Vector3 | null {
    const centerX = Math.floor(position.x);
    const centerY = Math.floor(position.y);
    const centerZ = Math.floor(position.z);

    for (let radius = 1; radius <= CRYSTAL_SEARCH_RADIUS; radius++) {
      for (let z = -radius; z <= radius; z++) {
        for (let x = -radius; x <= radius; x++) {
          for (let y = -1; y <= 2; y++) {
            const block = this.world.getBlock(centerX + x, centerY + y, centerZ + z);
            if (block === BlockId.AmethystCrystal || block === BlockId.GlowCrystal) {
              return new THREE.Vector3(centerX + x + 0.5, centerY, centerZ + z + 0.5);
            }
          }
        }
      }
    }
    return null;
  }

  // ---- Movement and animation -------------------------------------------------

  private applyMovement(
    mite: CrystalMiteState,
    intent: MovementIntent,
    dt: number
  ): void {
    const blend = Math.min(1, dt * MOVEMENT_RESPONSE);
    mite.velocity.x += (intent.directionX * intent.speed - mite.velocity.x) * blend;
    mite.velocity.z += (intent.directionZ * intent.speed - mite.velocity.z) * blend;
    mite.velocity.y = Math.max(TERMINAL_VELOCITY, mite.velocity.y - GRAVITY * dt);
    this.moveWithCollision(mite, dt);
  }

  private moveWithCollision(mite: CrystalMiteState, dt: number): void {
    const nextY = mite.position.y + mite.velocity.y * dt;
    if (
      mite.velocity.y < 0
      && isBlockSolid(this.world.getBlock(mite.position.x, nextY - 0.02, mite.position.z))
    ) {
      mite.position.y = Math.floor(nextY - 0.02) + 1;
      mite.velocity.y = 0;
      mite.onGround = true;
    } else {
      mite.position.y = nextY;
      mite.onGround = false;
    }

    const nextX = mite.position.x + mite.velocity.x * dt;
    const nextZ = mite.position.z + mite.velocity.z * dt;
    if (this.canOccupy(nextX, mite.position.y, nextZ, mite.onGround)) {
      mite.position.x = nextX;
      mite.position.z = nextZ;
      return;
    }

    mite.velocity.x *= -0.25;
    mite.velocity.z *= -0.25;
    mite.facingAngle += Math.PI * (0.55 + Math.random() * 0.9);
    mite.activity = 'idle';
    mite.activityTimer = 0.6;
    mite.targetCrystal = null;
  }

  private canOccupy(x: number, y: number, z: number, requireSupport: boolean): boolean {
    for (const offsetX of [-BODY_RADIUS, BODY_RADIUS]) {
      for (const offsetZ of [-BODY_RADIUS, BODY_RADIUS]) {
        const lowerBlock = this.world.getBlock(x + offsetX, y + 0.08, z + offsetZ);
        const upperBlock = this.world.getBlock(x + offsetX, y + BODY_HEIGHT, z + offsetZ);
        if (isBlockSolid(lowerBlock) || isBlockSolid(upperBlock)) return false;
      }
    }
    return !requireSupport || isBlockSolid(this.world.getBlock(x, y - 0.08, z));
  }

  private updateAnimation(mite: CrystalMiteState): void {
    updateCrystalMiteVisual(mite.visual, {
      id: mite.id,
      age: mite.age,
      hurt: mite.hurtTimer > 0,
      position: mite.position,
      velocity: mite.velocity,
    });
  }

  private updateChirping(mite: CrystalMiteState, playerDistance: number): void {
    if (mite.chirpTimer > 0 || playerDistance >= CHIRP_DISTANCE) return;
    mite.chirpTimer = 4 + Math.random() * 9;
    this.audio.playCrystalMiteChirp();
  }

  // ---- Spawning ---------------------------------------------------------------

  private trySpawn(): void {
    if (!this.canSpawnMore() || !this.playerIsUnderground()) return;
    const position = this.findSpawnPosition();
    if (position) this.spawnMite(position.x, position.y, position.z);
  }

  private canSpawnMore(): boolean {
    return this.mites.length < DEFINITION.maxPopulation;
  }

  private playerIsUnderground(): boolean {
    const playerX = Math.floor(this.player.position.x);
    const playerZ = Math.floor(this.player.position.z);
    const surface = this.world.terrainGen.getSurfaceHeight(playerX, playerZ);
    return this.player.position.y <= surface - DESPAWN_DEPTH_BELOW_SURFACE;
  }

  private findSpawnPosition(): THREE.Vector3 | null {
    for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = SPAWN_MINIMUM_RADIUS + Math.random() * SPAWN_RADIUS_VARIANCE;
      const x = Math.floor(this.player.position.x + Math.cos(angle) * radius);
      const z = Math.floor(this.player.position.z + Math.sin(angle) * radius);
      if (!this.biomeAllowsSpawn(x, z)) continue;

      const topY = Math.floor(this.player.position.y + SPAWN_SCAN_ABOVE_PLAYER);
      const bottomY = this.player.position.y - SPAWN_SCAN_BELOW_PLAYER;
      for (let y = topY; y >= bottomY; y--) {
        if (!this.isOpenSpawnBlock(x, y, z)) continue;
        const position = new THREE.Vector3(x + 0.5, y, z + 0.5);
        return this.isSpawnAreaCrowded(position) ? null : position;
      }
    }
    return null;
  }

  private biomeAllowsSpawn(x: number, z: number): boolean {
    const biome = this.world.terrainGen.getCavernBiome(x, z);
    return biome === 'Crystal Geode Hall' || Math.random() <= GEODE_SPAWN_CHANCE_ELSEWHERE;
  }

  private isOpenSpawnBlock(x: number, y: number, z: number): boolean {
    return this.world.getBlock(x, y, z) === BlockId.Air
      && this.world.getBlock(x, y + 1, z) === BlockId.Air
      && isBlockSolid(this.world.getBlock(x, y - 1, z));
  }

  private isSpawnAreaCrowded(position: THREE.Vector3): boolean {
    return this.mites.some(
      (mite) => Math.hypot(
        mite.position.x - position.x,
        mite.position.z - position.z
      ) < MINIMUM_SPAWN_SPACING
    );
  }

  private spawnMite(x: number, y: number, z: number): void {
    const position = new THREE.Vector3(x, y, z);
    const visual = createCrystalMiteVisual();
    visual.root.position.copy(position);
    this.scene.add(visual.root);

    this.mites.push({
      id: this.nextId++,
      health: DEFINITION.maxHealth,
      position,
      velocity: new THREE.Vector3(),
      onGround: false,
      age: Math.random() * 8,
      hurtTimer: 0,
      chirpTimer: 2 + Math.random() * 7,
      activity: 'idle',
      activityTimer: 0,
      facingAngle: Math.random() * Math.PI * 2,
      targetCrystal: null,
      visual,
    });
  }



  // ---- Combat and removal -----------------------------------------------------

  private applyDamage(
    mite: CrystalMiteState,
    amount: number,
    direction: THREE.Vector3
  ): void {
    mite.health -= Math.max(1, amount);
    mite.hurtTimer = HURT_INVULNERABILITY_SECONDS;
    mite.velocity.x += direction.x * 3.8;
    mite.velocity.y = 3.3;
    mite.velocity.z += direction.z * 3.8;
    mite.activity = 'idle';
    mite.activityTimer = 0;
    this.audio.playCrystalMiteHit();
  }

  private killMite(index: number): void {
    const mite = this.mites[index];
    this.audio.playCrystalMiteDeath();
    this.particles.spawnBurst(
      mite.position.x - 0.5,
      mite.position.y,
      mite.position.z - 0.5,
      BlockId.AmethystCrystal
    );
    for (const stack of rollMobLoot(DEFINITION.lootTable)) {
      this.drops.spawnDrop(
        mite.position.x,
        mite.position.y + 0.25,
        mite.position.z,
        stack
      );
    }
    this.removeMite(index);
  }

  private hitBoxFor(mite: CrystalMiteState): THREE.Box3 {
    return new THREE.Box3(
      new THREE.Vector3(
        mite.position.x - BODY_RADIUS,
        mite.position.y,
        mite.position.z - BODY_RADIUS
      ),
      new THREE.Vector3(
        mite.position.x + BODY_RADIUS,
        mite.position.y + BODY_HEIGHT,
        mite.position.z + BODY_RADIUS
      )
    );
  }

  private describeHit(mite: CrystalMiteState, distance: number): CrystalMiteHit {
    return {
      species: this.species,
      entityId: mite.id,
      id: mite.id,
      name: DEFINITION.name,
      distance,
      health: mite.health,
      maxHealth: DEFINITION.maxHealth,
    };
  }

  private removeMite(index: number): void {
    const mite = this.mites[index];
    this.scene.remove(mite.visual.root);
    disposeCrystalMiteVisual(mite.visual);
    this.mites.splice(index, 1);
  }
}
