import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { BlockId } from '../content/BlockId';
import { CRYSTAL_MITE_ID, MOB_DEFINITIONS } from '../content/mobs/MobDefinitions';
import { rollMobLoot } from '../content/loot/MobLoot';
import { Player } from '../player/Player';
import { BreakParticles } from '../rendering/BreakParticles';
import { DroppedItemManager } from '../rendering/DroppedItems';
import { World } from '../world/World';
import {
  findGroundMobSpawn,
  MovementIntent,
  moveGroundMob,
} from './MobMechanics';
import {
  MobEntity,
  MobRuntime,
  MobSpeciesBehavior,
  MobTag,
} from './MobTypes';
import {
  CrystalMiteVisual,
  createCrystalMiteVisual,
  disposeCrystalMiteVisual,
  updateCrystalMiteVisual,
} from './CrystalMiteVisual';

type CrystalMiteActivity = 'idle' | 'wandering' | 'inspecting-crystal' | 'fleeing-player';

interface CrystalMiteState {
  activity: CrystalMiteActivity;
  activityTimer: number;
  facingAngle: number;
  targetCrystal: THREE.Vector3 | null;

  chirpTimer: number;
}

type CrystalMiteEntity = MobEntity<CrystalMiteState, CrystalMiteVisual>;

interface PlayerRelation {
  awayX: number;
  awayZ: number;
  distance: number;
}

const DEFINITION = MOB_DEFINITIONS[CRYSTAL_MITE_ID];

const INITIAL_SPAWN_DELAY = 1.2;
const PLAYER_FLEE_DISTANCE = 4.8;
const CRYSTAL_REACHED_DISTANCE = 0.75;
const WANDER_STOP_SECONDS = 0.7;
const WANDER_SPEED = 0.72;
const FLEE_SPEED = 2.25;
const MOVEMENT_RESPONSE = 5.5;
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

const BODY_SHAPE = { radius: DEFINITION.radius, height: DEFINITION.height };

const NO_MOVEMENT: MovementIntent = { directionX: 0, directionZ: 0, speed: 0 };

/**
 * Owns Crystal Mite-specific spawning, decisions, feedback, and visuals.
 *
 * Frame order: spawn scheduling → timers → sensing → behavior → movement → animation → sound.
 * Behavior priority: flee nearby players, otherwise inspect crystals, otherwise wander or idle.
 */
export class CrystalMiteSpecies implements MobSpeciesBehavior<CrystalMiteState, CrystalMiteVisual> {
  public readonly species = CRYSTAL_MITE_ID;
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
    private readonly drops: DroppedItemManager,
    private readonly particles: BreakParticles,
    private readonly audio: AudioManager
  ) {}

  // ---- Public species contract ------------------------------------------------

  public updateSpawning(dt: number, runtime: MobRuntime): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;

    this.spawnTimer = DEFINITION.spawnDelay.minimum
      + Math.random() * DEFINITION.spawnDelay.variance;
    this.trySpawn(runtime);
  }

  public update(mite: CrystalMiteEntity, dt: number, runtime: MobRuntime): void {
    mite.state.activityTimer -= dt;
    mite.state.chirpTimer -= dt;

    const player = this.relationToPlayer(mite);
    if (player.distance > DEFINITION.despawnDistance) {
      runtime.remove(mite.id);
      return;
    }

    const movement = this.chooseMovement(mite, player);
    this.applyMovement(mite, movement, dt);
    this.updateAnimation(mite);
    this.updateChirping(mite, player.distance);
  }

  // ---- Per-frame sensing ------------------------------------------------------

  private relationToPlayer(mite: CrystalMiteEntity): PlayerRelation {
    const awayX = mite.position.x - this.player.position.x;
    const awayZ = mite.position.z - this.player.position.z;
    return { awayX, awayZ, distance: Math.hypot(awayX, awayZ) };
  }

  // ---- Behavior ---------------------------------------------------------------

  private chooseMovement(mite: CrystalMiteEntity, player: PlayerRelation): MovementIntent {
    if (player.distance < PLAYER_FLEE_DISTANCE) {
      return this.fleeFromPlayer(mite, player);
    }

    if (mite.state.activityTimer <= 0) this.chooseNewActivity(mite);
    if (mite.state.targetCrystal) return this.moveTowardCrystal(mite);
    if (mite.state.activityTimer > WANDER_STOP_SECONDS) return this.wander(mite);

    mite.state.activity = 'idle';
    return NO_MOVEMENT;
  }

  private fleeFromPlayer(
    mite: CrystalMiteEntity,
    player: PlayerRelation
  ): MovementIntent {
    const inverseDistance = 1 / Math.max(0.001, player.distance);
    mite.state.activity = 'fleeing-player';
    mite.state.targetCrystal = null;
    return {
      directionX: player.awayX * inverseDistance,
      directionZ: player.awayZ * inverseDistance,
      speed: FLEE_SPEED,
    };
  }

  private moveTowardCrystal(mite: CrystalMiteEntity): MovementIntent {
    const targetX = mite.state.targetCrystal!.x - mite.position.x;
    const targetZ = mite.state.targetCrystal!.z - mite.position.z;
    const distance = Math.hypot(targetX, targetZ);

    if (distance < CRYSTAL_REACHED_DISTANCE) {
      mite.state.activity = 'idle';
      mite.state.targetCrystal = null;
      mite.state.activityTimer = 1.2 + Math.random() * 2.4;
      return NO_MOVEMENT;
    }

    mite.state.activity = 'inspecting-crystal';
    return {
      directionX: targetX / distance,
      directionZ: targetZ / distance,
      speed: WANDER_SPEED,
    };
  }

  private wander(mite: CrystalMiteEntity): MovementIntent {
    mite.state.activity = 'wandering';
    return {
      directionX: Math.sin(mite.state.facingAngle),
      directionZ: Math.cos(mite.state.facingAngle),
      speed: WANDER_SPEED,
    };
  }

  private chooseNewActivity(mite: CrystalMiteEntity): void {
    mite.state.targetCrystal = Math.random() < CRYSTAL_INSPECTION_CHANCE
      ? this.findNearbyCrystal(mite.position)
      : null;
    mite.state.facingAngle = Math.random() * Math.PI * 2;
    mite.state.activity = mite.state.targetCrystal ? 'inspecting-crystal' : 'wandering';
    mite.state.activityTimer = mite.state.targetCrystal
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
    mite: CrystalMiteEntity,
    intent: MovementIntent,
    dt: number
  ): void {
    const result = moveGroundMob(
      mite,
      intent,
      BODY_SHAPE,
      this.world,
      dt,
      { response: MOVEMENT_RESPONSE }
    );
    if (!result.collidedHorizontally) return;

    // A blocked mite abandons inspection and pauses before choosing another activity.
    mite.velocity.x *= -0.25;
    mite.velocity.z *= -0.25;
    mite.state.facingAngle += Math.PI * (0.55 + Math.random() * 0.9);
    mite.state.activity = 'idle';
    mite.state.activityTimer = 0.6;
    mite.state.targetCrystal = null;
  }

  private updateAnimation(mite: CrystalMiteEntity): void {
    updateCrystalMiteVisual(mite.visual, {
      id: mite.id,
      age: mite.age,
      hurt: mite.hurtTimer > 0,
      position: mite.position,
      velocity: mite.velocity,
    });
  }

  private updateChirping(mite: CrystalMiteEntity, playerDistance: number): void {
    if (mite.state.chirpTimer > 0 || playerDistance >= CHIRP_DISTANCE) return;
    mite.state.chirpTimer = 4 + Math.random() * 9;
    this.audio.playCrystalMiteChirp();
  }

  // ---- Spawning ---------------------------------------------------------------

  private trySpawn(runtime: MobRuntime): void {
    if (!this.canSpawnMore(runtime) || !this.playerIsUnderground()) return;
    const position = this.findSpawnPosition(runtime);
    if (position) this.spawnMite(position, runtime);
  }

  private canSpawnMore(runtime: MobRuntime): boolean {
    return runtime.countSpecies(this.species) < DEFINITION.maxPopulation;
  }

  private playerIsUnderground(): boolean {
    const playerX = Math.floor(this.player.position.x);
    const playerZ = Math.floor(this.player.position.z);
    const surface = this.world.terrainGen.getSurfaceHeight(playerX, playerZ);
    return this.player.position.y <= surface - DESPAWN_DEPTH_BELOW_SURFACE;
  }

  private findSpawnPosition(runtime: MobRuntime): THREE.Vector3 | null {
    const position = findGroundMobSpawn(this.world, this.player.position, {
      attempts: SPAWN_ATTEMPTS,
      minimumRadius: SPAWN_MINIMUM_RADIUS,
      radiusVariance: SPAWN_RADIUS_VARIANCE,
      scanAbove: SPAWN_SCAN_ABOVE_PLAYER,
      scanBelow: SPAWN_SCAN_BELOW_PLAYER,
      acceptsColumn: (x, z) => this.biomeAllowsSpawn(x, z),
    });
    return position && !runtime.hasSpeciesWithinHorizontal(
      this.species,
      position,
      MINIMUM_SPAWN_SPACING
    ) ? position : null;
  }

  private biomeAllowsSpawn(x: number, z: number): boolean {
    const biome = this.world.terrainGen.getCavernBiome(x, z);
    return biome === 'Crystal Geode Hall' || Math.random() <= GEODE_SPAWN_CHANCE_ELSEWHERE;
  }

  private spawnMite(position: THREE.Vector3, runtime: MobRuntime): void {
    const visual = createCrystalMiteVisual();
    visual.root.position.copy(position);
    this.scene.add(visual.root);

    runtime.spawn(this, {
      position,
      age: Math.random() * 8,
      state: {
        chirpTimer: 2 + Math.random() * 7,
        activity: 'idle',
        activityTimer: 0,
        facingAngle: Math.random() * Math.PI * 2,
        targetCrystal: null,
      },
      visual,
    });
  }

  // ---- Combat and removal -----------------------------------------------------

  public onDamaged(
    mite: CrystalMiteEntity,
    direction: THREE.Vector3,
    _runtime: MobRuntime
  ): void {
    mite.velocity.x += direction.x * 3.8;
    mite.velocity.y = 3.3;
    mite.velocity.z += direction.z * 3.8;
    mite.state.activity = 'idle';
    mite.state.activityTimer = 0;
    this.audio.playCrystalMiteHit();
  }

  public onDeath(mite: CrystalMiteEntity, _runtime: MobRuntime): void {
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
  }

  public dispose(mite: CrystalMiteEntity): void {
    this.scene.remove(mite.visual.root);
    disposeCrystalMiteVisual(mite.visual);
  }
}
