import * as THREE from 'three';
import {
  MobEntity,
  MobEntityId,
  MobRuntime,
  MobSpawnData,
  MobSpeciesBehavior,
  MobSpeciesId,
} from '../../src/entities/MobTypes';

type AnyEntity = MobEntity<any, any>;

export class RecordingMobRuntime implements MobRuntime {
  public readonly entities: AnyEntity[] = [];
  public readonly removed: MobEntityId[] = [];
  private nextId = 1;

  public spawn<TState, TVisual>(
    species: MobSpeciesBehavior<TState, TVisual>,
    data: MobSpawnData<TState, TVisual>
  ): MobEntity<TState, TVisual> {
    const entity: MobEntity<TState, TVisual> = {
      id: data.id ?? this.nextId++,
      species: species.species,
      position: data.position,
      velocity: data.velocity ?? new THREE.Vector3(),
      onGround: data.onGround ?? false,
      health: data.health ?? species.maxHealth,
      age: data.age ?? 0,
      hurtTimer: data.hurtTimer ?? 0,
      state: data.state,
      visual: data.visual,
    };
    this.entities.push(entity);
    return entity;
  }

  public remove(entityId: MobEntityId): boolean {
    const index = this.entities.findIndex((entity) => entity.id === entityId);
    if (index < 0) return false;
    this.entities.splice(index, 1);
    this.removed.push(entityId);
    return true;
  }

  public countSpecies(species: MobSpeciesId): number {
    return this.entities.filter((entity) => entity.species === species).length;
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
}
