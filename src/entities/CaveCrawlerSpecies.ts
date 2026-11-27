import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { BlockId } from '../content/BlockId';
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
import {
  findGroundMobSpawn,
  MovementIntent,
  moveGroundMob,
} from './MobMechanics';
import {
  MobEntity,
  MobRuntime,
  SavedMobSnapshot,
  MobSpeciesBehavior,
  MobTag,
} from './MobTypes';

type CaveCrawlerActivity = 'wandering' | 'pursuing-player';

interface CaveCrawlerState {
  activity: CaveCrawlerActivity;
  facingAngle: number;
  decisionTimer: number;
  attackTimer: number;

  growlTimer: number;
}

type CaveCrawlerEntity = MobEntity<CaveCrawlerState, CaveCrawlerVisual>;

interface PlayerRelation {
  towardX: number;
  towardZ: number;
  horizontalDistance: number;
  verticalDistance: number;
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
const LINE_OF_SIGHT_TOLERANCE = 0.35;
const REQUIRED_DEPTH_BELOW_SURFACE = 7;
const MAXIMUM_SPAWN_SKY_LIGHT = 3;
const SPAWN_ATTEMPTS = 14;
const SPAWN_MINIMUM_RADIUS = 10;
const SPAWN_RADIUS_VARIANCE = 13;
const SPAWN_SCAN_ABOVE_PLAYER = 5;
const SPAWN_SCAN_BELOW_PLAYER = 7;
const HURT_INVULNERABILITY_SECONDS = 0.24;

const BODY_SHAPE = { radius: DEFINITION.radius, height: DEFINITION.height };

/**
 * Owns Cave Crawler-specific spawning, decisions, attacks, feedback, and visuals.
 *
 * Frame order: spawn scheduling → timers → sensing → behavior → attacks → movement → animation.
 * Behavior priority: pursue a visible living player; otherwise choose a wandering direction.
 */
export class CaveCrawlerSpecies implements MobSpeciesBehavior<CaveCrawlerState, CaveCrawlerVisual> {
  public readonly species = CAVE_CRAWLER_ID;
  public readonly name = DEFINITION.name;
  public readonly tags: ReadonlySet<MobTag> = new Set(DEFINITION.tags);
  public readonly maxHealth = DEFINITION.maxHealth;
  public readonly radius = DEFINITION.radius;
  public readonly height = DEFINITION.height;
  public readonly hurtInvulnerabilitySeconds = HURT_INVULNERABILITY_SECONDS;

  private spawnTimer = INITIAL_SPAWN_DELAY;

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

  public updateSpawning(dt: number, runtime: MobRuntime): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;

    this.spawnTimer = DEFINITION.spawnDelay.minimum
      + Math.random() * DEFINITION.spawnDelay.variance;
    this.trySpawn(runtime);
  }

  public update(crawler: CaveCrawlerEntity, dt: number, runtime: MobRuntime): void {
    crawler.state.attackTimer = Math.max(0, crawler.state.attackTimer - dt);
    crawler.state.decisionTimer -= dt;
    crawler.state.growlTimer -= dt;

    const player = this.relationToPlayer(crawler);
    if (player.horizontalDistance > DEFINITION.despawnDistance) {
      runtime.remove(crawler.id);
      return;
    }

    const movement = this.chooseMovement(crawler, player);
    this.applyMovement(crawler, movement, dt);
    this.updateAnimation(crawler);
  }

  // ---- Per-frame sensing ------------------------------------------------------

  private relationToPlayer(crawler: CaveCrawlerEntity): PlayerRelation {
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
    crawler: CaveCrawlerEntity,
    player: PlayerRelation
  ): MovementIntent {
    if (this.canPursuePlayer(crawler, player)) {
      return this.pursuePlayer(crawler, player);
    }
    return this.wander(crawler);
  }

  private canPursuePlayer(
    crawler: CaveCrawlerEntity,
    player: PlayerRelation
  ): boolean {
    return player.horizontalDistance < PLAYER_SIGHT_DISTANCE
      && this.hasLineOfSight(crawler, player.horizontalDistance)
      && !this.vitals.dead;
  }

  private pursuePlayer(
    crawler: CaveCrawlerEntity,
    player: PlayerRelation
  ): MovementIntent {
    const inverseDistance = 1 / Math.max(0.001, player.horizontalDistance);
    const directionX = player.towardX * inverseDistance;
    const directionZ = player.towardZ * inverseDistance;

    crawler.state.activity = 'pursuing-player';
    crawler.state.facingAngle = Math.atan2(directionX, directionZ);
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

  private wander(crawler: CaveCrawlerEntity): MovementIntent {
    crawler.state.activity = 'wandering';
    if (crawler.state.decisionTimer <= 0) {
      crawler.state.facingAngle += (Math.random() - 0.5) * Math.PI * 1.7;
      crawler.state.decisionTimer = 1.2 + Math.random() * 3.5;
    }
    return {
      directionX: Math.sin(crawler.state.facingAngle),
      directionZ: Math.cos(crawler.state.facingAngle),
      speed: WANDER_SPEED,
    };
  }

  private tryGrowl(crawler: CaveCrawlerEntity, playerDistance: number): void {
    if (crawler.state.growlTimer > 0 || playerDistance >= GROWL_DISTANCE) return;
    crawler.state.growlTimer = 4 + Math.random() * 7;
    this.audio.playCaveCrawlerGrowl();
  }

  private tryAttackPlayer(
    crawler: CaveCrawlerEntity,
    player: PlayerRelation,
    directionX: number,
    directionZ: number
  ): void {
    const inMeleeRange = player.horizontalDistance < ATTACK_DISTANCE
      && player.verticalDistance < ATTACK_MAXIMUM_HEIGHT_DIFFERENCE;
    if (!inMeleeRange || crawler.state.attackTimer > 0) return;

    crawler.state.attackTimer = ATTACK_COOLDOWN_SECONDS;
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

  private hasLineOfSight(crawler: CaveCrawlerEntity, distance: number): boolean {
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
    crawler: CaveCrawlerEntity,
    intent: MovementIntent,
    dt: number
  ): void {
    const result = moveGroundMob(
      crawler,
      intent,
      BODY_SHAPE,
      this.world,
      dt,
      { response: MOVEMENT_RESPONSE }
    );
    if (!result.collidedHorizontally) return;

    // A blocked crawler rebounds and immediately chooses a new wandering direction.
    crawler.velocity.x *= -0.2;
    crawler.velocity.z *= -0.2;
    crawler.state.facingAngle += Math.PI * (0.6 + Math.random() * 0.8);
    crawler.state.decisionTimer = 0;
  }

  private updateAnimation(crawler: CaveCrawlerEntity): void {
    updateCaveCrawlerVisual(crawler.visual, {
      age: crawler.age,
      hurt: crawler.hurtTimer > 0,
      position: crawler.position,
      velocity: crawler.velocity,
    });
  }

  // ---- Spawning ---------------------------------------------------------------

  private trySpawn(runtime: MobRuntime): void {
    if (!this.canSpawnMore(runtime) || this.vitals.dead || !this.playerIsUnderground()) return;
    const position = this.findSpawnPosition();
    if (position) this.spawn(position, runtime);
  }

  private canSpawnMore(runtime: MobRuntime): boolean {
    return runtime.countSpecies(this.species) < DEFINITION.maxPopulation;
  }

  private playerIsUnderground(): boolean {
    const playerX = Math.floor(this.player.position.x);
    const playerZ = Math.floor(this.player.position.z);
    const surface = this.world.terrainGen.getSurfaceHeight(playerX, playerZ);
    return this.player.position.y <= surface - REQUIRED_DEPTH_BELOW_SURFACE;
  }

  private findSpawnPosition(): THREE.Vector3 | null {
    return findGroundMobSpawn(this.world, this.player.position, {
      attempts: SPAWN_ATTEMPTS,
      minimumRadius: SPAWN_MINIMUM_RADIUS,
      radiusVariance: SPAWN_RADIUS_VARIANCE,
      scanAbove: SPAWN_SCAN_ABOVE_PLAYER,
      scanBelow: SPAWN_SCAN_BELOW_PLAYER,
      acceptsCandidate: (x, y, z) => this.hasLowEnoughSkyLight(x, y, z),
    });
  }

  private hasLowEnoughSkyLight(x: number, y: number, z: number): boolean {
    const skyLight = (this.world.getPackedLight(x, y, z) >> 4) & 0xf;
    return skyLight <= MAXIMUM_SPAWN_SKY_LIGHT;
  }

  private spawn(position: THREE.Vector3, runtime: MobRuntime): void {
    const visual = createCaveCrawlerVisual();
    visual.root.position.copy(position);
    this.scene.add(visual.root);

    // Preserve the established random sequence: animation phase, growl delay, then direction.
    const age = Math.random() * 5;
    const growlTimer = 1 + Math.random() * 5;
    const facingAngle = Math.random() * Math.PI * 2;
    runtime.spawn(this, {
      position,
      age,
      state: {
        activity: 'wandering',
        facingAngle,
        decisionTimer: 0,
        attackTimer: 0,
        growlTimer,
      },
      visual,
    });
  }

  public saveState(crawler: CaveCrawlerEntity): unknown {
    return { ...crawler.state };
  }

  public restore(snapshot: SavedMobSnapshot, runtime: MobRuntime): void {
    const saved = snapshot.state && typeof snapshot.state === 'object'
      ? snapshot.state as Record<string, unknown>
      : {};
    const position = new THREE.Vector3(...snapshot.position);
    const visual = createCaveCrawlerVisual();
    visual.root.position.copy(position);
    this.scene.add(visual.root);
    runtime.spawn(this, {
      id: snapshot.id,
      position,
      velocity: new THREE.Vector3(...snapshot.velocity),
      health: snapshot.health,
      age: snapshot.age,
      hurtTimer: snapshot.hurtTimer,
      state: {
        activity: saved.activity === 'pursuing-player' ? 'pursuing-player' : 'wandering',
        facingAngle: Number(saved.facingAngle) || 0,
        decisionTimer: Number(saved.decisionTimer) || 0,
        attackTimer: Math.max(0, Number(saved.attackTimer) || 0),
        growlTimer: Number(saved.growlTimer) || 1,
      },
      visual,
    });
  }

  // ---- Combat and removal -----------------------------------------------------

  public onDamaged(
    crawler: CaveCrawlerEntity,
    direction: THREE.Vector3,
    _runtime: MobRuntime
  ): void {
    crawler.velocity.x += direction.x * 3;
    crawler.velocity.y = 3;
    crawler.velocity.z += direction.z * 3;
    this.audio.playCaveCrawlerHit();
  }

  public onDeath(crawler: CaveCrawlerEntity, _runtime: MobRuntime): void {
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
  }

  public dispose(crawler: CaveCrawlerEntity): void {
    this.scene.remove(crawler.visual.root);
    disposeCaveCrawlerVisual(crawler.visual);
  }
}
