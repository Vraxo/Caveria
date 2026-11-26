import * as THREE from 'three';
import { MobHit, MobSpeciesController, MobSpeciesId, MobTag } from './MobTypes';

export type { MobHit, MobSpeciesController, MobSpeciesId, MobTag } from './MobTypes';

/** Routes updates, targeting, damage, and semantic queries across registered species plugins. */
export class MobManager {
  private readonly controllers: MobSpeciesController[] = [];
  private readonly bySpecies = new Map<MobSpeciesId, MobSpeciesController>();

  public constructor(controllers: Iterable<MobSpeciesController> = []) {
    for (const controller of controllers) this.register(controller);
  }

  public register(controller: MobSpeciesController): this {
    if (this.bySpecies.has(controller.species)) {
      throw new Error(`Duplicate mob species controller: ${controller.species}`);
    }
    this.controllers.push(controller);
    this.bySpecies.set(controller.species, controller);
    return this;
  }

  public get count(): number {
    return this.controllers.reduce((total, controller) => total + controller.count, 0);
  }

  public countSpecies(species: MobSpeciesId): number {
    return this.bySpecies.get(species)?.count ?? 0;
  }

  public countTagged(tag: MobTag): number {
    return this.controllers.reduce(
      (total, controller) => total + (controller.tags.has(tag) ? controller.count : 0),
      0
    );
  }

  public hasWithin(position: THREE.Vector3, radius: number, tag?: MobTag): boolean {
    return this.controllers.some(
      (controller) => (!tag || controller.tags.has(tag)) && controller.hasWithin(position, radius)
    );
  }

  public update(dt: number): void {
    for (const controller of this.controllers) controller.update(dt);
  }

  public raycast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    blockDistance: number
  ): MobHit | null {
    let closest: MobHit | null = null;
    for (const controller of this.controllers) {
      const hit = controller.raycast(origin, direction, maxDistance, blockDistance);
      if (hit && (!closest || hit.distance < closest.distance)) closest = hit;
    }
    return closest;
  }

  public damage(hit: MobHit, amount: number, direction: THREE.Vector3): boolean {
    return this.bySpecies.get(hit.species)?.damage(hit.entityId, amount, direction) ?? false;
  }
}
