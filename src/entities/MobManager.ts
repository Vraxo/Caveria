import * as THREE from 'three';
import { ItemStack } from '../items/ItemTypes';
import { raycastMobs } from './MobMechanics';
import {
  MobEntity,
  MobEntityId,
  MobHit,
  MobInteractionResult,
  MobRuntime,
  MobSpawnData,
  MobSpeciesBehavior,
  MobSpeciesId,
  MobTag,
  SavedMobSnapshot,
} from './MobTypes';

export type {
  MobEntity,
  MobEntityId,
  MobHit,
  MobInteractionResult,
  MobRuntime,
  MobSpawnData,
  MobSpeciesBehavior,
  MobSpeciesId,
  MobTag,
  SavedMobSnapshot,
} from './MobTypes';

type AnySpecies = MobSpeciesBehavior<any, any>;
type AnyMob = MobEntity<any, any>;

/** Owns every mob instance and coordinates registered species behavior. */
export class MobManager implements MobRuntime {
  private readonly entities: AnyMob[] = [];
  private readonly entitiesById = new Map<MobEntityId, AnyMob>();
  private readonly species = new Map<MobSpeciesId, AnySpecies>();
  private nextEntityId = 1;

  public constructor(species: Iterable<AnySpecies> = []) {
    for (const behavior of species) this.register(behavior);
  }

  public register<TState, TVisual>(
    behavior: MobSpeciesBehavior<TState, TVisual>
  ): this {
    if (this.species.has(behavior.species)) {
      throw new Error(`Duplicate mob species behavior: ${behavior.species}`);
    }
    this.species.set(behavior.species, behavior);
    return this;
  }

  public get count(): number {
    return this.entities.length;
  }

  public countSpecies(species: MobSpeciesId): number {
    let count = 0;
    for (const entity of this.entities) {
      if (entity.species === species) count++;
    }
    return count;
  }

  public countTagged(tag: MobTag): number {
    let count = 0;
    for (const entity of this.entities) {
      if (this.requireSpecies(entity.species).tags.has(tag)) count++;
    }
    return count;
  }

  public hasWithin(position: THREE.Vector3, radius: number, tag?: MobTag): boolean {
    const radiusSquared = radius * radius;
    return this.entities.some((entity) => {
      const behavior = this.requireSpecies(entity.species);
      return (!tag || behavior.tags.has(tag))
        && entity.position.distanceToSquared(position) <= radiusSquared;
    });
  }

  public entitiesOfSpeciesWithin(
    species: MobSpeciesId,
    position: THREE.Vector3,
    radius: number
  ): ReadonlyArray<MobEntity> {
    const radiusSquared = radius * radius;
    return this.entities.filter(
      (entity) => entity.species === species
        && entity.position.distanceToSquared(position) <= radiusSquared
    );
  }

  public hasSpeciesWithin(
    species: MobSpeciesId,
    position: THREE.Vector3,
    radius: number
  ): boolean {
    const radiusSquared = radius * radius;
    return this.entities.some(
      (entity) => entity.species === species
        && entity.position.distanceToSquared(position) <= radiusSquared
    );
  }

  public hasSpeciesWithinHorizontal(
    species: MobSpeciesId,
    position: THREE.Vector3,
    radius: number
  ): boolean {
    return this.entities.some(
      (entity) => entity.species === species
        && Math.hypot(
          entity.position.x - position.x,
          entity.position.z - position.z
        ) < radius
    );
  }

  public spawn<TState, TVisual>(
    behavior: MobSpeciesBehavior<TState, TVisual>,
    data: MobSpawnData<TState, TVisual>
  ): MobEntity<TState, TVisual> {
    if (this.species.get(behavior.species) !== behavior) {
      throw new Error(`Cannot spawn unregistered mob species: ${behavior.species}`);
    }

    const id = data.id ?? this.nextEntityId;
    if (this.entitiesById.has(id)) throw new Error(`Duplicate mob entity id: ${id}`);
    this.nextEntityId = Math.max(this.nextEntityId, id + 1);
    const entity: MobEntity<TState, TVisual> = {
      id,
      species: behavior.species,
      position: data.position,
      velocity: data.velocity ?? new THREE.Vector3(),
      onGround: data.onGround ?? false,
      health: Math.max(1, Math.min(behavior.maxHealth, data.health ?? behavior.maxHealth)),
      age: Math.max(0, data.age ?? 0),
      hurtTimer: Math.max(0, data.hurtTimer ?? 0),
      state: data.state,
      visual: data.visual,
    };
    this.entities.push(entity);
    this.entitiesById.set(entity.id, entity);
    return entity;
  }

  public remove(entityId: MobEntityId): boolean {
    const entity = this.entitiesById.get(entityId);
    if (!entity) return false;

    this.requireSpecies(entity.species).dispose(entity);
    this.entitiesById.delete(entityId);
    const index = this.entities.indexOf(entity);
    if (index >= 0) this.entities.splice(index, 1);
    return true;
  }

  public update(dt: number): void {
    // Keep registered species order and reverse per-species entity order deterministic.
    for (const behavior of this.species.values()) {
      behavior.updateSpawning?.(dt, this);
      for (let index = this.entities.length - 1; index >= 0; index--) {
        const entity = this.entities[index];
        if (entity.species !== behavior.species) continue;

        entity.age += dt;
        entity.hurtTimer = Math.max(0, entity.hurtTimer - dt);
        behavior.update(entity, dt, this);
      }
    }
  }

  public raycast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    blockDistance: number
  ): MobHit | null {
    let closest: MobHit | null = null;
    for (const behavior of this.species.values()) {
      const speciesEntities = this.entities.filter(
        (entity) => entity.species === behavior.species
      );
      const hit = raycastMobs(speciesEntities, {
        species: behavior.species,
        name: behavior.name,
        maxHealth: behavior.maxHealth,
        shape: { radius: behavior.radius, height: behavior.height },
        origin,
        direction,
        maxDistance,
        blockDistance,
      });
      if (hit && (!closest || hit.distance < closest.distance)) closest = hit;
    }
    return closest;
  }

  public interact(
    hit: MobHit,
    held: ItemStack | null,
    creativeMode: boolean,
    sneaking = false
  ): MobInteractionResult | null {
    const entity = this.entitiesById.get(hit.entityId);
    if (!entity || entity.species !== hit.species) return null;
    const behavior = this.requireSpecies(entity.species);
    return behavior.interact?.(entity, held, creativeMode, this, sneaking) ?? null;
  }

  public snapshots(): SavedMobSnapshot[] {
    return this.entities.map((entity) => {
      const behavior = this.requireSpecies(entity.species);
      return {
        id: entity.id,
        species: entity.species,
        position: entity.position.toArray(),
        velocity: entity.velocity.toArray(),
        health: entity.health,
        age: entity.age,
        hurtTimer: entity.hurtTimer,
        state: behavior.saveState(entity),
      };
    });
  }

  public restore(snapshots: ReadonlyArray<SavedMobSnapshot>): void {
    for (const snapshot of snapshots) {
      const behavior = this.species.get(snapshot.species);
      if (!behavior || this.entitiesById.has(snapshot.id)) continue;
      behavior.restore(snapshot, this);
    }
  }

  public damage(hit: MobHit, amount: number, direction: THREE.Vector3): boolean {
    const entity = this.entitiesById.get(hit.entityId);
    if (!entity || entity.species !== hit.species || entity.hurtTimer > 0) return false;

    const behavior = this.requireSpecies(entity.species);
    entity.health -= Math.max(1, amount);
    entity.hurtTimer = behavior.hurtInvulnerabilitySeconds;
    behavior.onDamaged(entity, direction, this);

    if (entity.health <= 0) {
      behavior.onDeath(entity, this);
      this.remove(entity.id);
    }
    return true;
  }

  private requireSpecies(species: MobSpeciesId): AnySpecies {
    const behavior = this.species.get(species);
    if (!behavior) throw new Error(`Missing mob species behavior: ${species}`);
    return behavior;
  }
}
