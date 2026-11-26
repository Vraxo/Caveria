import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { BlockId } from '../content/BlockId';
import { isBlockSolid } from '../content/BlockQueries';
import { rollMobLoot } from '../content/loot/MobLoot';
import { CAVE_CRAWLER_ID, MOB_DEFINITIONS } from '../content/mobs/MobDefinitions';
import { Player } from '../player/Player';
import { raycastVoxel } from '../player/Raycaster';
import { PlayerVitals } from '../player/PlayerVitals';
import { BreakParticles } from '../rendering/BreakParticles';
import { DroppedItemManager } from '../rendering/DroppedItems';
import { World } from '../world/World';
import {
  CaveCrawlerVisual,
  createCaveCrawlerVisual,
  disposeCaveCrawlerVisual,
  updateCaveCrawlerVisual,
} from './CaveCrawlerVisual';
import { MobHit, MobSpeciesController, MobTag } from './MobTypes';

export type CaveCrawlerHit = MobHit;

type CaveCrawlerActivity = 'wandering' | 'pursuing-player';

interface CaveCrawlerState {
  // Identity and health
  id: number;
  health: number;

  // World motion
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  onGround: boolean;

  // Behavior
  activity: CaveCrawlerActivity;
  facingAngle: number;
  decisionTimer: number;
  attackTimer: number;

  // Feedback
  age: number;
  growlTimer: number;
  hurtTimer: number;

  // Rendering
  visual: CaveCrawlerVisual;
}

interface PlayerRelation {
  towardX: number;
  towardZ: number;
  horizontalDistance: number;
  verticalDistance: number;
}

interface MovementIntent {
  directionX: number;
  directionZ: number;
  speed: number;
}

const DEFINITION = MOB_DEFINITIONS[CAVE_CRAWLER_ID];

const INITIAL_SPAWN_DELAY = 4;
const PLAYER_SIGHT_DISTANCE = 14;
const GROWL_DISTANCE = 9;
const ATTACK_DISTANCE = 1.25;
const ATTACK_MAXIMUM_HEIGHT_DIFFERENCE = 1.5;
const ATTACK_COOLDOWN_SECONDS = 1.15;
const ATTACK_DAMAGE = 3;
const ATTACK_POISON_CHANCE = 0.18;
const ATTACK_KNOCKBACK = 4.2;
const ATTACK_UPWARD_KNOCKBACK = 3.2;
const CLOSE_PURSUIT_DISTANCE = 2;
const CLOSE_PURSUIT_SPEED = 1.25;
const PURSUIT_SPEED = 2.05;
const WANDER_SPEED = 0.62;
const MOVEMENT_RESPONSE = 5;
const GRAVITY = 22;
const TERMINAL_VELOCITY = -18;
const LINE_OF_SIGHT_TOLERANCE = 0.35;
const REQUIRED_DEPTH_BELOW_SURFACE = 7;
const MAXIMUM_SPAWN_SKY_LIGHT = 3;
const SPAWN_ATTEMPTS = 14;
const SPAWN_MINIMUM_RADIUS = 10;
const SPAWN_RADIUS_VARIANCE = 13;
const SPAWN_SCAN_ABOVE_PLAYER = 5;
const SPAWN_SCAN_BELOW_PLAYER = 7;
const HURT_INVULNERABILITY_SECONDS = 0.24;

const BODY_RADIUS = DEFINITION.radius;
const BODY_HEIGHT = DEFINITION.height;

/**
 * Owns the complete Cave Crawler lifecycle.
 *
 * Frame order: spawn scheduling → timers → sensing → behavior → attacks → movement → animation.
 * Behavior priority: pursue a visible living player; otherwise choose a wandering direction.
 */
export class CaveCrawlerManager implements MobSpeciesController {
  public readonly species = CAVE_CRAWLER_ID;
  public readonly tags: ReadonlySet<MobTag> = new Set(DEFINITION.tags);

  private readonly crawlers: CaveCrawlerState[] = [];
  private spawnTimer = INITIAL_SPAWN_DELAY;
  private nextId = 1;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly world: World,
    private readonly player: Player,
    private readonly vitals: PlayerVitals,
    private readonly drops: DroppedItemManager,
    private readonly particles: BreakParticles,
    private readonly audio: AudioManager,
    private readonly onPoisonPlayer: () => void = () => {}
  ) {}

  // ---- Public species contract ------------------------------------------------

  public get count(): number {
    return this.crawlers.length;
  }

  public hasWithin(position: THREE.Vector3, radius: number): boolean {
    const radiusSquared = radius * radius;
    return this.crawlers.some(
      (crawler) => crawler.position.distanceToSquared(position) <= radiusSquared
    );
  }

  /** Kept as a descriptive compatibility alias for sleep and proximity callers. */
  public hasCrawlerWithin(position: THREE.Vector3, radius: number): boolean {
    return this.hasWithin(position, radius);
  }

  public update(dt: number): void {
    this.updateSpawning(dt);
    for (let index = this.crawlers.length - 1; index >= 0; index--) {
      this.updateCrawler(index, dt);
    }
  }

  public raycast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    blockDistance: number
  ): CaveCrawlerHit | null {
    const ray = new THREE.Ray(origin, direction.clone().normalize());
    const hitPoint = new THREE.Vector3();
    let closest: CaveCrawlerHit | null = null;

    for (const crawler of this.crawlers) {
      if (!ray.intersectBox(this.hitBoxFor(crawler), hitPoint)) continue;
      const distance = origin.distanceTo(hitPoint);
      if (distance > maxDistance || distance >= blockDistance) continue;
      if (!closest || distance < closest.distance) {
        closest = this.describeHit(crawler, distance);
      }
    }
    return closest;
  }

  public damage(id: number, amount: number, direction: THREE.Vector3): boolean {
    const index = this.crawlers.findIndex((crawler) => crawler.id === id);
    if (index < 0) return false;

    const crawler = this.crawlers[index];
    if (crawler.hurtTimer > 0) return false;

    this.applyDamage(crawler, amount, direction);
    if (crawler.health <= 0) this.killCrawler(index);
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

  private updateCrawler(index: number, dt: number): void {
    const crawler = this.crawlers[index];
    this.tickTimers(crawler, dt);

    const player = this.relationToPlayer(crawler);
    if (player.horizontalDistance > DEFINITION.despawnDistance) {
      this.removeCrawler(index);
      return;
    }

    const movement = this.chooseMovement(crawler, player);
    this.applyMovement(crawler, movement, dt);
    this.updateAnimation(crawler);
  }

  private tickTimers(crawler: CaveCrawlerState, dt: number): void {
    crawler.age += dt;
    crawler.attackTimer = Math.max(0, crawler.attackTimer - dt);
    crawler.decisionTimer -= dt;
    crawler.growlTimer -= dt;
    crawler.hurtTimer = Math.max(0, crawler.hurtTimer - dt);
  }

  private relationToPlayer(crawler: CaveCrawlerState): PlayerRelation {
    const towardX = this.player.position.x - crawler.position.x;
    const towardZ = this.player.position.z - crawler.position.z;
    return {
      towardX,
      towardZ,
      horizontalDistance: Math.hypot(towardX, towardZ),
      verticalDistance: Math.abs(this.player.position.y - crawler.position.y),
    };
  }

  // ---- Behavior and attacks ---------------------------------------------------

  private chooseMovement(
    crawler: CaveCrawlerState,
    player: PlayerRelation
  ): MovementIntent {
    if (this.canPursuePlayer(crawler, player)) {
      return this.pursuePlayer(crawler, player);
    }
    return this.wander(crawler);
  }

  private canPursuePlayer(
    crawler: CaveCrawlerState,
    player: PlayerRelation
  ): boolean {
    return player.horizontalDistance < PLAYER_SIGHT_DISTANCE
      && this.hasLineOfSight(crawler, player.horizontalDistance)
      && !this.vitals.dead;
  }

  private pursuePlayer(
    crawler: CaveCrawlerState,
    player: PlayerRelation
  ): MovementIntent {
    const inverseDistance = 1 / Math.max(0.001, player.horizontalDistance);
    const directionX = player.towardX * inverseDistance;
    const directionZ = player.towardZ * inverseDistance;

    crawler.activity = 'pursuing-player';
    crawler.facingAngle = Math.atan2(directionX, directionZ);
    this.tryGrowl(crawler, player.horizontalDistance);
    this.tryAttackPlayer(crawler, player, directionX, directionZ);

    return {
      directionX,
      directionZ,
      speed: player.horizontalDistance < CLOSE_PURSUIT_DISTANCE
        ? CLOSE_PURSUIT_SPEED
        : PURSUIT_SPEED,
    };
  }

  private wander(crawler: CaveCrawlerState): MovementIntent {
    crawler.activity = 'wandering';
    if (crawler.decisionTimer <= 0) {
      crawler.facingAngle += (Math.random() - 0.5) * Math.PI * 1.7;
      crawler.decisionTimer = 1.2 + Math.random() * 3.5;
    }
    return {
      directionX: Math.sin(crawler.facingAngle),
      directionZ: Math.cos(crawler.facingAngle),
      speed: WANDER_SPEED,
    };
  }

  private tryGrowl(crawler: CaveCrawlerState, playerDistance: number): void {
    if (crawler.growlTimer > 0 || playerDistance >= GROWL_DISTANCE) return;
    crawler.growlTimer = 4 + Math.random() * 7;
    this.audio.playCaveCrawlerGrowl();
  }

  private tryAttackPlayer(
    crawler: CaveCrawlerState,
    player: PlayerRelation,
    directionX: number,
    directionZ: number
  ): void {
    const inMeleeRange = player.horizontalDistance < ATTACK_DISTANCE
      && player.verticalDistance < ATTACK_MAXIMUM_HEIGHT_DIFFERENCE;
    if (!inMeleeRange || crawler.attackTimer > 0) return;

    crawler.attackTimer = ATTACK_COOLDOWN_SECONDS;
    const knockback = this.vitals.knockbackMultiplier;
    if (!this.vitals.damage(ATTACK_DAMAGE, 'mob')) return;

    if (Math.random() < ATTACK_POISON_CHANCE) this.onPoisonPlayer();
    this.player.velocity.x += directionX * ATTACK_KNOCKBACK * knockback;
    this.player.velocity.y = Math.max(
      this.player.velocity.y,
      ATTACK_UPWARD_KNOCKBACK * knockback
    );
    this.player.velocity.z += directionZ * ATTACK_KNOCKBACK * knockback;
  }

  private hasLineOfSight(crawler: CaveCrawlerState, distance: number): boolean {
    const origin = new THREE.Vector3(
      crawler.position.x,
      crawler.position.y + 0.4,
      crawler.position.z
    );
    const direction = this.player.getEyePosition().sub(origin).normalize();
    const hit = raycastVoxel(this.world, origin, direction, distance);
    return !hit || hit.distance >= distance - LINE_OF_SIGHT_TOLERANCE;
  }

  // ---- Movement and animation -------------------------------------------------

  private applyMovement(
    crawler: CaveCrawlerState,
    intent: MovementIntent,
    dt: number
  ): void {
    const blend = Math.min(1, dt * MOVEMENT_RESPONSE);
    crawler.velocity.x += (intent.directionX * intent.speed - crawler.velocity.x) * blend;
    crawler.velocity.z += (intent.directionZ * intent.speed - crawler.velocity.z) * blend;
    crawler.velocity.y = Math.max(
      TERMINAL_VELOCITY,
      crawler.velocity.y - GRAVITY * dt
    );
    this.moveWithCollision(crawler, dt);
  }

  private moveWithCollision(crawler: CaveCrawlerState, dt: number): void {
    const nextY = crawler.position.y + crawler.velocity.y * dt;
    if (
      crawler.velocity.y < 0
      && isBlockSolid(this.world.getBlock(crawler.position.x, nextY - 0.02, crawler.position.z))
    ) {
      crawler.position.y = Math.floor(nextY - 0.02) + 1;
      crawler.velocity.y = 0;
      crawler.onGround = true;
    } else {
      crawler.position.y = nextY;
      crawler.onGround = false;
    }

    const nextX = crawler.position.x + crawler.velocity.x * dt;
    const nextZ = crawler.position.z + crawler.velocity.z * dt;
    if (this.canOccupy(nextX, crawler.position.y, nextZ, crawler.onGround)) {
      crawler.position.x = nextX;
      crawler.position.z = nextZ;
      return;
    }

    crawler.velocity.x *= -0.2;
    crawler.velocity.z *= -0.2;
    crawler.facingAngle += Math.PI * (0.6 + Math.random() * 0.8);
    crawler.decisionTimer = 0;
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

  private updateAnimation(crawler: CaveCrawlerState): void {
    updateCaveCrawlerVisual(crawler.visual, {
      age: crawler.age,
      hurt: crawler.hurtTimer > 0,
      position: crawler.position,
      velocity: crawler.velocity,
    });
  }

  // ---- Spawning ---------------------------------------------------------------

  private trySpawn(): void {
    if (!this.canSpawnMore() || this.vitals.dead || !this.playerIsUnderground()) return;
    const position = this.findSpawnPosition();
    if (position) this.spawn(position.x, position.y, position.z);
  }

  private canSpawnMore(): boolean {
    return this.crawlers.length < DEFINITION.maxPopulation;
  }

  private playerIsUnderground(): boolean {
    const playerX = Math.floor(this.player.position.x);
    const playerZ = Math.floor(this.player.position.z);
    const surface = this.world.terrainGen.getSurfaceHeight(playerX, playerZ);
    return this.player.position.y <= surface - REQUIRED_DEPTH_BELOW_SURFACE;
  }

  private findSpawnPosition(): THREE.Vector3 | null {
    for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = SPAWN_MINIMUM_RADIUS + Math.random() * SPAWN_RADIUS_VARIANCE;
      const x = Math.floor(this.player.position.x + Math.cos(angle) * radius);
      const z = Math.floor(this.player.position.z + Math.sin(angle) * radius);
      const topY = Math.floor(this.player.position.y + SPAWN_SCAN_ABOVE_PLAYER);
      const bottomY = this.player.position.y - SPAWN_SCAN_BELOW_PLAYER;

      for (let y = topY; y >= bottomY; y--) {
        if (this.isValidSpawnBlock(x, y, z)) {
          return new THREE.Vector3(x + 0.5, y, z + 0.5);
        }
      }
    }
    return null;
  }

  private isValidSpawnBlock(x: number, y: number, z: number): boolean {
    const skyLight = (this.world.getPackedLight(x, y, z) >> 4) & 0xf;
    if (skyLight > MAXIMUM_SPAWN_SKY_LIGHT) return false;
    return this.world.getBlock(x, y, z) === BlockId.Air
      && this.world.getBlock(x, y + 1, z) === BlockId.Air
      && isBlockSolid(this.world.getBlock(x, y - 1, z));
  }

  private spawn(x: number, y: number, z: number): void {
    const position = new THREE.Vector3(x, y, z);
    const visual = createCaveCrawlerVisual();
    visual.root.position.copy(position);
    this.scene.add(visual.root);

    // Preserve the established random sequence: animation phase, growl delay, then direction.
    const age = Math.random() * 5;
    const growlTimer = 1 + Math.random() * 5;
    const facingAngle = Math.random() * Math.PI * 2;
    this.crawlers.push({
      id: this.nextId++,
      health: DEFINITION.maxHealth,
      position,
      velocity: new THREE.Vector3(),
      onGround: false,
      activity: 'wandering',
      facingAngle,
      decisionTimer: 0,
      attackTimer: 0,
      age,
      growlTimer,
      hurtTimer: 0,
      visual,
    });
  }

  // ---- Combat and removal -----------------------------------------------------

  private applyDamage(
    crawler: CaveCrawlerState,
    amount: number,
    direction: THREE.Vector3
  ): void {
    crawler.health -= Math.max(1, amount);
    crawler.hurtTimer = HURT_INVULNERABILITY_SECONDS;
    crawler.velocity.x += direction.x * 3;
    crawler.velocity.y = 3;
    crawler.velocity.z += direction.z * 3;
    this.audio.playCaveCrawlerHit();
  }

  private killCrawler(index: number): void {
    const crawler = this.crawlers[index];
    this.audio.playCaveCrawlerDeath();
    this.particles.spawnBurst(
      crawler.position.x - 0.5,
      crawler.position.y,
      crawler.position.z - 0.5,
      BlockId.DeepSlate
    );
    for (const stack of rollMobLoot(DEFINITION.lootTable)) {
      this.drops.spawnDrop(
        crawler.position.x,
        crawler.position.y + 0.3,
        crawler.position.z,
        stack
      );
    }
    this.removeCrawler(index);
  }

  private hitBoxFor(crawler: CaveCrawlerState): THREE.Box3 {
    return new THREE.Box3(
      new THREE.Vector3(
        crawler.position.x - BODY_RADIUS,
        crawler.position.y,
        crawler.position.z - BODY_RADIUS
      ),
      new THREE.Vector3(
        crawler.position.x + BODY_RADIUS,
        crawler.position.y + BODY_HEIGHT,
        crawler.position.z + BODY_RADIUS
      )
    );
  }

  private describeHit(crawler: CaveCrawlerState, distance: number): CaveCrawlerHit {
    return {
      species: this.species,
      entityId: crawler.id,
      id: crawler.id,
      name: DEFINITION.name,
      distance,
      health: crawler.health,
      maxHealth: DEFINITION.maxHealth,
    };
  }

  private removeCrawler(index: number): void {
    const crawler = this.crawlers[index];
    this.scene.remove(crawler.visual.root);
    disposeCaveCrawlerVisual(crawler.visual);
    this.crawlers.splice(index, 1);
  }
}
