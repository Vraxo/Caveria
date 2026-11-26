import { BLOCK_BREAK, BLOCK_USE } from '../../content/BlockCapabilities';
import { BlockId } from '../../content/BlockId';
import { isBlockSolid } from '../../content/BlockQueries';
import { VoxelHit } from '../../player/Raycaster';
import {
  BlockBreakBehaviorRegistry,
  BlockSupportRegistry,
  BlockUseBehaviorRegistry,
} from './BlockBehaviorRegistry';

interface DefaultBlockBehaviorDependencies {
  onOpenWorkbench: () => void;
  onOpenFurnace: (x: number, y: number, z: number) => void;
  onOpenChest: (x: number, y: number, z: number) => void;
  onUseBed: (x: number, y: number, z: number) => void;
  onFurnaceBroken: (x: number, y: number, z: number) => void;
  onChestBroken: (x: number, y: number, z: number) => void;
  onBedBroken: (x: number, y: number, z: number, drop: boolean) => void;
  onFarmBroken: (x: number, y: number, z: number, drop: boolean) => boolean;
  onDisturbedShroom: () => void;
}

export interface DefaultBlockBehaviorRegistries {
  use: BlockUseBehaviorRegistry;
  break: BlockBreakBehaviorRegistry;
  support: BlockSupportRegistry;
}

export function createDefaultBlockBehaviorRegistries(
  deps: DefaultBlockBehaviorDependencies
): DefaultBlockBehaviorRegistries {
  const use = new BlockUseBehaviorRegistry()
    .register(BLOCK_USE.crafting, () => deps.onOpenWorkbench())
    .register(BLOCK_USE.furnace, (hit) => at(hit, deps.onOpenFurnace))
    .register(BLOCK_USE.chest, (hit) => at(hit, deps.onOpenChest))
    .register(BLOCK_USE.bed, (hit) => at(hit, deps.onUseBed));

  const breakRegistry = new BlockBreakBehaviorRegistry()
    .register(BLOCK_BREAK.furnace, ({ hit }) => at(hit, deps.onFurnaceBroken))
    .register(BLOCK_BREAK.chest, ({ hit }) => at(hit, deps.onChestBroken))
    .register(BLOCK_BREAK.bed, ({ hit, creativeMode }) => {
      deps.onBedBroken(hit.blockX, hit.blockY, hit.blockZ, !creativeMode);
    })
    .register(BLOCK_BREAK.farm, ({ hit, creativeMode }) => {
      deps.onFarmBroken(hit.blockX, hit.blockY, hit.blockZ, !creativeMode);
    })
    .register(BLOCK_BREAK.disturbedShroom, ({ creativeMode, cause }) => {
      if (!creativeMode && cause === 'mined') deps.onDisturbedShroom();
    });

  const support = new BlockSupportRegistry()
    .register('floor', (world, x, y, z) => isBlockSolid(world.getBlock(x, y - 1, z)))
    .register('floor-or-ceiling', (world, x, y, z) =>
      isBlockSolid(world.getBlock(x, y - 1, z)) || isBlockSolid(world.getBlock(x, y + 1, z)))
    .register('ceiling-chain', (world, x, y, z) => {
      const above = world.getBlock(x, y + 1, z);
      return isBlockSolid(above) || above === BlockId.CaveVine;
    });

  return { use, break: breakRegistry, support };
}

function at(hit: VoxelHit, action: (x: number, y: number, z: number) => void): void {
  action(hit.blockX, hit.blockY, hit.blockZ);
}
