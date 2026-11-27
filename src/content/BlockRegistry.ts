import { BASE_BLOCKS } from './BaseBlockDefinitions';
import { BIOME_BLOCKS } from './BiomeBlockDefinitions';
import { BlockId } from './BlockId';
import { BlockCatalog, BlockDefinition } from './BlockTypes';
import { CAVERN_BLOCKS } from './CavernBlockDefinitions';
import { TileIndex } from './TileIndex';
import { validateBlockLootTable } from './loot/BlockLoot';

function buildBlockRegistry(...catalogs: BlockCatalog[]): Record<BlockId, BlockDefinition> {
  const registry: Partial<Record<BlockId, BlockDefinition>> = {};

  for (const catalog of catalogs) {
    for (const [rawId, definition] of Object.entries(catalog)) {
      if (!definition) continue;
      const id = Number(rawId) as BlockId;
      if (registry[id]) throw new Error(`Duplicate block definition for BlockId ${id}`);
      if (definition.id !== id) {
        throw new Error(`Block registry key ${id} does not match definition id ${definition.id}`);
      }
      validateBlockDefinition(definition);
      registry[id] = definition;
    }
  }

  const ids = Object.values(BlockId).filter((value): value is BlockId => typeof value === 'number');
  const missing = ids.filter((id) => !registry[id]);
  if (missing.length > 0) {
    throw new Error(`Missing definitions for BlockId values: ${missing.join(', ')}`);
  }

  return registry as Record<BlockId, BlockDefinition>;
}

function validateBlockDefinition(definition: BlockDefinition): void {
  if (definition.lightEmission < 0 || definition.lightEmission > 15) {
    throw new Error(`${definition.name} has lightEmission outside 0..15`);
  }
  if (definition.lightOpacity < 0 || definition.lightOpacity > 15) {
    throw new Error(`${definition.name} has lightOpacity outside 0..15`);
  }
  if (definition.liquid && definition.solid) {
    throw new Error(`${definition.name} cannot be both liquid and solid`);
  }
  if (definition.shape !== 'cube' && !definition.transparent) {
    throw new Error(`${definition.name} uses ${definition.shape} geometry but is not transparent`);
  }
  validateBlockLootTable(definition.lootTable, definition.name);
  if (definition.supportLossLootTable) {
    validateBlockLootTable(definition.supportLossLootTable, `${definition.name} support-loss`);
  }

  const validTiles = new Set(
    Object.values(TileIndex).filter((value): value is TileIndex => typeof value === 'number')
  );
  for (const tile of definition.faces) {
    if (!validTiles.has(tile)) throw new Error(`${definition.name} references invalid tile ${tile}`);
  }
}

export const BLOCKS = buildBlockRegistry(BASE_BLOCKS, BIOME_BLOCKS, CAVERN_BLOCKS);
