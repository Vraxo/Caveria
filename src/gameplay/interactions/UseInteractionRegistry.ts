import * as THREE from 'three';
import { ItemId, ItemStack } from '../../items/Item';
import { VoxelHit } from '../../player/Raycaster';

export interface UseInteractionContext {
  creativeMode: boolean;
  allowWorldUse: boolean;
  sneaking: boolean;
  held: ItemStack | null;
  hit: VoxelHit | null;
  waterHit: VoxelHit | null;
  foodCooldown: number;
}

export interface UseWorldDrop {
  position: THREE.Vector3;
  stack: ItemStack;
  velocity?: THREE.Vector3;
  pickupDelay?: number;
}

export interface UseInteractionResult {
  consumeHeld?: boolean;
  damageHeld?: boolean;
  exhaustion?: number;
  cooldown?: number;
  animation?: 'place' | 'swing';
  returnedItem?: ItemId;
  inventoryItem?: ItemStack;
  worldDrop?: UseWorldDrop;
  refreshTarget?: boolean;
}

export type UseInteractionHandler = (
  context: UseInteractionContext
) => UseInteractionResult | null;

/** Ordered chain of item/block use extensions. First matching handler wins. */
export class UseInteractionRegistry {
  private readonly handlers: UseInteractionHandler[] = [];

  public register(handler: UseInteractionHandler): this {
    this.handlers.push(handler);
    return this;
  }

  public resolve(context: UseInteractionContext): UseInteractionResult | null {
    for (const handler of this.handlers) {
      const result = handler(context);
      if (result) return result;
    }
    return null;
  }
}
