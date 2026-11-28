import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { BlockId } from '../content/BlockId';
import { rollMobLoot } from '../content/loot/MobLoot';
import { MOB_DEFINITIONS, POLAR_BEAR_ID } from '../content/mobs/MobDefinitions';
import { ItemId, ItemStack } from '../items/Item';
import { Player } from '../player/Player';
import { PlayerVitals } from '../player/PlayerVitals';
import { BreakParticles } from '../rendering/BreakParticles';
import { DroppedItemManager } from '../rendering/DroppedItems';
import { World } from '../world/World';
import { findGroundMobSpawn, moveGroundMob } from './MobMechanics';
import {
  MobEntity,
  MobInteractionResult,
  MobRuntime,
  MobSpeciesBehavior,
  MobTag,
  SavedMobSnapshot,
} from './MobTypes';
import {
  PolarBearVisual,
  createPolarBearVisual,
  disposePolarBearVisual,
  updatePolarBearVisual,
} from './PolarBearVisual';

export interface PolarBearState {
  facingAngle: number;
  decisionTimer: number;
  angerTimer: number;
  attackTimer: number;
  rearTimer: number;
  soundTimer: number;
  growthRemaining: number;
  fleeTimer: number;
  persistent?: boolean;
}

export type PolarBearEntity = MobEntity<PolarBearState, PolarBearVisual>;

const DEFINITION = MOB_DEFINITIONS[POLAR_BEAR_ID];
const INITIAL_SPAWN_DELAY = 3.2;
const SPAWN_ATTEMPTS = 14;
const SPAWN_MINIMUM_RADIUS = 12;
const SPAWN_RADIUS_VARIANCE = 16;
const SPAWN_SCAN_ABOVE_PLAYER = 6;
const SPAWN_SCAN_BELOW_PLAYER = 8;
const MINIMUM_SPAWN_SPACING = 11;
const CUB_SPAWN_CHANCE = 0.35;
const BABY_GROWTH_SECONDS = 300;
const WANDER_SPEED = 1.55;
const PURSUIT_SPEED = 4.05;
const CUB_FOLLOW_SPEED = 2.6;
const CUB_FLEE_SPEED = 3.35;
const MOVEMENT_RESPONSE = 5.5;
const CUB_PROTECT_DISTANCE = 5.5;
const PARENT_PROTECT_RADIUS = 12;
const PACK_ALERT_RADIUS = 14;
const PROVOKE_ANGER_SECONDS = 22;
const PROTECT_ANGER_SECONDS = 4;
const ATTACK_DISTANCE = 2.35;
const ATTACK_DAMAGE = 5;
const ATTACK_COOLDOWN_SECONDS = 1.35;
const REAR_DURATION_SECONDS = 0.55;
const AMBIENT_SOUND_DISTANCE = 18;
const HURT_INVULNERABILITY_SECONDS = 0.3;

const COLD_GROUND_BLOCKS = new Set<BlockId>([
  BlockId.SnowGrass,
  BlockId.SnowBlock,
  BlockId.Stone,
]);

function savedNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Arctic neutral wildlife: peaceful wanderers in cold biomes that defend their cubs
 * and retaliate with a rearing paw swipe when provoked.
 */
export class PolarBearSpecies
implements MobSpeciesBehavior<PolarBearState, PolarBearVisual> {
  public readonly species = DEFINITION.id;
  public readonly name = DEFINITION.name;
  public readonly tags: ReadonlySet<MobTag> = new Set(DEFINITION.tags);
  public readonly maxHealth = DEFINITION.maxHealth;
  public readonly radius = DEFINITION.radius;
  public readonly height = DEFINITION.height;
  public readonly hurtInvulnerabilitySeconds = HURT_INVULNERABILITY_SECONDS;

  private spawnTimer = INITIAL_SPAWN_DELAY;

  public constructor(
    private readonly scene: THREE.Scene,
    private readonly world: World,
    private readonly player: Player,
    private readonly vitals: PlayerVitals,
    private readonly drops: DroppedItemManager,
    private readonly particles: BreakParticles,
    private readonly audio: AudioManager
  ) {}

  public updateSpawning(dt: number, runtime: MobRuntime): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;

    this.spawnTimer = DEFINITION.spawnDelay.minimum
      + Math.random() * DEFINITION.spawnDelay.variance;
    this.trySpawn(runtime);
  }

  public update(bear: PolarBearEntity, dt: number, runtime: MobRuntime): void {
    bear.state.decisionTimer -= dt;
    bear.state.soundTimer -= dt;
    bear.state.attackTimer = Math.max(0, bear.state.attackTimer - dt);
    bear.state.angerTimer = Math.max(0, bear.state.angerTimer - dt);
    bear.state.rearTimer = Math.max(0, bear.state.rearTimer - dt);
    bear.state.fleeTimer = Math.max(0, bear.state.fleeTimer - dt);
    bear.state.growthRemaining = Math.max(0, bear.state.growthRemaining - dt);

    const towardX = this.player.position.x - bear.position.x;
    const towardZ = this.player.position.z - bear.position.z;
    const distance = Math.hypot(towardX, towardZ);

    if (distance > DEFINITION.despawnDistance && !bear.state.persistent) {
      runtime.remove(bear.id);
      return;
    }

    const isBaby = bear.state.growthRemaining > 0;
    if (!isBaby && !this.vitals.dead) {
      this.checkCubProtection(bear, runtime);
    }

    const intent = isBaby
      ? this.chooseCubIntent(bear, towardX, towardZ, runtime)
      : this.chooseAdultIntent(bear, towardX, towardZ, distance);

    // Polar bears are natural swimmers in arctic waters.
    const bodyBlock = this.world.getBlock(bear.position.x, bear.position.y + 0.45, bear.position.z);
    if (bodyBlock === BlockId.Water) {
      bear.velocity.y = Math.min(2.6, bear.velocity.y + 28 * dt);
    }

    const result = moveGroundMob(
      bear,
      intent,
      { radius: this.radius * (isBaby ? 0.6 : 1), height: this.height * (isBaby ? 0.6 : 1) },
      this.world,
      dt,
      { response: MOVEMENT_RESPONSE }
    );
    if (result.collidedHorizontally && bear.onGround) {
      if (bear.state.angerTimer > 0 && !isBaby) {
        bear.velocity.y = 7.2;
        bear.onGround = false;
      } else {
        bear.state.facingAngle += Math.PI * (0.65 + Math.random() * 0.7);
        bear.state.decisionTimer = 1 + Math.random() * 1.5;
      }
    }

    updatePolarBearVisual(bear.visual, {
      age: bear.age,
      hurt: bear.hurtTimer > 0,
      baby: isBaby,
      rearAmount: bear.state.rearTimer / REAR_DURATION_SECONDS,
      facingAngle: bear.state.facingAngle,
      position: bear.position,
      velocity: bear.velocity,
    });

    if (bear.state.soundTimer <= 0 && distance < AMBIENT_SOUND_DISTANCE) {
      bear.state.soundTimer = bear.state.angerTimer > 0
        ? 3.2 + Math.random() * 3.5
        : 7 + Math.random() * 10;
      if (bear.state.angerTimer > 0 && !isBaby) this.audio.playPolarBearRoar();
      else this.audio.playPolarBearGrowl();
    }
  }

  public interact(
    bear: PolarBearEntity,
    held: ItemStack | null,
    creativeMode: boolean
  ): MobInteractionResult | null {
    if (!held || held.id !== ItemId.RawRiverFish) return null;

    const isBaby = bear.state.growthRemaining > 0;
    if (isBaby) {
      bear.state.growthRemaining = Math.max(0, bear.state.growthRemaining - 60);
      bear.state.persistent = true;
      this.audio.playPolarBearGrowl();
      return { consumeHeld: !creativeMode, swing: true };
    }

    const wasAngry = bear.state.angerTimer > 0;
    const injured = bear.health < this.maxHealth;
    if (!wasAngry && !injured) return null;

    bear.state.angerTimer = 0;
    bear.state.rearTimer = 0;
    bear.state.persistent = true;
    bear.health = Math.min(this.maxHealth, bear.health + 4);
    this.audio.playPolarBearGrowl();
    return { consumeHeld: !creativeMode, swing: true };
  }

  public onDamaged(
    bear: PolarBearEntity,
    direction: THREE.Vector3,
    runtime: MobRuntime
  ): void {
    bear.velocity.x = direction.x * 3.8;
    bear.velocity.y = 3.2;
    bear.velocity.z = direction.z * 3.8;
    bear.onGround = false;
    this.audio.playPolarBearHit();

    if (bear.state.growthRemaining > 0) {
      bear.state.fleeTimer = 5;
    } else {
      bear.state.angerTimer = PROVOKE_ANGER_SECONDS;
      bear.state.rearTimer = REAR_DURATION_SECONDS;
    }

    // Alert nearby adult polar bears to defend themselves or their cub.
    for (const nearby of runtime.entitiesOfSpeciesWithin(this.species, bear.position, PACK_ALERT_RADIUS)) {
      const other = nearby as PolarBearEntity;
      if (other.id === bear.id || other.state.growthRemaining > 0) continue;
      other.state.angerTimer = Math.max(other.state.angerTimer, PROVOKE_ANGER_SECONDS);
    }
  }

  public onDeath(bear: PolarBearEntity): void {
    this.audio.playPolarBearDeath();
    this.particles.spawnBurst(
      Math.floor(bear.position.x),
      Math.floor(bear.position.y + 0.5),
      Math.floor(bear.position.z),
      BlockId.SnowBlock
    );
    if (bear.state.growthRemaining > 0) return;

    for (const drop of rollMobLoot(DEFINITION.lootTable)) {
      this.drops.spawnDrop(bear.position.x, bear.position.y + 0.4, bear.position.z, drop);
    }
  }

  public dispose(bear: PolarBearEntity): void {
    this.scene.remove(bear.visual.root);
    disposePolarBearVisual(bear.visual);
  }

  public saveState(bear: PolarBearEntity): unknown {
    return {
      facingAngle: bear.state.facingAngle,
      angerTimer: bear.state.angerTimer,
      growthRemaining: bear.state.growthRemaining,
      persistent: Boolean(bear.state.persistent),
    };
  }

  public restore(snapshot: SavedMobSnapshot, runtime: MobRuntime): void {
    const state = typeof snapshot.state === 'object' && snapshot.state !== null
      ? snapshot.state as Partial<PolarBearState>
      : {};
    const visual = createPolarBearVisual();
    this.scene.add(visual.root);

    const growthRemaining = Math.max(0, savedNumber(state.growthRemaining, 0));
    const entity = runtime.spawn(this, {
      id: snapshot.id,
      position: new THREE.Vector3(...snapshot.position),
      velocity: new THREE.Vector3(...snapshot.velocity),
      health: Math.max(1, Math.min(this.maxHealth, snapshot.health)),
      age: Math.max(0, snapshot.age),
      hurtTimer: Math.max(0, snapshot.hurtTimer),
      state: {
        facingAngle: savedNumber(state.facingAngle, 0),
        decisionTimer: 1 + Math.random() * 2,
        angerTimer: Math.max(0, savedNumber(state.angerTimer, 0)),
        attackTimer: 0,
        rearTimer: 0,
        soundTimer: 4 + Math.random() * 6,
        growthRemaining,
        fleeTimer: 0,
        persistent: Boolean(state.persistent),
      },
      visual,
    });
    updatePolarBearVisual(entity.visual, {
      age: entity.age,
      hurt: entity.hurtTimer > 0,
      baby: growthRemaining > 0,
      rearAmount: 0,
      facingAngle: entity.state.facingAngle,
      position: entity.position,
      velocity: entity.velocity,
    });
  }

  private trySpawn(runtime: MobRuntime): void {
    if (
      runtime.countSpecies(this.species) >= DEFINITION.maxPopulation
      || !this.playerIsNearSurface()
    ) return;

    const spot = findGroundMobSpawn(this.world, this.player.position, {
      attempts: SPAWN_ATTEMPTS,
      minimumRadius: SPAWN_MINIMUM_RADIUS,
      radiusVariance: SPAWN_RADIUS_VARIANCE,
      scanAbove: SPAWN_SCAN_ABOVE_PLAYER,
      scanBelow: SPAWN_SCAN_BELOW_PLAYER,
      acceptsColumn: (x, z) => this.columnAllowsSpawn(x, z),
      acceptsCandidate: (x, y, z) => COLD_GROUND_BLOCKS.has(this.world.getBlock(x, y - 1, z)),
    });
    if (!spot || runtime.hasSpeciesWithinHorizontal(
      this.species,
      spot,
      MINIMUM_SPAWN_SPACING
    )) return;

    this.spawnBear(runtime, spot, 0);

    // Arctic family group: occasionally spawn a cub beside the adult.
    if (
      runtime.countSpecies(this.species) < DEFINITION.maxPopulation
      && Math.random() < CUB_SPAWN_CHANCE
    ) {
      const cubSpot = new THREE.Vector3(spot.x + 1.1, spot.y, spot.z + 0.6);
      if (
        this.world.getBlock(cubSpot.x, cubSpot.y, cubSpot.z) === BlockId.Air
        && this.world.getBlock(cubSpot.x, cubSpot.y + 1, cubSpot.z) === BlockId.Air
      ) {
        this.spawnBear(runtime, cubSpot, BABY_GROWTH_SECONDS);
      }
    }
  }

  private playerIsNearSurface(): boolean {
    const x = Math.floor(this.player.position.x);
    const z = Math.floor(this.player.position.z);
    const surface = this.world.terrainGen.getSurfaceHeight(x, z);
    return this.player.position.y >= surface - 2;
  }

  private columnAllowsSpawn(x: number, z: number): boolean {
    const surface = this.world.terrainGen.getSurfaceHeight(x, z);
    return this.world.terrainGen
      .getSurfaceBiomeDefinition(x, z, surface)
      .tags.includes('cold');
  }

  private spawnBear(
    runtime: MobRuntime,
    position: THREE.Vector3,
    growthRemaining: number
  ): PolarBearEntity {
    const visual = createPolarBearVisual();
    this.scene.add(visual.root);
    const facingAngle = Math.random() * Math.PI * 2;
    const entity = runtime.spawn(this, {
      position,
      health: this.maxHealth,
      state: {
        facingAngle,
        decisionTimer: 1.5 + Math.random() * 3.5,
        angerTimer: 0,
        attackTimer: 0,
        rearTimer: 0,
        soundTimer: 5 + Math.random() * 8,
        growthRemaining,
        fleeTimer: 0,
      },
      visual,
    });
    updatePolarBearVisual(entity.visual, {
      age: 0,
      hurt: false,
      baby: growthRemaining > 0,
      rearAmount: 0,
      facingAngle,
      position: entity.position,
      velocity: entity.velocity,
    });
    return entity;
  }

  private checkCubProtection(adult: PolarBearEntity, runtime: MobRuntime): void {
    const nearbyBears = runtime.entitiesOfSpeciesWithin(
      this.species,
      adult.position,
      PARENT_PROTECT_RADIUS
    );
    for (const candidate of nearbyBears) {
      const cub = candidate as PolarBearEntity;
      if (cub.id === adult.id || cub.state.growthRemaining <= 0) continue;
      const distToCub = cub.position.distanceTo(this.player.position);
      if (distToCub < CUB_PROTECT_DISTANCE) {
        if (adult.state.angerTimer <= 0) {
          adult.state.rearTimer = REAR_DURATION_SECONDS;
          this.audio.playPolarBearRoar();
        }
        adult.state.angerTimer = Math.max(adult.state.angerTimer, PROTECT_ANGER_SECONDS);
        return;
      }
    }
  }

  private chooseAdultIntent(
    bear: PolarBearEntity,
    towardX: number,
    towardZ: number,
    distance: number
  ): { directionX: number; directionZ: number; speed: number } {
    if (!this.vitals.dead && bear.state.angerTimer > 0 && distance < 22) {
      const inv = 1 / Math.max(0.001, distance);
      const directionX = towardX * inv;
      const directionZ = towardZ * inv;
      bear.state.facingAngle = Math.atan2(directionX, directionZ);

      if (distance < ATTACK_DISTANCE && Math.abs(this.player.position.y - bear.position.y) < 1.8) {
        this.tryAttack(bear, directionX, directionZ);
      }
      return { directionX, directionZ, speed: PURSUIT_SPEED };
    }

    return this.chooseWanderIntent(bear);
  }

  private chooseCubIntent(
    cub: PolarBearEntity,
    towardX: number,
    towardZ: number,
    runtime: MobRuntime
  ): { directionX: number; directionZ: number; speed: number } {
    if (cub.state.fleeTimer > 0) {
      const dist = Math.max(0.001, Math.hypot(towardX, towardZ));
      const directionX = -towardX / dist;
      const directionZ = -towardZ / dist;
      cub.state.facingAngle = Math.atan2(directionX, directionZ);
      return { directionX, directionZ, speed: CUB_FLEE_SPEED };
    }

    // Stay near an adult polar bear when one is around.
    let nearestAdult: PolarBearEntity | null = null;
    let nearestDistSq = 18 * 18;
    for (const candidate of runtime.entitiesOfSpeciesWithin(this.species, cub.position, 18)) {
      const adult = candidate as PolarBearEntity;
      if (adult.id === cub.id || adult.state.growthRemaining > 0) continue;
      const dSq = cub.position.distanceToSquared(adult.position);
      if (dSq < nearestDistSq) {
        nearestDistSq = dSq;
        nearestAdult = adult;
      }
    }
    if (nearestAdult && nearestDistSq > 3.2 * 3.2) {
      const dx = nearestAdult.position.x - cub.position.x;
      const dz = nearestAdult.position.z - cub.position.z;
      const dist = Math.max(0.001, Math.hypot(dx, dz));
      cub.state.facingAngle = Math.atan2(dx, dz);
      return { directionX: dx / dist, directionZ: dz / dist, speed: CUB_FOLLOW_SPEED };
    }

    return this.chooseWanderIntent(cub);
  }

  private chooseWanderIntent(
    bear: PolarBearEntity
  ): { directionX: number; directionZ: number; speed: number } {
    if (bear.state.decisionTimer <= 0) {
      bear.state.decisionTimer = 2 + Math.random() * 4;
      if (Math.random() < 0.35) {
        // Brief calm pause in the snow.
        return { directionX: 0, directionZ: 0, speed: 0 };
      }
      bear.state.facingAngle += (Math.random() - 0.5) * Math.PI * 1.4;
    }

    return {
      directionX: Math.sin(bear.state.facingAngle),
      directionZ: Math.cos(bear.state.facingAngle),
      speed: WANDER_SPEED,
    };
  }

  private tryAttack(
    bear: PolarBearEntity,
    directionX: number,
    directionZ: number
  ): void {
    if (bear.state.attackTimer > 0) return;
    bear.state.attackTimer = ATTACK_COOLDOWN_SECONDS;
    bear.state.rearTimer = REAR_DURATION_SECONDS;
    this.audio.playPolarBearRoar();

    const damaged = this.vitals.damage(ATTACK_DAMAGE, 'mob');
    if (damaged) {
      const knockback = this.vitals.knockbackMultiplier ?? 1;
      this.player.velocity.x += directionX * 6.5 * knockback;
      this.player.velocity.y = Math.max(this.player.velocity.y, 4.4);
      this.player.velocity.z += directionZ * 6.5 * knockback;
    }
  }
}
