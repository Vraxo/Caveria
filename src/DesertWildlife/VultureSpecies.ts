import * as THREE from 'three';
import { BlockId } from '../content/BlockId';
import { isBlockSolid } from '../content/BlockQueries';
import { rollMobLoot } from '../content/loot/MobLoot';
import { MOB_DEFINITIONS, VULTURE_ID } from '../content/mobs/MobDefinitions';
import { MobEntity, MobRuntime, MobSpeciesBehavior, MobTag, SavedMobSnapshot } from '../entities/MobTypes';
import { ItemId } from '../items/Item';
import { Player } from '../player/Player';
import { BreakParticles } from '../rendering/BreakParticles';
import { DroppedItemManager } from '../rendering/DroppedItems';
import { World } from '../world/World';
import {
  WildlifeVisual,
  createVultureVisual,
  disposeWildlifeVisual,
  updateVultureVisual,
} from './DesertWildlifeVisuals';

interface VultureState {
  facingAngle: number;
  turnTimer: number;
  soundTimer: number;
  flightOffset: number;
}

type VultureEntity = MobEntity<VultureState, WildlifeVisual>;

const DEFINITION = MOB_DEFINITIONS[VULTURE_ID];
const INITIAL_SPAWN_DELAY = 5;
const CRUISE_SPEED = 2.2;
const FLEE_SPEED = 3.6;
const FLIGHT_HEIGHT = 4.5;
const HURT_INVULNERABILITY_SECONDS = 0.24;
const SCAVENGED_ITEMS = new Set<ItemId>([
  ItemId.RawChicken,
  ItemId.RawMutton,
  ItemId.RawRabbit,
  ItemId.RawCaveFish,
  ItemId.RawRiverFish,
  ItemId.BlightedFish,
]);

/** Desert flying wildlife with lightweight cruising, avoidance, persistence, and loot. */
export class VultureSpecies implements MobSpeciesBehavior<VultureState, WildlifeVisual> {
  public readonly species = VULTURE_ID;
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
    private readonly drops: DroppedItemManager,
    private readonly particles: BreakParticles,
    private readonly playCall: () => void,
    private readonly playHit: () => void,
    private readonly playDeath: () => void
  ) {}

  public updateSpawning(dt: number, runtime: MobRuntime): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = DEFINITION.spawnDelay.minimum + Math.random() * DEFINITION.spawnDelay.variance;
    this.trySpawn(runtime);
  }

  public update(vulture: VultureEntity, dt: number, runtime: MobRuntime): void {
    vulture.state.turnTimer -= dt;
    vulture.state.soundTimer -= dt;
    const awayX = vulture.position.x - this.player.position.x;
    const awayZ = vulture.position.z - this.player.position.z;
    const distance = Math.hypot(awayX, awayZ);
    if (distance > DEFINITION.despawnDistance) {
      runtime.remove(vulture.id);
      return;
    }

    let directionX: number;
    let directionZ: number;
    let speed = CRUISE_SPEED;
    let flightHeight = FLIGHT_HEIGHT;
    if (distance < 6) {
      const inverseDistance = 1 / Math.max(0.001, distance);
      directionX = awayX * inverseDistance;
      directionZ = awayZ * inverseDistance;
      vulture.state.facingAngle = Math.atan2(directionX, directionZ);
      speed = FLEE_SPEED;
    } else {
      const carrion = this.drops.findNearestPosition(
        vulture.position,
        18,
        (stack) => SCAVENGED_ITEMS.has(stack.id)
      );
      if (carrion) {
        const towardX = carrion.x - vulture.position.x;
        const towardZ = carrion.z - vulture.position.z;
        const carrionDistance = Math.hypot(towardX, towardZ);
        const inverseDistance = 1 / Math.max(0.001, carrionDistance);
        directionX = towardX * inverseDistance;
        directionZ = towardZ * inverseDistance;
        vulture.state.facingAngle = Math.atan2(directionX, directionZ);
        speed = carrionDistance > 2.5 ? 2.8 : 1.2;
        flightHeight = 2.2;
      } else {
        if (vulture.state.turnTimer <= 0) {
          vulture.state.facingAngle += (Math.random() - 0.5) * 1.2;
          vulture.state.turnTimer = 2 + Math.random() * 4;
        }
        directionX = Math.sin(vulture.state.facingAngle);
        directionZ = Math.cos(vulture.state.facingAngle);
      }
    }

    const surface = this.world.terrainGen.getSurfaceHeight(vulture.position.x, vulture.position.z);
    const desiredY = surface + flightHeight + Math.sin(vulture.age * 0.7 + vulture.state.flightOffset);
    const blend = Math.min(1, dt * 2.5);
    vulture.velocity.x += (directionX * speed - vulture.velocity.x) * blend;
    vulture.velocity.z += (directionZ * speed - vulture.velocity.z) * blend;
    vulture.velocity.y += (Math.max(-2, Math.min(2, desiredY - vulture.position.y)) - vulture.velocity.y) * blend;

    const next = vulture.position.clone().addScaledVector(vulture.velocity, dt);
    if (isBlockSolid(this.world.getBlock(next.x, next.y, next.z))) {
      vulture.state.facingAngle += Math.PI;
      vulture.velocity.multiplyScalar(-0.35);
      // Escape the blocked voxel by sliding along the reversed path instead of hovering.
      const escape = vulture.velocity.clone();
      for (let attempt = 0; attempt < 10 && isBlockSolid(
        this.world.getBlock(
          vulture.position.x + escape.x,
          vulture.position.y + escape.y,
          vulture.position.z + escape.z
        )
      ); attempt++) {
        escape.multiplyScalar(0.5);
      }
      vulture.position.add(escape);
    } else {
      vulture.position.copy(next);
    }

    if (vulture.state.soundTimer <= 0 && distance < 18) {
      vulture.state.soundTimer = 7 + Math.random() * 10;
      this.playCall();
    }
    updateVultureVisual(vulture.visual, {
      age: vulture.age,
      hurt: vulture.hurtTimer > 0,
      position: vulture.position,
      velocity: vulture.velocity,
    });
  }

  public saveState(vulture: VultureEntity): unknown {
    return { ...vulture.state };
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
        turnTimer: Number(saved.turnTimer) || 0,
        soundTimer: Number(saved.soundTimer) || 1,
        flightOffset: Number(saved.flightOffset) || 0,
      },
    });
  }

  public onDamaged(vulture: VultureEntity, direction: THREE.Vector3): void {
    vulture.velocity.addScaledVector(direction, 3);
    vulture.velocity.y = Math.max(vulture.velocity.y, 2.5);
    vulture.state.turnTimer = 0;
    this.playHit();
  }

  public onDeath(vulture: VultureEntity): void {
    this.playDeath();
    this.particles.spawnBurst(
      vulture.position.x - 0.5,
      vulture.position.y,
      vulture.position.z - 0.5,
      BlockId.Sand
    );
    for (const stack of rollMobLoot(DEFINITION.lootTable)) {
      this.drops.spawnDrop(vulture.position.x, vulture.position.y, vulture.position.z, stack);
    }
  }

  public dispose(vulture: VultureEntity): void {
    this.scene.remove(vulture.visual.root);
    disposeWildlifeVisual(vulture.visual);
  }

  private trySpawn(runtime: MobRuntime): void {
    if (runtime.countSpecies(this.species) >= DEFINITION.maxPopulation) return;
    const playerX = Math.floor(this.player.position.x);
    const playerZ = Math.floor(this.player.position.z);
    const playerSurface = this.world.terrainGen.getSurfaceHeight(playerX, playerZ);
    if (this.player.position.y < playerSurface - 2) return;

    for (let attempt = 0; attempt < 10; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 10 + Math.random() * 14;
      const x = Math.floor(this.player.position.x + Math.cos(angle) * radius);
      const z = Math.floor(this.player.position.z + Math.sin(angle) * radius);
      const surface = this.world.terrainGen.getSurfaceHeight(x, z);
      const biome = this.world.terrainGen.getSurfaceBiomeDefinition(x, z, surface);
      if (!biome.tags.includes('arid') || this.world.getBlock(x, surface, z) !== BlockId.Sand) continue;
      const position = new THREE.Vector3(x + 0.5, surface + FLIGHT_HEIGHT, z + 0.5);
      if (isBlockSolid(this.world.getBlock(position.x, position.y, position.z))) continue;
      this.spawn(position, runtime);
      return;
    }
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
      state: VultureState;
    }
  ): void {
    const visual = createVultureVisual();
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
        turnTimer: 0,
        soundTimer: 2 + Math.random() * 6,
        flightOffset: Math.random() * Math.PI * 2,
      },
      visual,
    });
  }
}
