import { ItemId } from '../../items/ItemTypes';
import type { RGBA } from './PixelArt';
import {
  ItemSpritePainterRegistry,
  type ItemSpritePixelWriter,
} from './ItemSpritePainterRegistry';

function createDrawingHelpers(px: ItemSpritePixelWriter) {
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

  return { drawPickaxeHead, drawAxeHead, drawSword, drawArmor, drawShovelHead };
}

export function createDefaultItemSpritePainterRegistry(): ItemSpritePainterRegistry {
  const registry = new ItemSpritePainterRegistry();
  registry.register(ItemId.Stick, (px, _itemId) => {
      for (let i = 3; i <= 12; i++) {
        px(i, 15 - i, [168, 128, 74, 255]);
        px(i + 1, 15 - i, [116, 84, 46, 255]);
      }
  });
  registry.register(ItemId.Coal, (px, _itemId) => {
      for (let y = 4; y <= 12; y++) {
        for (let x = 4; x <= 11; x++) {
          const d = Math.hypot(x - 7.5, y - 8.2);
          if (d < 4.1) {
            const hi = x < 7 && y < 8 ? 28 : 0;
            px(x, y, [34 + hi, 36 + hi, 42 + hi, 255]);
          }
        }
      }
  });
  registry.register(ItemId.CrystalShard, (px, _itemId) => {
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
  });
  registry.register(ItemId.CaveChitin, (px, _itemId) => {
      for (let y = 4; y <= 12; y++) {
        for (let x = 3; x <= 12; x++) {
          const edge = Math.abs(x - 7.5) + Math.abs(y - 8) * 0.8;
          if (edge < 5.2) px(x, y, edge > 4 ? [62, 38, 32, 255] : [124, 66, 48, 255]);
        }
      }
      px(5, 5, [224, 94, 58, 255]);
      px(10, 5, [224, 94, 58, 255]);
  });
  registry.register(ItemId.CaveBerries, (px, _itemId) => {
      for (const [x, y] of [[5, 7], [8, 6], [10, 9], [6, 11]] as Array<[number, number]>) {
        px(x, y, [110, 26, 150, 255]);
        px(x + 1, y, [188, 64, 220, 255]);
        px(x, y + 1, [150, 38, 192, 255]);
        px(x + 1, y + 1, [84, 20, 122, 255]);
      }
      px(7, 4, [76, 148, 62, 255]);
      px(7, 5, [68, 126, 52, 255]);
      px(6, 5, [92, 166, 72, 255]);
  });
  registry.register(ItemId.RoastedCaveShroom, (px, _itemId) => {
      for (let y = 4; y <= 9; y++) for (let x = 3; x <= 12; x++) {
        if (Math.abs(x - 7.5) + Math.abs(y - 6.5) * 1.4 < 5.8) {
          px(x, y, y < 6 ? [232, 142, 72, 255] : [174, 76, 42, 255]);
        }
      }
      for (let y = 9; y <= 13; y++) for (let x = 6; x <= 9; x++) px(x, y, [198, 154, 104, 255]);
      px(5, 6, [255, 198, 104, 255]);
      px(10, 7, [112, 48, 32, 255]);
  });
  registry.register(ItemId.CaveStew, (px, _itemId) => {
      for (let y = 7; y <= 13; y++) for (let x = 3; x <= 12; x++) {
        if (Math.abs(x - 7.5) + Math.abs(y - 10) * 0.65 < 5.3) {
          px(x, y, y < 9 ? [208, 94, 62, 255] : [112, 66, 48, 255]);
        }
      }
      for (let x = 4; x <= 11; x++) px(x, 7, [238, 152, 74, 255]);
      px(6, 6, [188, 64, 220, 255]);
      px(9, 6, [228, 178, 112, 255]);
  });
  registry.register(ItemId.GoldIngot, (px, _itemId) => {
      for (let y = 6; y <= 11; y++) for (let x = 3; x <= 12; x++) {
        const bevel = (x === 3 || x === 12 || y === 6 || y === 11);
        px(x, y, bevel ? [174, 112, 16, 255] : x < 7 && y < 9 ? [255, 232, 108, 255] : [238, 178, 38, 255]);
      }
      px(5, 5, [255, 244, 160, 255]);
      px(10, 5, [214, 148, 24, 255]);
  });
  registry.register(ItemId.CactusGreen, (px, _itemId) => {
      for (let y = 4; y <= 12; y++) for (let x = 4; x <= 11; x++) {
        const d = Math.abs(x - 7.5) + Math.abs(y - 8) * 0.7;
        if (d < 5) px(x, y, d > 4 ? [28, 86, 40, 255] : [54, 154, 66, 255]);
      }
      px(6, 5, [112, 210, 104, 255]);
  });
  registry.register(ItemId.WovenFiber, (px, _itemId) => {
      for (let strand = 0; strand < 5; strand++) {
        for (let i = 0; i < 9; i++) {
          const x = 3 + i;
          const y = 4 + strand * 2 + (i % 2);
          px(x, y, strand % 2 === 0 ? [184, 154, 96, 255] : [128, 106, 66, 255]);
          px(x, y + 1, [92, 78, 52, 255]);
        }
      }
  });
  registry.register(ItemId.HealingPoultice, (px, _itemId) => {
      for (let y = 5; y <= 12; y++) for (let x = 4; x <= 11; x++) {
        if (Math.abs(x - 7.5) + Math.abs(y - 8.5) < 5.4) px(x, y, (x + y) % 3 ? [202, 184, 132, 255] : [96, 142, 72, 255]);
      }
      px(7, 4, [138, 108, 66, 255]); px(8, 4, [138, 108, 66, 255]);
  });
  registry.register([ItemId.Antidote, ItemId.CrystalTonic, ItemId.PurifiedCrystalTonic, ItemId.CrystalFishTonic], (px, itemId) => {
    {
      const tonic = itemId === ItemId.CrystalTonic || itemId === ItemId.PurifiedCrystalTonic || itemId === ItemId.CrystalFishTonic;
      for (let y = 5; y <= 13; y++) for (let x = 5; x <= 10; x++) {
        const edge = x === 5 || x === 10 || y === 13;
        px(x, y, edge ? [184, 208, 214, 255] : itemId === ItemId.CrystalFishTonic ? [56, 214, 220, 255] : itemId === ItemId.PurifiedCrystalTonic ? [92, 174, 242, 255] : tonic ? [148, 74, 220, 255] : [70, 174, 112, 255]);
      }
      px(7, 3, [142, 106, 66, 255]); px(8, 3, [142, 106, 66, 255]);
      px(7, 4, [214, 226, 222, 255]); px(8, 4, [214, 226, 222, 255]);
    }
  });
  registry.register(ItemId.WarmingStew, (px, _itemId) => {
      for (let y = 7; y <= 13; y++) for (let x = 3; x <= 12; x++) {
        if (Math.abs(x - 7.5) + Math.abs(y - 10) * 0.65 < 5.3) px(x, y, y < 9 ? [236, 120, 54, 255] : [108, 68, 44, 255]);
      }
      px(5, 6, [255, 190, 76, 255]); px(9, 6, [192, 66, 82, 255]);
  });
  registry.register(ItemId.FishingRod, (px, _itemId) => {
      for (let i = 0; i < 11; i++) {
        px(2 + i, 13 - i, i % 3 === 0 ? [154, 102, 54, 255] : [108, 70, 38, 255]);
        if (i < 7) px(3 + i, 13 - i, [128, 82, 44, 255]);
      }
      for (let y = 4; y <= 12; y++) px(13, y, [216, 224, 218, 255]);
      px(12, 12, [216, 224, 218, 255]); px(11, 12, [216, 224, 218, 255]);
      px(11, 11, [216, 224, 218, 255]);
  });
  registry.register([ItemId.RawCaveFish, ItemId.RawRiverFish, ItemId.CrystalFish, ItemId.CookedCaveFish, ItemId.CookedRiverFish, ItemId.BlightedFish], (px, itemId) => {
    {
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
    }
  });
  registry.register([ItemId.RawChicken, ItemId.CookedChicken, ItemId.RawMutton, ItemId.CookedMutton], (px, itemId) => {
    {
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
    }
  });
  registry.register(ItemId.Shears, (px, _itemId) => {
      for (let i = 0; i < 8; i++) {
        px(4 + i, 11 - i, [232, 188, 54, 255]);
        px(11 - i, 11 - i, [190, 138, 30, 255]);
      }
      for (const [x, y] of [[3, 12], [4, 13], [11, 12], [10, 13]] as Array<[number, number]>) {
        px(x, y, [152, 102, 24, 255]);
        px(x + 1, y, [232, 188, 54, 255]);
      }
  });
  registry.register([ItemId.Egg, ItemId.CookedEgg], (px, itemId) => {
    {
      const cooked = itemId === ItemId.CookedEgg;
      for (let y = 3; y <= 13; y++) for (let x = 4; x <= 11; x++) {
        const dx = Math.abs(x - 7.5);
        const dy = Math.abs(y - 8);
        if (dx * 1.3 + dy < 6) px(x, y, cooked ? [244, 236, 202, 255] : [224, 214, 176, 255]);
      }
      if (cooked) for (let y = 7; y <= 10; y++) for (let x = 6; x <= 9; x++) px(x, y, [238, 176, 46, 255]);
    }
  });
  registry.register(ItemId.Feather, (px, _itemId) => {
      for (let i = 2; i <= 13; i++) {
        px(14 - i, i, [220, 224, 218, 255]);
        if (i > 4 && i < 12) px(13 - i, i, [246, 244, 228, 255]);
        if (i > 3 && i < 10) px(15 - i, i, [178, 188, 184, 255]);
      }
  });
  registry.register(ItemId.Wool, (px, _itemId) => {
      for (const [x, y] of [[5, 6], [8, 5], [10, 7], [6, 9], [9, 10], [7, 12]] as Array<[number, number]>) {
        px(x, y, [240, 238, 220, 255]); px(x + 1, y, [220, 218, 202, 255]);
        px(x, y + 1, [232, 230, 212, 255]); px(x + 1, y + 1, [196, 198, 188, 255]);
      }
  });
  registry.register([ItemId.GlassBottle, ItemId.DirtyWaterBottle, ItemId.CleanWaterBottle], (px, itemId) => {
    {
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
    }
  });
  registry.register(ItemId.SmokedCaveShroom, (px, _itemId) => {
      for (let y = 4; y <= 8; y++) for (let x = 3; x <= 12; x++) {
        if (Math.abs(x - 7.5) + Math.abs(y - 7) < 6) px(x, y, (x + y) % 3 ? [116, 60, 54, 255] : [76, 42, 38, 255]);
      }
      for (let y = 9; y <= 13; y++) { px(7, y, [174, 142, 102, 255]); px(8, y, [142, 108, 78, 255]); }
  });
  registry.register(ItemId.WoodenHoe, (px, _itemId) => {
      for (let i = 0; i < 10; i++) px(5 + Math.floor(i * 0.45), 13 - i, [128, 86, 48, 255]);
      for (let x = 5; x <= 12; x++) {
        px(x, 3, x === 12 ? [92, 58, 34, 255] : [166, 112, 58, 255]);
        if (x > 8) px(x, 4, [112, 72, 40, 255]);
      }
  });
  registry.register(ItemId.DriedCaveBerries, (px, _itemId) => {
      for (const [x, y] of [[5, 6], [8, 5], [11, 7], [6, 10], [9, 11], [12, 10]]) {
        px(x, y, [132, 36, 62, 255]);
        px(x + 1, y, [184, 54, 76, 255]);
        px(x, y + 1, [92, 30, 48, 255]);
      }
      px(8, 3, [74, 126, 54, 255]);
  });
  registry.register(ItemId.Bow, (px, _itemId) => {
      for (let y = 2; y <= 13; y++) {
        const x = y <= 7 ? 11 - Math.floor((y - 2) * 0.7) : 8 + Math.floor((y - 8) * 0.7);
        px(x, y, [152, 96, 48, 255]);
        if (x > 0) px(x - 1, y, [104, 64, 34, 255]);
      }
      for (let y = 2; y <= 13; y++) px(11, y, [210, 188, 132, 255]);
  });
  registry.register(ItemId.Arrow, (px, _itemId) => {
      for (let i = 0; i < 10; i++) {
        px(3 + i, 12 - i, [132, 94, 54, 255]);
        if (i > 1 && i < 8) px(3 + i, 13 - i, [88, 62, 40, 255]);
      }
      px(12, 2, [220, 152, 246, 255]);
      px(13, 2, [174, 72, 222, 255]);
      px(13, 3, [190, 92, 234, 255]);
      px(2, 12, [204, 188, 154, 255]);
      px(3, 13, [204, 188, 154, 255]);
  });
  registry.register(ItemId.AmethystShard, (px, _itemId) => {
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
  });
  registry.register(ItemId.WoodenPickaxe, (px, _itemId) => {
    const { drawPickaxeHead } = createDrawingHelpers(px);
      drawPickaxeHead('wood');
  });
  registry.register(ItemId.WoodenAxe, (px, _itemId) => {
    const { drawAxeHead } = createDrawingHelpers(px);
      drawAxeHead('wood');
  });
  registry.register(ItemId.WoodenShovel, (px, _itemId) => {
    const { drawShovelHead } = createDrawingHelpers(px);
      drawShovelHead('wood');
  });
  registry.register(ItemId.WoodenSword, (px, _itemId) => {
    const { drawSword } = createDrawingHelpers(px);
      drawSword('wood');
  });
  registry.register(ItemId.StonePickaxe, (px, _itemId) => {
    const { drawPickaxeHead } = createDrawingHelpers(px);
      drawPickaxeHead('stone');
  });
  registry.register(ItemId.StoneAxe, (px, _itemId) => {
    const { drawAxeHead } = createDrawingHelpers(px);
      drawAxeHead('stone');
  });
  registry.register(ItemId.StoneShovel, (px, _itemId) => {
    const { drawShovelHead } = createDrawingHelpers(px);
      drawShovelHead('stone');
  });
  registry.register(ItemId.StoneSword, (px, _itemId) => {
    const { drawSword } = createDrawingHelpers(px);
      drawSword('stone');
  });
  registry.register(ItemId.GoldPickaxe, (px, _itemId) => {
    const { drawPickaxeHead } = createDrawingHelpers(px);
      drawPickaxeHead('gold');
  });
  registry.register(ItemId.GoldAxe, (px, _itemId) => {
    const { drawAxeHead } = createDrawingHelpers(px);
      drawAxeHead('gold');
  });
  registry.register(ItemId.GoldShovel, (px, _itemId) => {
    const { drawShovelHead } = createDrawingHelpers(px);
      drawShovelHead('gold');
  });
  registry.register(ItemId.GoldSword, (px, _itemId) => {
    const { drawSword } = createDrawingHelpers(px);
      drawSword('gold');
  });
  registry.register(ItemId.CrystalPickaxe, (px, _itemId) => {
    const { drawPickaxeHead } = createDrawingHelpers(px);
      drawPickaxeHead('crystal');
  });
  registry.register(ItemId.CrystalSword, (px, _itemId) => {
    const { drawSword } = createDrawingHelpers(px);
      drawSword('crystal');
  });
  registry.register(ItemId.ChitinHelmet, (px, _itemId) => {
    const { drawArmor } = createDrawingHelpers(px);
      drawArmor('helmet');
  });
  registry.register(ItemId.ChitinChestplate, (px, _itemId) => {
    const { drawArmor } = createDrawingHelpers(px);
      drawArmor('chestplate');
  });
  registry.register(ItemId.ChitinLeggings, (px, _itemId) => {
    const { drawArmor } = createDrawingHelpers(px);
      drawArmor('leggings');
  });
  registry.register(ItemId.ChitinBoots, (px, _itemId) => {
    const { drawArmor } = createDrawingHelpers(px);
      drawArmor('boots');
  });
  registry.register(ItemId.GoldHelmet, (px, _itemId) => {
    const { drawArmor } = createDrawingHelpers(px);
      drawArmor('helmet', 'gold');
  });
  registry.register(ItemId.GoldChestplate, (px, _itemId) => {
    const { drawArmor } = createDrawingHelpers(px);
      drawArmor('chestplate', 'gold');
  });
  registry.register(ItemId.GoldLeggings, (px, _itemId) => {
    const { drawArmor } = createDrawingHelpers(px);
      drawArmor('leggings', 'gold');
  });
  registry.register(ItemId.GoldBoots, (px, _itemId) => {
    const { drawArmor } = createDrawingHelpers(px);
      drawArmor('boots', 'gold');
  });
  return registry;
}
