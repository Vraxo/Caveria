import * as THREE from 'three';
import { BlockId } from '../content/BlockId';
import { rollMobLoot } from '../content/loot/MobLoot';
import { MobDefinition } from '../content/mobs/MobDefinitions';
import { MobEntity, MobRuntime, MobSpeciesBehavior, MobTag, SavedMobSnapshot } from '../entities/MobTypes';
import { findGroundMobSpawn, moveGroundMob } from '../entities/MobMechanics';
import { Player } from '../player/Player';
import { PlayerVitals } from '../player/PlayerVitals';
import { BreakParticles } from '../rendering/BreakParticles';
import { DroppedItemManager } from '../rendering/DroppedItems';
import { World } from '../world/World';
import {
  WildlifeVisual,
  disposeWildlifeVisual,
  updateGroundWildlifeVisual,
} from './DesertWildlifeVisuals';

interface DesertHostileState {
  facingAngle: number;
  decisionTimer: number;
  attackTimer: number;
  soundTimer: number;
}

type DesertHostileEntity = MobEntity<DesertHostileState, WildlifeVisual>;

export interface DesertHostileConfig {
  definition: MobDefinition;
  createVisual(): WildlifeVisual;
  wanderSpeed: number;
  pursuitSpeed: number;
  sightDistance: number;
  attackDistance: number;
  attackDamage: number;
  poisonChance: number;
  minimumSpawnSpacing: number;
  playCall(): void;
  playHit(): void;
  playDeath(): void;
}

const INITIAL_SPAWN_DELAY = 3;
const SPAWN_ATTEMPTS = 12;
const SPAWN_MINIMUM_RADIUS = 9;
const SPAWN_RADIUS_VARIANCE = 13;
const MOVEMENT_RESPONSE = 6;
const ATTACK_COOLDOWN_SECONDS = 1.25;
const HURT_INVULNERABILITY_SECONDS = 0.25;

/** Shared pursuit, venom, persistence, and desert spawning for small hostile wildlife. */
export class DesertHostileSpecies
implements MobSpeciesBehavior<DesertHostileState, WildlifeVisual> {
  public readonly species: string;
  public readonly name: string;
  public readonly tags: ReadonlySet<MobTag>;
  public readonly maxHealth: number;
  public readonly radius: number;
  public readonly height: number;
  public readonly hurtInvulnerabilitySeconds = HURT_INVULNERABILITY_SECONDS;

  private spawnTimer = INITIAL_SPAWN_DELAY;

  public constructor(
    private readonly scene: THREE.Scene,
    private readonly world: World,
    private readonly player: Player,
    private readonly vitals: PlayerVitals,
    private readonly drops: DroppedItemManager,
    private readonly particles: BreakParticles,
    private readonly config: DesertHostileConfig,
    private readonly poisonPlayer: () => void
  ) {
    this.species = config.definition.id;
    this.name = config.definition.name;
    this.tags = new Set(config.definition.tags);
    this.maxHealth = config.definition.maxHealth;
    this.radius = config.definition.radius;
    this.height = config.definition.height;
  }

  public updateSpawning(dt: number, runtime: MobRuntime): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = this.config.definition.spawnDelay.minimum
      + Math.random() * this.config.definition.spawnDelay.variance;
    this.trySpawn(runtime);
  }

  public update(creature: DesertHostileEntity, dt: number, runtime: MobRuntime): void {
    creature.state.decisionTimer -= dt;
    creature.state.attackTimer = Math.max(0, creature.state.attackTimer - dt);
    creature.state.soundTimer -= dt;

    const towardX = this.player.position.x - creature.position.x;
    const towardZ = this.player.position.z - creature.position.z;
    const distance = Math.hypot(towardX, towardZ);
    if (distance > this.config.definition.despawnDistance) {
      runtime.remove(creature.id);
      return;
    }

    let directionX = Math.sin(creature.state.facingAngle);
    let directionZ = Math.cos(creature.state.facingAngle);
    let speed = this.config.wanderSpeed;
    if (!this.vitals.dead && distance < this.config.sightDistance) {
      const inverseDistance = 1 / Math.max(0.001, distance);
      directionX = towardX * inverseDistance;
      directionZ = towardZ * inverseDistance;
      speed = this.config.pursuitSpeed;
      creature.state.facingAngle = Math.atan2(directionX, directionZ);
      this.tryAttack(creature, distance, directionX, directionZ);
      if (creature.state.soundTimer <= 0 && distance < 7) {
        creature.state.soundTimer = 4 + Math.random() * 6;
        this.config.playCall();
      }
    } else if (creature.state.decisionTimer <= 0) {
      creature.state.facingAngle = Math.random() * Math.PI * 2;
      creature.state.decisionTimer = 1.5 + Math.random() * 3.5;
      directionX = Math.sin(creature.state.facingAngle);
      directionZ = Math.cos(creature.state.facingAngle);
    }

    const movement = moveGroundMob(
      creature,
      { directionX, directionZ, speed },
      { radius: this.radius, height: this.height },
      this.world,
      dt,
      { response: MOVEMENT_RESPONSE }
    );
    if (movement.collidedHorizontally) creature.state.decisionTimer = 0;
    updateGroundWildlifeVisual(creature.visual, {
      age: creature.age,
      hurt: creature.hurtTimer > 0,
      position: creature.position,
      velocity: creature.velocity,
    });
  }

  public saveState(creature: DesertHostileEntity): unknown {
    return { ...creature.state };
  }

  public restore(snapshot: SavedMobSnapshot, runtime: MobRuntime): void {
    const saved = snapshot.state && typeof snapshot.state === 'object'
      ? snapshot.state as Record<string, unknown>
      : {};
    this.spawn(new THREE.Vector3(...snapshot.position), runtime, {
      id: snapshot.id,
      velocity: new THREE.Vector3(...snapshot.velocity),
      health: snapshot.health,
      age: snapshot.age,
      hurtTimer: snapshot.hurtTimer,
      state: {
        facingAngle: Number(saved.facingAngle) || 0,
        decisionTimer: Number(saved.decisionTimer) || 0,
        attackTimer: Math.max(0, Number(saved.attackTimer) || 0),
        soundTimer: Number(saved.soundTimer) || 1,
      },
    });
  }

  public onDamaged(creature: DesertHostileEntity, direction: THREE.Vector3): void {
    creature.velocity.x += direction.x * 2.8;
    creature.velocity.y = 2.5;
    creature.velocity.z += direction.z * 2.8;
    creature.state.decisionTimer = 0;
    this.config.playHit();
  }

  public onDeath(creature: DesertHostileEntity): void {
    this.config.playDeath();
    this.particles.spawnBurst(
      creature.position.x - 0.5,
      creature.position.y,
      creature.position.z - 0.5,
      BlockId.Sand
    );
    for (const stack of rollMobLoot(this.config.definition.lootTable)) {
      this.drops.spawnDrop(creature.position.x, creature.position.y + 0.2, creature.position.z, stack);
    }
  }

  public dispose(creature: DesertHostileEntity): void {
    this.scene.remove(creature.visual.root);
    disposeWildlifeVisual(creature.visual);
  }

  private tryAttack(
    creature: DesertHostileEntity,
    distance: number,
    directionX: number,
    directionZ: number
  ): void {
    if (
      distance >= this.config.attackDistance
      || Math.abs(this.player.position.y - creature.position.y) > 1.3
      || creature.state.attackTimer > 0
    ) return;
    creature.state.attackTimer = ATTACK_COOLDOWN_SECONDS;
    const knockback = this.vitals.knockbackMultiplier;
    if (!this.vitals.damage(this.config.attackDamage, 'mob')) return;
    if (Math.random() < this.config.poisonChance) this.poisonPlayer();
    this.player.velocity.x += directionX * 2.5 * knockback;
    this.player.velocity.y = Math.max(this.player.velocity.y, 1.8 * knockback);
    this.player.velocity.z += directionZ * 2.5 * knockback;
  }

  private trySpawn(runtime: MobRuntime): void {
    if (
      this.vitals.dead
      || runtime.countSpecies(this.species) >= this.config.definition.maxPopulation
      || !this.playerIsNearSurface()
    ) return;
    const position = findGroundMobSpawn(this.world, this.player.position, {
      attempts: SPAWN_ATTEMPTS,
      minimumRadius: SPAWN_MINIMUM_RADIUS,
      radiusVariance: SPAWN_RADIUS_VARIANCE,
      scanAbove: 5,
      scanBelow: 6,
      acceptsColumn: (x, z) => {
        const surface = this.world.terrainGen.getSurfaceHeight(x, z);
        return this.world.terrainGen.getSurfaceBiomeDefinition(x, z, surface).tags.includes('arid');
      },
      acceptsCandidate: (x, y, z) => this.world.getBlock(x, y - 1, z) === BlockId.Sand,
    });
    if (!position || runtime.hasSpeciesWithinHorizontal(
      this.species,
      position,
      this.config.minimumSpawnSpacing
    )) return;
    this.spawn(position, runtime);
  }

  private playerIsNearSurface(): boolean {
    const x = Math.floor(this.player.position.x);
    const z = Math.floor(this.player.position.z);
    return this.player.position.y >= this.world.terrainGen.getSurfaceHeight(x, z) - 2;
  }

  private spawn(
    position: THREE.Vector3,
    runtime: MobRuntime,
    restored?: {
      id: number;
      velocity: THREE.Vector3;
      health: number;
      age: number;
      hurtTimer: number;
      state: DesertHostileState;
    }
  ): void {
    const visual = this.config.createVisual();
    visual.root.position.copy(position);
    this.scene.add(visual.root);
    runtime.spawn(this, {
      id: restored?.id,
      position,
      velocity: restored?.velocity,
      health: restored?.health,
      age: restored?.age ?? Math.random() * 5,
      hurtTimer: restored?.hurtTimer,
      state: restored?.state ?? {
        facingAngle: Math.random() * Math.PI * 2,
        decisionTimer: 0,
        attackTimer: 0,
        soundTimer: 1 + Math.random() * 4,
      },
      visual,
    });
  }
}
