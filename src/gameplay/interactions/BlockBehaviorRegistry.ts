import { BlockBreakBehaviorId, BlockSupportBehavior, BlockUseBehaviorId } from '../../content/BlockTypes';
import { World } from '../../world/World';
import { VoxelHit } from '../../player/Raycaster';

export type BlockUseBehavior = (hit: VoxelHit) => void;
export interface BlockBreakContext {
  hit: VoxelHit;
  creativeMode: boolean;
  cause: 'mined' | 'support-loss';
}
export type BlockBreakBehavior = (context: BlockBreakContext) => void;
export type BlockSupportRule = (world: World, x: number, y: number, z: number) => boolean;

export class BlockUseBehaviorRegistry {
  private readonly behaviors = new Map<BlockUseBehaviorId, BlockUseBehavior>();

  public register(id: BlockUseBehaviorId, behavior: BlockUseBehavior): this {
    if (this.behaviors.has(id)) throw new Error(`Duplicate block-use behavior: ${id}`);
    this.behaviors.set(id, behavior);
    return this;
  }

  public execute(id: BlockUseBehaviorId | undefined, hit: VoxelHit): boolean {
    if (!id) return false;
    const behavior = this.behaviors.get(id);
    if (!behavior) throw new Error(`Missing block-use behavior: ${id}`);
    behavior(hit);
    return true;
  }
}

export class BlockBreakBehaviorRegistry {
  private readonly behaviors = new Map<BlockBreakBehaviorId, BlockBreakBehavior>();

  public register(id: BlockBreakBehaviorId, behavior: BlockBreakBehavior): this {
    if (this.behaviors.has(id)) throw new Error(`Duplicate block-break behavior: ${id}`);
    this.behaviors.set(id, behavior);
    return this;
  }

  public execute(ids: ReadonlyArray<BlockBreakBehaviorId> | undefined, context: BlockBreakContext): void {
    for (const id of ids ?? []) {
      const behavior = this.behaviors.get(id);
      if (!behavior) throw new Error(`Missing block-break behavior: ${id}`);
      behavior(context);
    }
  }
}

export class BlockSupportRegistry {
  private readonly rules = new Map<BlockSupportBehavior, BlockSupportRule>();

  public register(id: BlockSupportBehavior, rule: BlockSupportRule): this {
    if (this.rules.has(id)) throw new Error(`Duplicate block-support behavior: ${id}`);
    this.rules.set(id, rule);
    return this;
  }

  public isSupported(
    id: BlockSupportBehavior | undefined,
    world: World,
    x: number,
    y: number,
    z: number
  ): boolean {
    if (!id) return true;
    const rule = this.rules.get(id);
    if (!rule) throw new Error(`Missing block-support behavior: ${id}`);
    return rule(world, x, y, z);
  }
}
