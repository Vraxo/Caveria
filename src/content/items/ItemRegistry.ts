import { ItemCatalog, ItemDefinition, ItemId } from '../../items/ItemTypes';
import { BLOCK_ITEM_DEFINITIONS } from './BlockItemDefinitions';
import { EQUIPMENT_ITEM_DEFINITIONS } from './EquipmentItemDefinitions';
import { MATERIAL_ITEM_DEFINITIONS } from './MaterialItemDefinitions';

function buildItemRegistry(...catalogs: ItemCatalog[]): Record<number, ItemDefinition> {
  const registry: Record<number, ItemDefinition> = {};
  for (const catalog of catalogs) {
    for (const [rawId, definition] of Object.entries(catalog)) {
      if (!definition) continue;
      const id = Number(rawId) as ItemId;
      if (registry[id]) throw new Error(`Duplicate item definition for id ${id}`);
      if (definition.id !== id) throw new Error(`Item definition id mismatch for ${id}`);
      registry[id] = definition;
    }
  }
  const expectedIds = Object.values(ItemId).filter((value): value is ItemId => typeof value === 'number');
  const missing = expectedIds.filter((id) => !registry[id]);
  if (missing.length > 0) throw new Error(`Missing item definitions: ${missing.join(', ')}`);
  return registry;
}

export const ITEMS = buildItemRegistry(
  BLOCK_ITEM_DEFINITIONS,
  MATERIAL_ITEM_DEFINITIONS,
  EQUIPMENT_ITEM_DEFINITIONS
);
