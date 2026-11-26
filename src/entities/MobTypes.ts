import * as THREE from 'three';

export type MobSpeciesId = string;
export type MobTag = 'passive' | 'hostile' | 'underground' | 'blocks-sleep' | 'poisonous';

export interface MobHit {
  species: MobSpeciesId;
  entityId: number;
  /** Compatibility alias for species controllers and existing callers. */
  id: number;
  name: string;
  distance: number;
  health: number;
  maxHealth: number;
}

/** Additive species plugin consumed by the central mob registry. */
export interface MobSpeciesController {
  readonly species: MobSpeciesId;
  readonly tags: ReadonlySet<MobTag>;
  readonly count: number;

  update(dt: number): void;
  raycast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    blockDistance: number
  ): MobHit | null;
  damage(entityId: number, amount: number, direction: THREE.Vector3): boolean;
  hasWithin(position: THREE.Vector3, radius: number): boolean;
}
