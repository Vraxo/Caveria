import * as THREE from 'three';
import { ItemStack } from '../items/ItemTypes';

export type MobEntityId = number;
export type MobSpeciesId = string;
export type MobTag =
  | 'passive'
  | 'hostile'
  | 'animal'
  | 'surface'
  | 'underground'
  | 'blocks-sleep'
  | 'poisonous';

export interface MobHit {
  species: MobSpeciesId;
  entityId: MobEntityId;
  /** Compatibility alias for existing combat callers. */
  id: MobEntityId;
  name: string;
  distance: number;
  health: number;
  maxHealth: number;
}

/** Shared state owned by the central mob runtime for one creature instance. */
export interface MobEntity<TState = unknown, TVisual = unknown> {
  readonly id: MobEntityId;
  readonly species: MobSpeciesId;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  onGround: boolean;
  health: number;
  age: number;
  hurtTimer: number;
  state: TState;
  visual: TVisual;
}

export interface SavedMobSnapshot {
  id: MobEntityId;
  species: MobSpeciesId;
  position: [number, number, number];
  velocity: [number, number, number];
  health: number;
  age: number;
  hurtTimer: number;
  state: unknown;
}

export interface MobInteractionResult {
  consumeHeld?: boolean;
  damageHeld?: boolean;
  swing?: boolean;
}

export interface MobSpawnData<TState, TVisual> {
  id?: MobEntityId;
  position: THREE.Vector3;
  velocity?: THREE.Vector3;
  onGround?: boolean;
  health?: number;
  age?: number;
  hurtTimer?: number;
  state: TState;
  visual: TVisual;
}

/** Minimal lifecycle API exposed to species behavior; storage stays inside MobManager. */
export interface MobRuntime {
  spawn<TState, TVisual>(
    species: MobSpeciesBehavior<TState, TVisual>,
    data: MobSpawnData<TState, TVisual>
  ): MobEntity<TState, TVisual>;
  remove(entityId: MobEntityId): boolean;
  countSpecies(species: MobSpeciesId): number;
  entitiesOfSpeciesWithin(
    species: MobSpeciesId,
    position: THREE.Vector3,
    radius: number
  ): ReadonlyArray<MobEntity>;
  hasSpeciesWithin(
    species: MobSpeciesId,
    position: THREE.Vector3,
    radius: number
  ): boolean;
  hasSpeciesWithinHorizontal(
    species: MobSpeciesId,
    position: THREE.Vector3,
    radius: number
  ): boolean;
}

/**
 * Registered behavior for a species. It owns species decisions and feedback, but not entity storage,
 * global identity, generic queries, damage gating, or lifecycle iteration.
 */
export interface MobSpeciesBehavior<TState = unknown, TVisual = unknown> {
  readonly species: MobSpeciesId;
  readonly name: string;
  readonly tags: ReadonlySet<MobTag>;
  readonly maxHealth: number;
  readonly radius: number;
  readonly height: number;
  readonly hurtInvulnerabilitySeconds: number;

  updateSpawning?(dt: number, runtime: MobRuntime): void;
  update(entity: MobEntity<TState, TVisual>, dt: number, runtime: MobRuntime): void;
  interact?(
    entity: MobEntity<TState, TVisual>,
    held: ItemStack | null,
    creativeMode: boolean,
    runtime: MobRuntime
  ): MobInteractionResult | null;
  saveState(entity: MobEntity<TState, TVisual>): unknown;
  restore(snapshot: SavedMobSnapshot, runtime: MobRuntime): void;
  onDamaged(
    entity: MobEntity<TState, TVisual>,
    direction: THREE.Vector3,
    runtime: MobRuntime
  ): void;
  onDeath(entity: MobEntity<TState, TVisual>, runtime: MobRuntime): void;
  dispose(entity: MobEntity<TState, TVisual>): void;
}
