import * as THREE from 'three';
import { BlockId } from '../content/BlockId';
import { MobDefinition } from '../content/mobs/MobDefinitions';
import { rollMobLoot } from '../content/loot/MobLoot';
import type { BiomeTag } from '../Biomes/BiomeDefinitions';
import { ITEMS, ItemId, ItemStack, createStack } from '../items/Item';
import { Player } from '../player/Player';
import { BreakParticles } from '../rendering/BreakParticles';
import { DroppedItemManager } from '../rendering/DroppedItems';
import { World } from '../world/World';
import { findGroundMobSpawn, MovementIntent, moveGroundMob } from './MobMechanics';
import {
  MobEntity,
  MobInteractionResult,
  MobRuntime,
  MobSpeciesBehavior,
  MobTag,
  SavedMobSnapshot,
} from './MobTypes';

export type SurfaceAnimalActivity = 'idle' | 'wandering' | 'fleeing-player';

export interface SurfaceAnimalState {
  activity: SurfaceAnimalActivity;
  activityTimer: number;
  facingAngle: number;
  ambientSoundTimer: number;
  growthRemaining: number;
  feedingCooldown: number;
  loveTimer: number;
  breedingCooldown: number;
  sheared: boolean;
  resourceTimer: number;
  /** Optional feature-owned inventory used by pack animals. */
  storage?: Array<ItemStack | null>;
  /** Player-used animals remain in the world beyond normal ambient despawn range. */
  persistent?: boolean;
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
      baby: boolean;
      resourceAvailable: boolean;
    }
  ): void;
  dispose(visual: TVisual): void;
}

export interface SurfaceAnimalConfig<TVisual> {
  definition: MobDefinition;
  requiredBiomeTag: BiomeTag;
  visual: SurfaceAnimalVisualAdapter<TVisual>;
  particles: BlockId;
  wanderSpeed: number;
  fleeSpeed: number;
  fleeDistance: number;
  minimumSpawnSpacing: number;
  spawnGround: ReadonlySet<BlockId>;
  breedingItem: ItemId;
  resource: 'eggs' | 'wool' | 'none';
  storageSlots?: number;
  playAmbientSound(): void;
  playHitSound(): void;
  playDeathSound(): void;
  onEmptyHandInteract?(
    animal: SurfaceAnimalEntity<TVisual>,
    runtime: MobRuntime,
    sneaking: boolean
  ): MobInteractionResult | null;
  isExternallyControlled?(animal: SurfaceAnimalEntity<TVisual>): boolean;
  preventDespawn?(animal: SurfaceAnimalEntity<TVisual>): boolean;
  onDeath?(animal: SurfaceAnimalEntity<TVisual>): void;
  onRemoved?(animal: SurfaceAnimalEntity<TVisual>): void;
}

export type SurfaceAnimalEntity<TVisual> = MobEntity<SurfaceAnimalState, TVisual>;

const INITIAL_SPAWN_DELAY = 2.5;
const MOVEMENT_RESPONSE = 5;
const SPAWN_ATTEMPTS = 12;
const SPAWN_MINIMUM_RADIUS = 9;
const SPAWN_RADIUS_VARIANCE = 13;
const SPAWN_SCAN_ABOVE_PLAYER = 5;
const SPAWN_SCAN_BELOW_PLAYER = 6;
const AMBIENT_SOUND_DISTANCE = 15;
const HURT_INVULNERABILITY_SECONDS = 0.28;
const BABY_GROWTH_SECONDS = 300;
const FEEDING_COOLDOWN_SECONDS = 2;
const BREEDING_COOLDOWN_SECONDS = 300;
const LOVE_SECONDS = 30;
const BREEDING_RANGE = 8;
const FOLLOW_RANGE = 10;
const WOOL_REGROW_SECONDS = 180;
const EGG_MINIMUM_SECONDS = 180;
const EGG_VARIANCE_SECONDS = 180;

function savedNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

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
    animal.state.growthRemaining = Math.max(0, animal.state.growthRemaining - dt);
    animal.state.feedingCooldown = Math.max(0, animal.state.feedingCooldown - dt);
    animal.state.loveTimer = Math.max(0, animal.state.loveTimer - dt);
    animal.state.breedingCooldown = Math.max(0, animal.state.breedingCooldown - dt);
    this.updateResource(animal, dt);

    const awayX = animal.position.x - this.player.position.x;
    const awayZ = animal.position.z - this.player.position.z;
    const playerDistance = Math.hypot(awayX, awayZ);
    if (
      playerDistance > this.config.definition.despawnDistance
      && !this.config.preventDespawn?.(animal)
    ) {
      runtime.remove(animal.id);
      return;
    }
    if (this.config.isExternallyControlled?.(animal)) {
      this.updateVisual(animal);
      return;
    }

    const intent = this.chooseMovement(animal, awayX, awayZ, playerDistance, runtime);
    this.applyMovement(animal, intent, dt);
    this.updateVisual(animal);
    this.updateAmbientSound(animal, playerDistance);
  }

  public interact(
    animal: SurfaceAnimalEntity<TVisual>,
    held: ItemStack | null,
    creativeMode: boolean,
    runtime: MobRuntime,
    sneaking = false
  ) {
    if (
      this.config.resource === 'wool'
      && held?.id === ItemId.Shears
      && animal.state.growthRemaining <= 0
      && !animal.state.sheared
    ) {
      animal.state.sheared = true;
      animal.state.resourceTimer = WOOL_REGROW_SECONDS;
      this.drops.spawnDrop(
        animal.position.x,
        animal.position.y + 0.4,
        animal.position.z,
        createStack(ItemId.Wool, Math.random() < 0.5 ? 1 : 2)
      );
      return { damageHeld: !creativeMode, swing: true };
    }

    if (!held && this.config.onEmptyHandInteract) {
      return this.config.onEmptyHandInteract(animal, runtime, sneaking);
    }
    if (held?.id !== this.config.breedingItem || animal.state.feedingCooldown > 0) return null;
    if (animal.state.growthRemaining > 0) {
      animal.state.feedingCooldown = FEEDING_COOLDOWN_SECONDS;
      animal.state.growthRemaining = Math.max(0, animal.state.growthRemaining - 30);
      return { consumeHeld: !creativeMode, swing: true };
    }
    if (animal.state.breedingCooldown > 0 || animal.state.loveTimer > 0) return null;

    animal.state.feedingCooldown = FEEDING_COOLDOWN_SECONDS;
    animal.state.loveTimer = LOVE_SECONDS;
    this.breakParticles.spawnBurst(
      animal.position.x - 0.5,
      animal.position.y + 0.4,
      animal.position.z - 0.5,
      BlockId.Grass
    );
    const partner = runtime.entitiesOfSpeciesWithin(
      this.species,
      animal.position,
      BREEDING_RANGE
    ).find((candidate) => {
      if (candidate.id === animal.id) return false;
      const state = candidate.state as SurfaceAnimalState;
      return state.growthRemaining <= 0
        && state.breedingCooldown <= 0
        && state.loveTimer > 0;
    }) as SurfaceAnimalEntity<TVisual> | undefined;
    if (partner && runtime.countSpecies(this.species) < this.config.definition.maxPopulation) {
      animal.state.loveTimer = 0;
      partner.state.loveTimer = 0;
      animal.state.breedingCooldown = BREEDING_COOLDOWN_SECONDS;
      partner.state.breedingCooldown = BREEDING_COOLDOWN_SECONDS;
      this.spawnAnimal(
        animal.position.clone().add(partner.position).multiplyScalar(0.5),
        runtime,
        true
      );
    }
    return { consumeHeld: !creativeMode, swing: true };
  }

  public saveState(animal: SurfaceAnimalEntity<TVisual>): unknown {
    return {
      ...animal.state,
      storage: animal.state.storage?.map((stack) => stack ? { ...stack } : null),
    };
  }

  public restore(snapshot: SavedMobSnapshot, runtime: MobRuntime): void {
    const saved = snapshot.state && typeof snapshot.state === 'object'
      ? snapshot.state as Record<string, unknown>
      : {};
    const position = new THREE.Vector3(...snapshot.position);
    const resourceTimer = typeof saved.resourceTimer === 'number' && Number.isFinite(saved.resourceTimer)
      ? Math.max(0, saved.resourceTimer)
      : this.initialResourceTimer();
    const visual = this.config.visual.create();
    this.config.visual.root(visual).position.copy(position);
    this.scene.add(this.config.visual.root(visual));
    const restored = runtime.spawn<SurfaceAnimalState, TVisual>(this, {
      id: snapshot.id,
      position,
      velocity: new THREE.Vector3(...snapshot.velocity),
      health: snapshot.health,
      age: snapshot.age,
      hurtTimer: snapshot.hurtTimer,
      state: {
        activity: saved.activity === 'wandering' || saved.activity === 'fleeing-player'
          ? saved.activity : 'idle',
        activityTimer: savedNumber(saved.activityTimer, 0),
        facingAngle: savedNumber(saved.facingAngle, 0),
        ambientSoundTimer: savedNumber(saved.ambientSoundTimer, 2),
        growthRemaining: Math.max(0, savedNumber(saved.growthRemaining, 0)),
        feedingCooldown: Math.max(0, savedNumber(saved.feedingCooldown, 0)),
        loveTimer: Math.max(0, savedNumber(saved.loveTimer, 0)),
        breedingCooldown: Math.max(0, savedNumber(saved.breedingCooldown, 0)),
        sheared: Boolean(saved.sheared),
        resourceTimer,
        storage: this.restoreStorage(saved.storage),
        persistent: Boolean(saved.persistent),
      },
      visual,
    });
    this.updateVisual(restored);
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
    this.config.onDeath?.(animal);
    if (animal.state.growthRemaining > 0) return;
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
    this.config.onRemoved?.(animal);
    this.scene.remove(this.config.visual.root(animal.visual));
    this.config.visual.dispose(animal.visual);
  }

  private chooseMovement(
    animal: SurfaceAnimalEntity<TVisual>,
    awayX: number,
    awayZ: number,
    playerDistance: number,
    runtime: MobRuntime
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

    if (animal.state.growthRemaining > 0) {
      const adult = runtime.entitiesOfSpeciesWithin(
        this.species,
        animal.position,
        FOLLOW_RANGE
      ).find((candidate) => candidate.id !== animal.id
        && (candidate.state as SurfaceAnimalState).growthRemaining <= 0);
      if (adult) {
        const towardX = adult.position.x - animal.position.x;
        const towardZ = adult.position.z - animal.position.z;
        const distance = Math.hypot(towardX, towardZ);
        if (distance > 2) {
          animal.state.activity = 'wandering';
          return {
            directionX: towardX / distance,
            directionZ: towardZ / distance,
            speed: this.config.wanderSpeed * 1.2,
          };
        }
      }
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
      baby: animal.state.growthRemaining > 0,
      resourceAvailable: !animal.state.sheared,
    });
    this.config.visual.root(animal.visual).scale.setScalar(
      animal.state.growthRemaining > 0 ? 0.55 : 1
    );
  }

  private updateResource(animal: SurfaceAnimalEntity<TVisual>, dt: number): void {
    if (animal.state.growthRemaining > 0) return;
    if (this.config.resource === 'eggs') {
      animal.state.resourceTimer -= dt;
      if (animal.state.resourceTimer <= 0) {
        this.drops.spawnDrop(
          animal.position.x,
          animal.position.y + 0.25,
          animal.position.z,
          createStack(ItemId.Egg)
        );
        animal.state.resourceTimer = EGG_MINIMUM_SECONDS
          + Math.random() * EGG_VARIANCE_SECONDS;
      }
      return;
    }
    if (animal.state.sheared) {
      animal.state.resourceTimer = Math.max(0, animal.state.resourceTimer - dt);
      if (animal.state.resourceTimer <= 0) animal.state.sheared = false;
    }
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

    this.spawnAnimal(position, runtime, false);
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
      .tags.includes(this.config.requiredBiomeTag);
  }

  private hasNaturalGround(x: number, y: number, z: number): boolean {
    const floor = this.world.getBlock(x, y - 1, z);
    return this.config.spawnGround.has(floor);
  }

  private spawnAnimal(
    position: THREE.Vector3,
    runtime: MobRuntime,
    baby: boolean
  ): void {
    const visual = this.config.visual.create();
    this.config.visual.root(visual).position.copy(position);
    this.scene.add(this.config.visual.root(visual));

    const animal = runtime.spawn<SurfaceAnimalState, TVisual>(this, {
      position,
      age: Math.random() * 8,
      state: {
        activity: 'idle',
        activityTimer: 0,
        facingAngle: Math.random() * Math.PI * 2,
        ambientSoundTimer: 2 + Math.random() * 7,
        growthRemaining: baby ? BABY_GROWTH_SECONDS : 0,
        feedingCooldown: 0,
        loveTimer: 0,
        breedingCooldown: 0,
        sheared: false,
        resourceTimer: this.initialResourceTimer(),
        storage: this.config.storageSlots === undefined
          ? undefined
          : new Array<ItemStack | null>(this.config.storageSlots).fill(null),
        persistent: false,
      },
      visual,
    });
    this.updateVisual(animal);
  }

  private restoreStorage(value: unknown): Array<ItemStack | null> | undefined {
    if (this.config.storageSlots === undefined) return undefined;
    const saved = Array.isArray(value) ? value : [];
    return Array.from({ length: this.config.storageSlots }, (_, index) => {
      const stack = saved[index];
      if (!stack || typeof stack !== 'object') return null;
      const candidate = stack as Partial<ItemStack>;
      if (
        typeof candidate.id !== 'number'
        || !ITEMS[candidate.id]
        || typeof candidate.count !== 'number'
        || !Number.isFinite(candidate.count)
        || candidate.count <= 0
      ) return null;
      const definition = ITEMS[candidate.id];
      return {
        id: candidate.id,
        count: Math.min(definition.maxStack, Math.floor(candidate.count)),
        durability: definition.maxDurability === undefined
          ? undefined
          : Math.max(1, Math.min(
            definition.maxDurability,
            Math.floor(savedNumber(candidate.durability, definition.maxDurability))
          )),
      };
    });
  }

  private initialResourceTimer(): number {
    return this.config.resource === 'eggs'
      ? EGG_MINIMUM_SECONDS + Math.random() * EGG_VARIANCE_SECONDS
      : 0;
  }
}
