import { ItemId } from '../../items/ItemTypes';
import type { RGBA } from './PixelArt';

export type ItemSpritePixelWriter = (x: number, y: number, color: RGBA) => void;
export type ItemSpritePainter = (pixel: ItemSpritePixelWriter, itemId: ItemId) => void;

/** Maps item identities to small procedural painters without coupling rendering to item branching. */
export class ItemSpritePainterRegistry {
  private readonly painters = new Map<ItemId, ItemSpritePainter>();

  public register(
    items: ItemId | ReadonlyArray<ItemId>,
    painter: ItemSpritePainter
  ): this {
    const ids = Array.isArray(items) ? items : [items];
    for (const item of ids) {
      if (this.painters.has(item)) throw new Error(`Duplicate item sprite painter: ${item}`);
      this.painters.set(item, painter);
    }
    return this;
  }

  public has(item: ItemId): boolean {
    return this.painters.has(item);
  }

  public paint(item: ItemId, pixel: ItemSpritePixelWriter): void {
    const painter = this.painters.get(item);
    if (!painter) throw new Error(`Missing item sprite painter: ${item}`);
    painter(pixel, item);
  }
}
