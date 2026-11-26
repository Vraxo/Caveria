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

    type ToolTier = 'wood' | 'stone' | 'gold' | 'crystal';
    const tierPalette = (
      tier: ToolTier
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
      if (tier === 'gold') {
        return {
          main: [238, 178, 38, 255],
          hi: [255, 238, 126, 255],
          edge: [166, 104, 14, 255],
        };
      }
      return {
        main: [86, 224, 242, 255],
        hi: [215, 252, 255, 255],
        edge: [38, 138, 168, 255],
      };
    };

    const drawPickaxeHead = (tier: ToolTier) => {
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

    const drawAxeHead = (tier: ToolTier) => {
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

    const drawSword = (tier: ToolTier) => {
      const p = tierPalette(tier);
      for (let i = 3; i <= 12; i++) {
        px(i, 14 - i, i < 5 ? [120, 82, 44, 255] : p.main);
        if (i > 5) px(i + 1, 14 - i, p.hi);
      }
      for (let i = 0; i < 5; i++) px(3 + i, 11 - i, p.edge);
      px(2, 12, [104, 70, 38, 255]);
      px(3, 13, [146, 102, 54, 255]);
      px(4, 12, [146, 102, 54, 255]);
    };

    const drawArmor = (
      piece: 'helmet' | 'chestplate' | 'leggings' | 'boots',
      material: 'chitin' | 'gold' = 'chitin'
    ) => {
      const shell: RGBA = material === 'gold' ? [238, 178, 38, 255] : [126, 72, 54, 255];
      const edge: RGBA = material === 'gold' ? [154, 94, 12, 255] : [62, 38, 34, 255];
      const shine: RGBA = material === 'gold' ? [255, 240, 142, 255] : [202, 116, 72, 255];
      const fillRect = (x0: number, y0: number, x1: number, y1: number, color: RGBA) => {
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(x, y, color);
      };
      if (piece === 'helmet') {
        fillRect(3, 4, 12, 9, edge);
        fillRect(4, 3, 11, 8, shell);
        fillRect(5, 4, 10, 5, shine);
        fillRect(6, 8, 9, 10, [0, 0, 0, 0]);
      } else if (piece === 'chestplate') {
        fillRect(4, 4, 11, 13, edge);
        fillRect(2, 5, 13, 8, edge);
        fillRect(5, 4, 10, 12, shell);
        fillRect(3, 5, 4, 9, shell);
        fillRect(11, 5, 12, 9, shell);
        fillRect(6, 5, 9, 6, shine);
      } else if (piece === 'leggings') {
        fillRect(4, 3, 11, 8, edge);
        fillRect(5, 4, 10, 7, shell);
        fillRect(4, 8, 7, 13, edge);
        fillRect(8, 8, 11, 13, edge);
        fillRect(5, 8, 6, 12, shell);
        fillRect(9, 8, 10, 12, shell);
        fillRect(6, 4, 9, 5, shine);
      } else {
        fillRect(3, 7, 7, 12, edge);
        fillRect(8, 7, 12, 12, edge);
        fillRect(4, 7, 6, 10, shell);
        fillRect(9, 7, 11, 10, shell);
        fillRect(3, 11, 7, 13, shell);
        fillRect(8, 11, 12, 13, shell);
        px(4, 8, shine);
        px(9, 8, shine);
      }
    };

    const drawShovelHead = (tier: ToolTier) => {
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
      case ItemId.CaveChitin:
        for (let y = 4; y <= 12; y++) {
          for (let x = 3; x <= 12; x++) {
            const edge = Math.abs(x - 7.5) + Math.abs(y - 8) * 0.8;
            if (edge < 5.2) px(x, y, edge > 4 ? [62, 38, 32, 255] : [124, 66, 48, 255]);
          }
        }
        px(5, 5, [224, 94, 58, 255]);
        px(10, 5, [224, 94, 58, 255]);
        break;
      case ItemId.CaveBerries:
        for (const [x, y] of [[5, 7], [8, 6], [10, 9], [6, 11]] as Array<[number, number]>) {
          px(x, y, [110, 26, 150, 255]);
          px(x + 1, y, [188, 64, 220, 255]);
          px(x, y + 1, [150, 38, 192, 255]);
          px(x + 1, y + 1, [84, 20, 122, 255]);
        }
        px(7, 4, [76, 148, 62, 255]);
        px(7, 5, [68, 126, 52, 255]);
        px(6, 5, [92, 166, 72, 255]);
        break;
      case ItemId.RoastedCaveShroom:
        for (let y = 4; y <= 9; y++) for (let x = 3; x <= 12; x++) {
          if (Math.abs(x - 7.5) + Math.abs(y - 6.5) * 1.4 < 5.8) {
            px(x, y, y < 6 ? [232, 142, 72, 255] : [174, 76, 42, 255]);
          }
        }
        for (let y = 9; y <= 13; y++) for (let x = 6; x <= 9; x++) px(x, y, [198, 154, 104, 255]);
        px(5, 6, [255, 198, 104, 255]);
        px(10, 7, [112, 48, 32, 255]);
        break;
      case ItemId.CaveStew:
        for (let y = 7; y <= 13; y++) for (let x = 3; x <= 12; x++) {
          if (Math.abs(x - 7.5) + Math.abs(y - 10) * 0.65 < 5.3) {
            px(x, y, y < 9 ? [208, 94, 62, 255] : [112, 66, 48, 255]);
          }
        }
        for (let x = 4; x <= 11; x++) px(x, 7, [238, 152, 74, 255]);
        px(6, 6, [188, 64, 220, 255]);
        px(9, 6, [228, 178, 112, 255]);
        break;
      case ItemId.GoldIngot:
        for (let y = 6; y <= 11; y++) for (let x = 3; x <= 12; x++) {
          const bevel = (x === 3 || x === 12 || y === 6 || y === 11);
          px(x, y, bevel ? [174, 112, 16, 255] : x < 7 && y < 9 ? [255, 232, 108, 255] : [238, 178, 38, 255]);
        }
        px(5, 5, [255, 244, 160, 255]);
        px(10, 5, [214, 148, 24, 255]);
        break;
      case ItemId.CactusGreen:
        for (let y = 4; y <= 12; y++) for (let x = 4; x <= 11; x++) {
          const d = Math.abs(x - 7.5) + Math.abs(y - 8) * 0.7;
          if (d < 5) px(x, y, d > 4 ? [28, 86, 40, 255] : [54, 154, 66, 255]);
        }
        px(6, 5, [112, 210, 104, 255]);
        break;
      case ItemId.WovenFiber:
        for (let strand = 0; strand < 5; strand++) {
          for (let i = 0; i < 9; i++) {
            const x = 3 + i;
            const y = 4 + strand * 2 + (i % 2);
            px(x, y, strand % 2 === 0 ? [184, 154, 96, 255] : [128, 106, 66, 255]);
            px(x, y + 1, [92, 78, 52, 255]);
          }
        }
        break;
      case ItemId.HealingPoultice:
        for (let y = 5; y <= 12; y++) for (let x = 4; x <= 11; x++) {
          if (Math.abs(x - 7.5) + Math.abs(y - 8.5) < 5.4) px(x, y, (x + y) % 3 ? [202, 184, 132, 255] : [96, 142, 72, 255]);
        }
        px(7, 4, [138, 108, 66, 255]); px(8, 4, [138, 108, 66, 255]);
        break;
      case ItemId.Antidote:
      case ItemId.CrystalTonic:
      case ItemId.PurifiedCrystalTonic:
      case ItemId.CrystalFishTonic: {
        const tonic = itemId === ItemId.CrystalTonic || itemId === ItemId.PurifiedCrystalTonic || itemId === ItemId.CrystalFishTonic;
        for (let y = 5; y <= 13; y++) for (let x = 5; x <= 10; x++) {
          const edge = x === 5 || x === 10 || y === 13;
          px(x, y, edge ? [184, 208, 214, 255] : itemId === ItemId.CrystalFishTonic ? [56, 214, 220, 255] : itemId === ItemId.PurifiedCrystalTonic ? [92, 174, 242, 255] : tonic ? [148, 74, 220, 255] : [70, 174, 112, 255]);
        }
        px(7, 3, [142, 106, 66, 255]); px(8, 3, [142, 106, 66, 255]);
        px(7, 4, [214, 226, 222, 255]); px(8, 4, [214, 226, 222, 255]);
        break;
      }
      case ItemId.WarmingStew:
        for (let y = 7; y <= 13; y++) for (let x = 3; x <= 12; x++) {
          if (Math.abs(x - 7.5) + Math.abs(y - 10) * 0.65 < 5.3) px(x, y, y < 9 ? [236, 120, 54, 255] : [108, 68, 44, 255]);
        }
        px(5, 6, [255, 190, 76, 255]); px(9, 6, [192, 66, 82, 255]);
        break;
      case ItemId.FishingRod:
        for (let i = 0; i < 11; i++) {
          px(2 + i, 13 - i, i % 3 === 0 ? [154, 102, 54, 255] : [108, 70, 38, 255]);
          if (i < 7) px(3 + i, 13 - i, [128, 82, 44, 255]);
        }
        for (let y = 4; y <= 12; y++) px(13, y, [216, 224, 218, 255]);
        px(12, 12, [216, 224, 218, 255]); px(11, 12, [216, 224, 218, 255]);
        px(11, 11, [216, 224, 218, 255]);
        break;
      case ItemId.RawCaveFish:
      case ItemId.RawRiverFish:
      case ItemId.CrystalFish:
      case ItemId.CookedCaveFish:
      case ItemId.CookedRiverFish:
      case ItemId.BlightedFish: {
        const crystal = itemId === ItemId.CrystalFish;
        const blighted = itemId === ItemId.BlightedFish;
        const cooked = itemId === ItemId.CookedCaveFish || itemId === ItemId.CookedRiverFish;
        const river = itemId === ItemId.RawRiverFish || itemId === ItemId.CookedRiverFish;
        const body = crystal ? [80, 224, 234, 255] : blighted ? [112, 70, 132, 255] : cooked ? [208, 128, 66, 255] : river ? [88, 162, 208, 255] : [106, 124, 148, 255];
        for (let y = 6; y <= 10; y++) for (let x = 4; x <= 11; x++) {
          if (Math.abs(y - 8) + Math.abs(x - 7.5) * 0.45 <= 3.5) px(x, y, body as [number, number, number, number]);
        }
        px(2, 6, body as [number, number, number, number]); px(3, 7, body as [number, number, number, number]);
        px(3, 9, body as [number, number, number, number]); px(2, 10, body as [number, number, number, number]);
        px(10, 7, [238, 242, 224, 255]); px(11, 7, [28, 32, 38, 255]);
        if (crystal) { px(6, 5, [178, 112, 242, 255]); px(8, 11, [178, 112, 242, 255]); }
        break;
      }
      case ItemId.RawChicken:
      case ItemId.CookedChicken:
      case ItemId.RawMutton:
      case ItemId.CookedMutton: {
        const cooked = itemId === ItemId.CookedChicken || itemId === ItemId.CookedMutton;
        const mutton = itemId === ItemId.RawMutton || itemId === ItemId.CookedMutton;
        const meat = cooked
          ? (mutton ? [154, 82, 44, 255] : [202, 126, 68, 255])
          : (mutton ? [190, 70, 82, 255] : [224, 126, 130, 255]);
        for (let y = 5; y <= 12; y++) for (let x = 4; x <= 11; x++) {
          const distance = Math.abs(x - 7.5) + Math.abs(y - 8.5) * 0.75;
          if (distance < 5) px(x, y, meat as [number, number, number, number]);
        }
        px(4, 5, [238, 224, 190, 255]); px(3, 4, [238, 224, 190, 255]);
        px(11, 11, cooked ? [108, 58, 36, 255] : [152, 54, 62, 255]);
        break;
      }
      case ItemId.Feather:
        for (let i = 2; i <= 13; i++) {
          px(14 - i, i, [220, 224, 218, 255]);
          if (i > 4 && i < 12) px(13 - i, i, [246, 244, 228, 255]);
          if (i > 3 && i < 10) px(15 - i, i, [178, 188, 184, 255]);
        }
        break;
      case ItemId.Wool:
        for (const [x, y] of [[5, 6], [8, 5], [10, 7], [6, 9], [9, 10], [7, 12]] as Array<[number, number]>) {
          px(x, y, [240, 238, 220, 255]); px(x + 1, y, [220, 218, 202, 255]);
          px(x, y + 1, [232, 230, 212, 255]); px(x + 1, y + 1, [196, 198, 188, 255]);
        }
        break;
      case ItemId.GlassBottle:
      case ItemId.DirtyWaterBottle:
      case ItemId.CleanWaterBottle: {
        const dirty = itemId === ItemId.DirtyWaterBottle;
        const clean = itemId === ItemId.CleanWaterBottle;
        for (let y = 5; y <= 13; y++) for (let x = 5; x <= 10; x++) {
          const edge = x === 5 || x === 10 || y === 5 || y === 13;
          if (edge) px(x, y, [188, 218, 226, 255]);
          else if (dirty) px(x, y, [112, 90, 58, 235]);
          else if (clean) px(x, y, [78, 174, 232, 220]);
        }
        px(7, 3, [174, 204, 212, 255]); px(8, 3, [174, 204, 212, 255]);
        px(7, 4, [208, 230, 234, 255]); px(8, 4, [208, 230, 234, 255]);
        break;
      }
      case ItemId.SmokedCaveShroom:
        for (let y = 4; y <= 8; y++) for (let x = 3; x <= 12; x++) {
          if (Math.abs(x - 7.5) + Math.abs(y - 7) < 6) px(x, y, (x + y) % 3 ? [116, 60, 54, 255] : [76, 42, 38, 255]);
        }
        for (let y = 9; y <= 13; y++) { px(7, y, [174, 142, 102, 255]); px(8, y, [142, 108, 78, 255]); }
        break;
      case ItemId.WoodenHoe:
        for (let i = 0; i < 10; i++) px(5 + Math.floor(i * 0.45), 13 - i, [128, 86, 48, 255]);
        for (let x = 5; x <= 12; x++) {
          px(x, 3, x === 12 ? [92, 58, 34, 255] : [166, 112, 58, 255]);
          if (x > 8) px(x, 4, [112, 72, 40, 255]);
        }
        break;
      case ItemId.DriedCaveBerries:
        for (const [x, y] of [[5, 6], [8, 5], [11, 7], [6, 10], [9, 11], [12, 10]]) {
          px(x, y, [132, 36, 62, 255]);
          px(x + 1, y, [184, 54, 76, 255]);
          px(x, y + 1, [92, 30, 48, 255]);
        }
        px(8, 3, [74, 126, 54, 255]);
        break;
      case ItemId.Bow:
        for (let y = 2; y <= 13; y++) {
          const x = y <= 7 ? 11 - Math.floor((y - 2) * 0.7) : 8 + Math.floor((y - 8) * 0.7);
          px(x, y, [152, 96, 48, 255]);
          if (x > 0) px(x - 1, y, [104, 64, 34, 255]);
        }
        for (let y = 2; y <= 13; y++) px(11, y, [210, 188, 132, 255]);
        break;
      case ItemId.Arrow:
        for (let i = 0; i < 10; i++) {
          px(3 + i, 12 - i, [132, 94, 54, 255]);
          if (i > 1 && i < 8) px(3 + i, 13 - i, [88, 62, 40, 255]);
        }
        px(12, 2, [220, 152, 246, 255]);
        px(13, 2, [174, 72, 222, 255]);
        px(13, 3, [190, 92, 234, 255]);
        px(2, 12, [204, 188, 154, 255]);
        px(3, 13, [204, 188, 154, 255]);
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
      case ItemId.WoodenSword:
        drawSword('wood');
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
      case ItemId.StoneSword:
        drawSword('stone');
        break;
      case ItemId.GoldPickaxe:
        drawPickaxeHead('gold');
        break;
      case ItemId.GoldAxe:
        drawAxeHead('gold');
        break;
      case ItemId.GoldShovel:
        drawShovelHead('gold');
        break;
      case ItemId.GoldSword:
        drawSword('gold');
        break;
      case ItemId.CrystalPickaxe:
        drawPickaxeHead('crystal');
        break;
      case ItemId.CrystalSword:
        drawSword('crystal');
        break;
      case ItemId.ChitinHelmet:
        drawArmor('helmet');
        break;
      case ItemId.ChitinChestplate:
        drawArmor('chestplate');
        break;
      case ItemId.ChitinLeggings:
        drawArmor('leggings');
        break;
      case ItemId.ChitinBoots:
        drawArmor('boots');
        break;
      case ItemId.GoldHelmet:
        drawArmor('helmet', 'gold');
        break;
      case ItemId.GoldChestplate:
        drawArmor('chestplate', 'gold');
        break;
      case ItemId.GoldLeggings:
        drawArmor('leggings', 'gold');
        break;
      case ItemId.GoldBoots:
        drawArmor('boots', 'gold');
        break;
      default:
        break;
    }

    ctx.putImageData(img, 0, 0);
    this.cache.set(itemId, c);
    return c;
  }

}
