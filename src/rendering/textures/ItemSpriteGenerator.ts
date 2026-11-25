import { ItemId } from '../../items/Item';
import { createCanvas2D, RGBA } from './PixelArt';

/** Generates and caches 16×16 procedural sprites for non-block items and tools. */
export class ItemSpriteGenerator {
  private readonly cache = new Map<ItemId, HTMLCanvasElement>();

  public getOrCreateItemSprite16(itemId: ItemId): HTMLCanvasElement {
    const existing = this.cache.get(itemId);
    if (existing) return existing;

    const { canvas: c, context: ctx } = createCanvas2D(16, 16, 'item sprite');
    const img = ctx.createImageData(16, 16);
    const px = (x: number, y: number, color: RGBA) => {
      if (x < 0 || x >= 16 || y < 0 || y >= 16) return;
      const i = (y * 16 + x) * 4;
      img.data[i] = color[0];
      img.data[i + 1] = color[1];
      img.data[i + 2] = color[2];
      img.data[i + 3] = color[3];
    };

    const drawDiagonalHandle = () => {
      for (let i = 2; i <= 11; i++) {
        const x = i;
        const y = 15 - i;
        px(x, y, [146, 108, 62, 255]);
        if (i < 11) px(x + 1, y, [104, 74, 40, 255]);
      }
    };

    const tierPalette = (
      tier: 'wood' | 'stone' | 'crystal'
    ): { main: RGBA; hi: RGBA; edge: RGBA } => {
      if (tier === 'wood') {
        return {
          main: [176, 138, 84, 255],
          hi: [204, 166, 106, 255],
          edge: [118, 88, 48, 255],
        };
      }
      if (tier === 'stone') {
        return {
          main: [142, 144, 148, 255],
          hi: [182, 184, 190, 255],
          edge: [88, 90, 96, 255],
        };
      }
      return {
        main: [86, 224, 242, 255],
        hi: [215, 252, 255, 255],
        edge: [38, 138, 168, 255],
      };
    };

    const drawPickaxeHead = (tier: 'wood' | 'stone' | 'crystal') => {
      const p = tierPalette(tier);
      drawDiagonalHandle();
      const coords: Array<[number, number, 'main' | 'hi' | 'edge']> = [
        [6, 2, 'edge'], [7, 1, 'hi'], [8, 1, 'hi'], [9, 1, 'main'], [10, 2, 'main'], [11, 2, 'hi'],
        [7, 2, 'main'], [8, 2, 'main'], [9, 2, 'edge'], [12, 3, 'main'], [13, 4, 'main'], [14, 5, 'edge'],
        [11, 3, 'main'], [12, 4, 'hi'], [13, 5, 'main'], [14, 6, 'edge'], [14, 7, 'main'], [13, 8, 'edge'],
        [5, 3, 'edge'], [6, 3, 'main'], [13, 6, 'main'], [13, 7, 'main'],
      ];
      for (const [x, y, kind] of coords) {
        px(x, y, p[kind]);
      }
    };

    const drawAxeHead = (tier: 'wood' | 'stone') => {
      const p = tierPalette(tier);
      drawDiagonalHandle();
      const coords: Array<[number, number, 'main' | 'hi' | 'edge']> = [
        [7, 2, 'hi'], [8, 1, 'hi'], [9, 1, 'main'], [10, 2, 'edge'],
        [6, 3, 'hi'], [7, 3, 'main'], [8, 2, 'main'], [9, 2, 'main'], [10, 3, 'main'], [11, 3, 'edge'],
        [6, 4, 'hi'], [7, 4, 'main'], [8, 3, 'main'], [9, 3, 'edge'], [11, 4, 'main'], [12, 5, 'edge'],
        [7, 5, 'edge'], [8, 5, 'edge'], [11, 5, 'main'], [11, 6, 'edge'],
      ];
      for (const [x, y, kind] of coords) {
        px(x, y, p[kind]);
      }
    };

    const drawShovelHead = (tier: 'wood' | 'stone') => {
      const p = tierPalette(tier);
      drawDiagonalHandle();
      const coords: Array<[number, number, 'main' | 'hi' | 'edge']> = [
        [11, 1, 'hi'], [12, 1, 'hi'], [13, 1, 'main'], [14, 2, 'edge'],
        [10, 2, 'hi'], [11, 2, 'main'], [12, 2, 'main'], [13, 2, 'main'], [14, 3, 'edge'],
        [10, 3, 'edge'], [11, 3, 'main'], [12, 3, 'main'], [13, 3, 'main'], [14, 4, 'edge'],
        [11, 4, 'edge'], [12, 4, 'main'], [13, 4, 'edge'],
      ];
      for (const [x, y, kind] of coords) {
        px(x, y, p[kind]);
      }
    };

    switch (itemId) {
      case ItemId.Stick:
        for (let i = 3; i <= 12; i++) {
          px(i, 15 - i, [168, 128, 74, 255]);
          px(i + 1, 15 - i, [116, 84, 46, 255]);
        }
        break;
      case ItemId.Coal:
        for (let y = 4; y <= 12; y++) {
          for (let x = 4; x <= 11; x++) {
            const d = Math.hypot(x - 7.5, y - 8.2);
            if (d < 4.1) {
              const hi = x < 7 && y < 8 ? 28 : 0;
              px(x, y, [34 + hi, 36 + hi, 42 + hi, 255]);
            }
          }
        }
        break;
      case ItemId.CrystalShard:
        for (let y = 2; y <= 13; y++) {
          for (let x = 4; x <= 11; x++) {
            const dx = Math.abs(x - 7.5);
            const dy = Math.abs(y - 7.5);
            if (dx * 1.6 + dy < 6.2) {
              const core = dx + dy < 2.6;
              px(x, y, core ? [232, 254, 255, 255] : [82, 224, 245, 255]);
            }
          }
        }
        break;
      case ItemId.AmethystShard:
        for (let y = 2; y <= 13; y++) {
          for (let x = 4; x <= 11; x++) {
            const dx = Math.abs(x - 7.5);
            const dy = Math.abs(y - 7.5);
            if (dx * 1.6 + dy < 6.2) {
              const core = dx + dy < 2.6;
              px(x, y, core ? [248, 224, 255, 255] : [188, 96, 242, 255]);
            }
          }
        }
        break;
      case ItemId.WoodenPickaxe:
        drawPickaxeHead('wood');
        break;
      case ItemId.WoodenAxe:
        drawAxeHead('wood');
        break;
      case ItemId.WoodenShovel:
        drawShovelHead('wood');
        break;
      case ItemId.StonePickaxe:
        drawPickaxeHead('stone');
        break;
      case ItemId.StoneAxe:
        drawAxeHead('stone');
        break;
      case ItemId.StoneShovel:
        drawShovelHead('stone');
        break;
      case ItemId.CrystalPickaxe:
        drawPickaxeHead('crystal');
        break;
      default:
        break;
    }

    ctx.putImageData(img, 0, 0);
    this.cache.set(itemId, c);
    return c;
  }

}
