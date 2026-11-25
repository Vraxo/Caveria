import { BlockId } from '../../content/BlockId';
import { BLOCKS } from '../../content/BlockRegistry';
import { TileIndex } from '../../content/TileIndex';
import { ITEMS, ItemId } from '../../items/Item';
import { createCanvas2D } from './PixelArt';
import { ItemSpriteGenerator } from './ItemSpriteGenerator';

/** Produces cached isometric block previews and inventory icon data URLs. */
export class BlockIconRenderer {
  private readonly blockIconCache = new Map<BlockId, HTMLCanvasElement>();
  private readonly itemIconCache = new Map<ItemId, string>();

  constructor(
    private readonly getTileCanvas: (tile: TileIndex) => HTMLCanvasElement | undefined,
    private readonly itemSprites: ItemSpriteGenerator
  ) {}

  public createBlockIcon(blockId: BlockId): HTMLCanvasElement {
    const cached = this.blockIconCache.get(blockId);
    if (cached) return cached;

    const definition = BLOCKS[blockId];
    const { canvas: icon, context } = createCanvas2D(32, 32, 'block icon');
    context.imageSmoothingEnabled = false;

    if (definition.shape === 'torch' || definition.shape === 'cross') {
      const spriteTile = this.getTileCanvas(definition.faces[0]);
      if (spriteTile) context.drawImage(spriteTile, 0, 0, 16, 16, 3, 2, 26, 28);
      this.blockIconCache.set(blockId, icon);
      return icon;
    }

    const topTile = this.getTileCanvas(definition.faces[2]);
    const sideTile = this.getTileCanvas(definition.faces[4]);
    if (!topTile || !sideTile) return icon;

    context.save();
    context.setTransform(1, 0.5, -1, 0.5, 16, 2);
    context.drawImage(topTile, 0, 0, 14, 14);
    context.restore();

    context.save();
    context.setTransform(1, 0.5, 0, 1, 2, 9);
    context.drawImage(sideTile, 0, 0, 14, 14);
    if (definition.lightEmission === 0) {
      context.fillStyle = 'rgba(0, 0, 0, 0.18)';
      context.fillRect(0, 0, 14, 14);
    }
    context.restore();

    context.save();
    context.setTransform(1, -0.5, 0, 1, 16, 16);
    context.drawImage(sideTile, 0, 0, 14, 14);
    if (definition.lightEmission === 0) {
      context.fillStyle = 'rgba(0, 0, 0, 0.36)';
      context.fillRect(0, 0, 14, 14);
    }
    context.restore();

    this.blockIconCache.set(blockId, icon);
    return icon;
  }

  public getItemIconDataUrl(itemId: ItemId): string {
    const cached = this.itemIconCache.get(itemId);
    if (cached) return cached;

    const definition = ITEMS[itemId];
    let canvas: HTMLCanvasElement;
    if (definition.placeBlockId !== null) {
      canvas = this.createBlockIcon(definition.placeBlockId);
    } else {
      const sprite = this.itemSprites.getOrCreateItemSprite16(itemId);
      const result = createCanvas2D(32, 32, 'item icon');
      result.context.imageSmoothingEnabled = false;
      result.context.drawImage(sprite, 0, 0, 16, 16, 2, 2, 28, 28);
      canvas = result.canvas;
    }

    const url = canvas.toDataURL();
    this.itemIconCache.set(itemId, url);
    return url;
  }
}
