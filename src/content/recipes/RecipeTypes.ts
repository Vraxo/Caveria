import { ItemId } from '../../items/ItemTypes';

export interface CraftingRecipe {
  name: string;
  /** Shaped pattern trimmed to minimal bounding box (rows of columns, null = empty). */
  pattern: ReadonlyArray<ReadonlyArray<ItemId | null>>;
  outputId: ItemId;
  outputCount: number;
}
