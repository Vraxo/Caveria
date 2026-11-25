import { BlockId } from '../content/BlockId';

export type BlockSoundMaterial =
  | 'stone' | 'wood' | 'leaves' | 'glass' | 'crystal'
  | 'flora' | 'spike' | 'water' | 'sand' | 'snow' | 'soil';

const PROFILES: Partial<Record<BlockId, BlockSoundMaterial>> = {
  [BlockId.Stone]: 'stone',
  [BlockId.Cobblestone]: 'stone',
  [BlockId.DeepSlate]: 'stone',
  [BlockId.CoalOre]: 'stone',
  [BlockId.GoldOre]: 'stone',
  [BlockId.Sandstone]: 'stone',
  [BlockId.OakLog]: 'wood',
  [BlockId.SpruceLog]: 'wood',
  [BlockId.OakPlanks]: 'wood',
  [BlockId.CraftingTable]: 'wood',
  [BlockId.OakLeaves]: 'leaves',
  [BlockId.SpruceLeaves]: 'leaves',
  [BlockId.Glass]: 'glass',
  [BlockId.GlowCrystal]: 'crystal',
  [BlockId.AmethystCrystal]: 'crystal',
  [BlockId.Torch]: 'flora',
  [BlockId.CaveShroom]: 'flora',
  [BlockId.CaveVine]: 'flora',
  [BlockId.DripstoneSpike]: 'spike',
  [BlockId.Water]: 'water',
  [BlockId.Sand]: 'sand',
  [BlockId.SnowBlock]: 'snow',
  [BlockId.SnowGrass]: 'snow',
};

export function getBlockSoundMaterial(block: BlockId): BlockSoundMaterial {
  return PROFILES[block] ?? 'soil';
}
