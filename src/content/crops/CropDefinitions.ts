import { ItemId } from '../../items/ItemTypes';
import { BlockId } from '../BlockId';

interface CropDefinitionConfig {
  /** Item planted on farmland. */
  seedItem: ItemId;
  /** Ordered visual/growth stages, from newly planted through mature. */
  stageBlocks: readonly [BlockId, ...BlockId[]];
  growth: {
    minimumSeconds: number;
    varianceSeconds: number;
  };
  harvest: {
    item: ItemId;
    minimum: number;
    maximum: number;
  };
  /** Returned when a planted crop or its farmland is broken or trampled. */
  brokenDrop: {
    item: ItemId;
    count: number;
  };
}

const CROP_CATALOG = {
  berries: {
    seedItem: ItemId.CaveBerries,
    stageBlocks: [BlockId.BerrySprout, BlockId.BerryBush, BlockId.BerryBushMature],
    growth: { minimumSeconds: 32, varianceSeconds: 18 },
    harvest: { item: ItemId.CaveBerries, minimum: 2, maximum: 4 },
    brokenDrop: { item: ItemId.CaveBerries, count: 1 },
  },
  shroom: {
    seedItem: ItemId.CaveShroom,
    stageBlocks: [BlockId.ShroomSprout, BlockId.ShroomGrowing, BlockId.CaveShroom],
    growth: { minimumSeconds: 40, varianceSeconds: 18 },
    harvest: { item: ItemId.CaveShroom, minimum: 2, maximum: 3 },
    brokenDrop: { item: ItemId.CaveShroom, count: 1 },
  },
} as const satisfies Record<string, CropDefinitionConfig>;

export type CropId = keyof typeof CROP_CATALOG;

export interface CropDefinition extends CropDefinitionConfig {
  /** Stable identity persisted in farm snapshots. */
  id: CropId;
}

interface CropRegistry {
  definitions: Readonly<Record<CropId, CropDefinition>>;
  bySeed: ReadonlyMap<ItemId, CropDefinition>;
  byBlock: ReadonlyMap<BlockId, CropDefinition>;
}

function buildCropRegistry(catalog: typeof CROP_CATALOG): CropRegistry {
  const byId: Partial<Record<CropId, CropDefinition>> = {};
  const bySeed = new Map<ItemId, CropDefinition>();
  const byBlock = new Map<BlockId, CropDefinition>();

  for (const [rawId, config] of Object.entries(catalog)) {
    const id = rawId as CropId;
    const definition: CropDefinition = { id, ...config };
    validateCropDefinition(definition);
    if (byId[id]) throw new Error(`Duplicate crop definition: ${id}`);
    if (bySeed.has(definition.seedItem)) {
      throw new Error(`Duplicate crop seed item: ${definition.seedItem}`);
    }
    byId[id] = definition;
    bySeed.set(definition.seedItem, definition);
    for (const block of definition.stageBlocks) {
      if (byBlock.has(block)) throw new Error(`Crop stage block ${block} belongs to multiple crops`);
      byBlock.set(block, definition);
    }
  }

  return {
    definitions: Object.freeze(byId) as Readonly<Record<CropId, CropDefinition>>,
    bySeed,
    byBlock,
  };
}

function validateCropDefinition(definition: CropDefinition): void {
  if (!VALID_ITEM_IDS.has(definition.seedItem)
    || !VALID_ITEM_IDS.has(definition.harvest.item)
    || !VALID_ITEM_IDS.has(definition.brokenDrop.item)) {
    throw new Error(`${definition.id} references an unknown item`);
  }
  if (definition.stageBlocks.length === 0
    || definition.stageBlocks.some((block) => !VALID_BLOCK_IDS.has(block))) {
    throw new Error(`${definition.id} references an unknown crop-stage block`);
  }
  if (definition.growth.minimumSeconds <= 0 || definition.growth.varianceSeconds < 0) {
    throw new Error(`${definition.id} has invalid growth timing`);
  }
  if (!Number.isInteger(definition.harvest.minimum)
    || !Number.isInteger(definition.harvest.maximum)
    || definition.harvest.minimum < 1
    || definition.harvest.maximum < definition.harvest.minimum) {
    throw new Error(`${definition.id} has an invalid harvest range`);
  }
  if (!Number.isInteger(definition.brokenDrop.count) || definition.brokenDrop.count < 1) {
    throw new Error(`${definition.id} has an invalid broken-drop count`);
  }
}

const VALID_ITEM_IDS = new Set(
  Object.values(ItemId).filter((value): value is ItemId => typeof value === 'number')
);
const VALID_BLOCK_IDS = new Set(
  Object.values(BlockId).filter((value): value is BlockId => typeof value === 'number')
);
const REGISTRY = buildCropRegistry(CROP_CATALOG);

export const CROP_DEFINITIONS = REGISTRY.definitions;

export function getCropDefinition(id: unknown): CropDefinition | null {
  return typeof id === 'string'
    ? CROP_DEFINITIONS[id as CropId] ?? null
    : null;
}

export function getCropForSeed(item: ItemId | null): CropDefinition | null {
  return item === null ? null : REGISTRY.bySeed.get(item) ?? null;
}

export function getCropForBlock(block: BlockId): CropDefinition | null {
  return REGISTRY.byBlock.get(block) ?? null;
}
