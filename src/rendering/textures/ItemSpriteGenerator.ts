import { ItemId } from '../../items/ItemTypes';
import { createDefaultItemSpritePainterRegistry } from './DefaultItemSpritePainters';
import {
  ItemSpritePainterRegistry,
  type ItemSpritePixelWriter,
} from './ItemSpritePainterRegistry';
import { createCanvas2D } from './PixelArt';

/** Generates and caches 16×16 procedural sprites through registered item painters. */
export class ItemSpriteGenerator {
  private readonly cache = new Map<ItemId, HTMLCanvasElement>();

  public constructor(
    private readonly painters: ItemSpritePainterRegistry = createDefaultItemSpritePainterRegistry()
  ) {}

  public getOrCreateItemSprite16(itemId: ItemId): HTMLCanvasElement {
    const existing = this.cache.get(itemId);
    if (existing) return existing;

    const { canvas, context } = createCanvas2D(16, 16, 'item sprite');
    const image = context.createImageData(16, 16);
    const pixel: ItemSpritePixelWriter = (x, y, color) => {
      if (x < 0 || x >= 16 || y < 0 || y >= 16) return;
      const index = (y * 16 + x) * 4;
      image.data[index] = color[0];
      image.data[index + 1] = color[1];
      image.data[index + 2] = color[2];
      image.data[index + 3] = color[3];
    };

    this.painters.paint(itemId, pixel);
    context.putImageData(image, 0, 0);
    this.cache.set(itemId, canvas);
    return canvas;
  }
}
