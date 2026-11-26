import * as THREE from 'three';
import { BlockId } from '../content/BlockId';
import { MobDefinition } from '../content/mobs/MobDefinitions';
import { rollMobLoot } from '../content/loot/MobLoot';
import { Player } from '../player/Player';
import { BreakParticles } from '../rendering/BreakParticles';
import { DroppedItemManager } from '../rendering/DroppedItems';
import { SurfaceBiome } from '../world/TerrainGen';
import { World } from '../world/World';
import { findGroundMobSpawn, MovementIntent, moveGroundMob } from './MobMechanics';
import { MobEntity, MobRuntime, MobSpeciesBehavior, MobTag } from './MobTypes';

export type SurfaceAnimalActivity = 'idle' | 'wandering' | 'fleeing-player';

export interface SurfaceAnimalState {
  activity: SurfaceAnimalActivity;
  activityTimer: number;
  facingAngle: number;
  ambientSoundTimer: number;
}

export interface SurfaceAnimalVisualAdapter<TVisual> {
  create(): TVisual;
  root(visual: TVisual): THREE.Group;
  update(
    visual: TVisual,
    state: {
      id: number;
      age: number;
      hurt: boolean;
      position: THREE.Vector3;
      velocity: THREE.Vector3;
    }
  ): void;
  dispose(visual: TVisual): void;
}

export interface SurfaceAnimalConfig<TVisual> {
  definition: MobDefinition;
  allowedBiomes: ReadonlySet<SurfaceBiome>;
  visual: SurfaceAnimalVisualAdapter<TVisual>;
  particles: BlockId;
  wanderSpeed: number;
  fleeSpeed: number;
  fleeDistance: number;
  minimumSpawnSpacing: number;
  playAmbientSound(): void;
  playHitSound(): void;
  playDeathSound(): void;
}

type SurfaceAnimalEntity<TVisual> = MobEntity<SurfaceAnimalState, TVisual>;

const INITIAL_SPAWN_DELAY = 2.5;
const MOVEMENT_RESPONSE = 5;
const SPAWN_ATTEMPTS = 12;
const SPAWN_MINIMUM_RADIUS = 9;
const SPAWN_RADIUS_VARIANCE = 13;
const SPAWN_SCAN_ABOVE_PLAYER = 5;
const SPAWN_SCAN_BELOW_PLAYER = 6;
const AMBIENT_SOUND_DISTANCE = 15;
const HURT_INVULNERABILITY_SECONDS = 0.28;

/** Shared surface-animal behavior; species files provide only tuning, visuals, sounds, and loot. */
export class SurfaceAnimalSpecies<TVisual>
implements MobSpeciesBehavior<SurfaceAnimalState, TVisual> {
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
    private readonly drops: DroppedItemManager,
    private readonly breakParticles: BreakParticles,
    private readonly config: SurfaceAnimalConfig<TVisual>
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

  public update(
    animal: SurfaceAnimalEntity<TVisual>,
    dt: number,
    runtime: MobRuntime
  ): void {
    animal.state.activityTimer -= dt;
    animal.state.ambientSoundTimer -= dt;

    const awayX = animal.position.x - this.player.position.x;
    const awayZ = animal.position.z - this.player.position.z;
    const playerDistance = Math.hypot(awayX, awayZ);
    if (playerDistance > this.config.definition.despawnDistance) {
      runtime.remove(animal.id);
      return;
    }

    const intent = this.chooseMovement(animal, awayX, awayZ, playerDistance);
    this.applyMovement(animal, intent, dt);
    this.updateVisual(animal);
    this.updateAmbientSound(animal, playerDistance);
  }

  public onDamaged(
    animal: SurfaceAnimalEntity<TVisual>,
    direction: THREE.Vector3,
    _runtime: MobRuntime
  ): void {
    animal.velocity.x += direction.x * 3.4;
    animal.velocity.y = 3.1;
    animal.velocity.z += direction.z * 3.4;
    animal.state.activityTimer = 0;
    this.config.playHitSound();
  }

  public onDeath(animal: SurfaceAnimalEntity<TVisual>, _runtime: MobRuntime): void {
    this.config.playDeathSound();
    this.breakParticles.spawnBurst(
      animal.position.x - 0.5,
      animal.position.y,
      animal.position.z - 0.5,
      this.config.particles
    );
    for (const stack of rollMobLoot(this.config.definition.lootTable)) {
      this.drops.spawnDrop(
        animal.position.x,
        animal.position.y + 0.3,
        animal.position.z,
        stack
      );
    }
  }

  public dispose(animal: SurfaceAnimalEntity<TVisual>): void {
    this.scene.remove(this.config.visual.root(animal.visual));
    this.config.visual.dispose(animal.visual);
  }

  private chooseMovement(
    animal: SurfaceAnimalEntity<TVisual>,
    awayX: number,
    awayZ: number,
    playerDistance: number
  ): MovementIntent {
    if (playerDistance < this.config.fleeDistance) {
      const inverseDistance = 1 / Math.max(0.001, playerDistance);
      animal.state.activity = 'fleeing-player';
      return {
        directionX: awayX * inverseDistance,
        directionZ: awayZ * inverseDistance,
        speed: this.config.fleeSpeed,
      };
    }

    if (animal.state.activityTimer <= 0) this.chooseActivity(animal);
    if (animal.state.activity === 'idle') {
      return { directionX: 0, directionZ: 0, speed: 0 };
    }
    return {
      directionX: Math.sin(animal.state.facingAngle),
      directionZ: Math.cos(animal.state.facingAngle),
      speed: this.config.wanderSpeed,
    };
  }

  private chooseActivity(animal: SurfaceAnimalEntity<TVisual>): void {
    animal.state.activity = Math.random() < 0.72 ? 'wandering' : 'idle';
    animal.state.facingAngle = Math.random() * Math.PI * 2;
    animal.state.activityTimer = 1.5 + Math.random() * 4;
  }

  private applyMovement(
    animal: SurfaceAnimalEntity<TVisual>,
    intent: MovementIntent,
    dt: number
  ): void {
    const result = moveGroundMob(
      animal,
      intent,
      { radius: this.radius, height: this.height },
      this.world,
      dt,
      { response: MOVEMENT_RESPONSE }
    );
    if (!result.collidedHorizontally) return;

    animal.velocity.x *= -0.2;
    animal.velocity.z *= -0.2;
    animal.state.facingAngle += Math.PI * (0.6 + Math.random() * 0.8);
    animal.state.activity = 'idle';
    animal.state.activityTimer = 0.5;
  }

  private updateVisual(animal: SurfaceAnimalEntity<TVisual>): void {
    this.config.visual.update(animal.visual, {
      id: animal.id,
      age: animal.age,
      hurt: animal.hurtTimer > 0,
      position: animal.position,
      velocity: animal.velocity,
    });
  }

  private updateAmbientSound(
    animal: SurfaceAnimalEntity<TVisual>,
    playerDistance: number
  ): void {
    if (animal.state.ambientSoundTimer > 0 || playerDistance >= AMBIENT_SOUND_DISTANCE) return;
    animal.state.ambientSoundTimer = 5 + Math.random() * 9;
    this.config.playAmbientSound();
  }

  private trySpawn(runtime: MobRuntime): void {
    if (
      runtime.countSpecies(this.species) >= this.config.definition.maxPopulation
      || !this.playerIsNearSurface()
    ) return;

    const position = findGroundMobSpawn(this.world, this.player.position, {
      attempts: SPAWN_ATTEMPTS,
      minimumRadius: SPAWN_MINIMUM_RADIUS,
      radiusVariance: SPAWN_RADIUS_VARIANCE,
      scanAbove: SPAWN_SCAN_ABOVE_PLAYER,
      scanBelow: SPAWN_SCAN_BELOW_PLAYER,
      acceptsColumn: (x, z) => this.columnAllowsSpawn(x, z),
      acceptsCandidate: (x, y, z) => this.hasNaturalGround(x, y, z),
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
    const surface = this.world.terrainGen.getSurfaceHeight(x, z);
    return this.player.position.y >= surface - 2;
  }

  private columnAllowsSpawn(x: number, z: number): boolean {
    const surface = this.world.terrainGen.getSurfaceHeight(x, z);
    return this.config.allowedBiomes.has(this.world.terrainGen.getSurfaceBiome(x, z, surface));
  }

  private hasNaturalGround(x: number, y: number, z: number): boolean {
    const floor = this.world.getBlock(x, y - 1, z);
    return floor === BlockId.Grass || floor === BlockId.SnowGrass;
  }

  private spawn(position: THREE.Vector3, runtime: MobRuntime): void {
    const visual = this.config.visual.create();
    this.config.visual.root(visual).position.copy(position);
    this.scene.add(this.config.visual.root(visual));

    runtime.spawn(this, {
      position,
      age: Math.random() * 8,
      state: {
        activity: 'idle',
        activityTimer: 0,
        facingAngle: Math.random() * Math.PI * 2,
        ambientSoundTimer: 2 + Math.random() * 7,
      },
      visual,
    });
  }
}
