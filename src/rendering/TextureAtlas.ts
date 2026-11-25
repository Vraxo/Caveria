import * as THREE from 'three';
import { ITEMS, ItemId } from '../items/Item';
import { BLOCKS, BlockId, TileIndex } from '../world/Block';
import { mulberry32 } from '../world/Noise';

export const TILE_SIZE = 16;
export const ATLAS_COLS = 6;
export const ATLAS_ROWS = 6;
export const ATLAS_PIXEL_WIDTH = ATLAS_COLS * TILE_SIZE;
export const ATLAS_PIXEL_HEIGHT = ATLAS_ROWS * TILE_SIZE;

type RGBA = [number, number, number, number];

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function varyColor(base: [number, number, number], delta: number, alpha = 255): RGBA {
  return [
    clampByte(base[0] + delta),
    clampByte(base[1] + delta),
    clampByte(base[2] + delta),
    alpha,
  ];
}

export class TextureAtlas {
  public readonly canvas: HTMLCanvasElement;
  public readonly texture: THREE.CanvasTexture;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tileCanvases = new Map<TileIndex, HTMLCanvasElement>();
  private readonly itemIconCache = new Map<ItemId, string>();
  private readonly itemSpriteCache = new Map<ItemId, HTMLCanvasElement>();

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ATLAS_PIXEL_WIDTH;
    this.canvas.height = ATLAS_PIXEL_HEIGHT;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to acquire 2D canvas context for TextureAtlas');
    }
    this.ctx = ctx;

    this.generateAllTiles();

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
  }

  /**
   * Returns UV bounds [u0, v0, u1, v1] in Three.js UV space (v=0 bottom, v=1 top).
   * Insets by a tiny epsilon to eliminate pixel bleeding between tiles.
   */
  public getTileUVs(tile: TileIndex): [number, number, number, number] {
    const col = tile % ATLAS_COLS;
    const row = Math.floor(tile / ATLAS_COLS);
    const eps = 0.0015;

    const u0 = (col + eps) / ATLAS_COLS;
    const u1 = (col + 1 - eps) / ATLAS_COLS;
    const v1 = 1 - (row + eps) / ATLAS_ROWS;
    const v0 = 1 - (row + 1 - eps) / ATLAS_ROWS;

    return [u0, v0, u1, v1];
  }

  /**
   * Returns UV sub-rectangle within a tile using pixel coords [px0, py0, px1, py1] in 0..16
   * where py=0 is the TOP of the 16x16 tile.
   */
  public getSubTileUVs(
    tile: TileIndex,
    px0: number,
    py0: number,
    px1: number,
    py1: number
  ): [number, number, number, number] {
    const col = tile % ATLAS_COLS;
    const row = Math.floor(tile / ATLAS_COLS);
    const eps = 0.02;

    const u0 = (col * TILE_SIZE + px0 + eps) / ATLAS_PIXEL_WIDTH;
    const u1 = (col * TILE_SIZE + px1 - eps) / ATLAS_PIXEL_WIDTH;
    const v1 = 1 - (row * TILE_SIZE + py0 + eps) / ATLAS_PIXEL_HEIGHT;
    const v0 = 1 - (row * TILE_SIZE + py1 - eps) / ATLAS_PIXEL_HEIGHT;

    return [u0, v0, u1, v1];
  }

  /** Creates a crisp 32x32 preview icon for hotbar UI */
  public createBlockIcon(blockId: BlockId): HTMLCanvasElement {
    const def = BLOCKS[blockId];
    const icon = document.createElement('canvas');
    icon.width = 32;
    icon.height = 32;
    const ic = icon.getContext('2d')!;
    ic.imageSmoothingEnabled = false;

    if (def.shape === 'torch' || def.shape === 'cross') {
      const spriteTile = this.tileCanvases.get(def.faces[0]);
      if (spriteTile) {
        ic.drawImage(spriteTile, 0, 0, 16, 16, 3, 2, 26, 28);
      }
      return icon;
    }

    const topTile = this.tileCanvases.get(def.faces[2]);
    const sideTile = this.tileCanvases.get(def.faces[4]);
    if (!topTile || !sideTile) return icon;

    // Top diamond
    ic.save();
    ic.setTransform(1, 0.5, -1, 0.5, 16, 2);
    ic.drawImage(topTile, 0, 0, 14, 14);
    ic.restore();

    // Left face
    ic.save();
    ic.setTransform(1, 0.5, 0, 1, 2, 9);
    ic.drawImage(sideTile, 0, 0, 14, 14);
    if (def.lightEmission === 0) {
      ic.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ic.fillRect(0, 0, 14, 14);
    }
    ic.restore();

    // Right face
    ic.save();
    ic.setTransform(1, -0.5, 0, 1, 16, 16);
    ic.drawImage(sideTile, 0, 0, 14, 14);
    if (def.lightEmission === 0) {
      ic.fillStyle = 'rgba(0, 0, 0, 0.36)';
      ic.fillRect(0, 0, 14, 14);
    }
    ic.restore();

    return icon;
  }

  /** Returns a cached crisp data-URL icon for any ItemId (blocks, materials, tools). */
  public getItemIconDataUrl(itemId: ItemId): string {
    const cached = this.itemIconCache.get(itemId);
    if (cached) return cached;

    const itemDef = ITEMS[itemId];
    let canvas: HTMLCanvasElement;
    if (itemDef.placeBlockId !== null) {
      canvas = this.createBlockIcon(itemDef.placeBlockId);
    } else {
      const sprite16 = this.getOrCreateItemSprite16(itemId);
      canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite16, 0, 0, 16, 16, 2, 2, 28, 28);
    }

    const url = canvas.toDataURL();
    this.itemIconCache.set(itemId, url);
    return url;
  }

  /** Returns a 16x16 pixel-art canvas for non-block items (tools, sticks, coal, crystal shards). */
  public getOrCreateItemSprite16(itemId: ItemId): HTMLCanvasElement {
    const existing = this.itemSpriteCache.get(itemId);
    if (existing) return existing;

    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const ctx = c.getContext('2d')!;
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
    this.itemSpriteCache.set(itemId, c);
    return c;
  }

  private drawTile(tile: TileIndex, painter: (px: (x: number, y: number, c: RGBA) => void, rng: () => number) => void): void {
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = TILE_SIZE;
    tileCanvas.height = TILE_SIZE;
    const tctx = tileCanvas.getContext('2d')!;
    const img = tctx.createImageData(TILE_SIZE, TILE_SIZE);
    const data = img.data;

    const setPixel = (x: number, y: number, c: RGBA) => {
      if (x < 0 || x >= TILE_SIZE || y < 0 || y >= TILE_SIZE) return;
      const idx = (y * TILE_SIZE + x) * 4;
      data[idx] = c[0];
      data[idx + 1] = c[1];
      data[idx + 2] = c[2];
      data[idx + 3] = c[3];
    };

    const rng = mulberry32(1000 + tile * 977);
    painter(setPixel, rng);

    tctx.putImageData(img, 0, 0);
    this.tileCanvases.set(tile, tileCanvas);

    const col = tile % ATLAS_COLS;
    const row = Math.floor(tile / ATLAS_COLS);
    this.ctx.drawImage(tileCanvas, col * TILE_SIZE, row * TILE_SIZE);
  }

  private generateAllTiles(): void {
    // Grass Top
    this.drawTile(TileIndex.GrassTop, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rng() - 0.5) * 26;
          const blade = rng() > 0.78 ? 12 : 0;
          px(x, y, [clampByte(88 + n - blade * 0.4), clampByte(168 + n + blade), clampByte(62 + n * 0.6), 255]);
        }
      }
    });

    // Dirt
    const dirtPixels: RGBA[][] = [];
    this.drawTile(TileIndex.Dirt, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        dirtPixels[y] = [];
        for (let x = 0; x < 16; x++) {
          const r = rng();
          let c: RGBA;
          if (r < 0.08) {
            c = [105, 76, 52, 255];
          } else if (r > 0.9) {
            c = [152, 108, 72, 255];
          } else {
            c = varyColor([134, 96, 67], (rng() - 0.5) * 24);
          }
          dirtPixels[y][x] = c;
          px(x, y, c);
        }
      }
    });

    // Grass Side
    this.drawTile(TileIndex.GrassSide, (px, rng) => {
      const overhang = [3, 4, 3, 2, 4, 5, 3, 2, 3, 4, 3, 2, 4, 3, 2, 3];
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if (y < overhang[x]) {
            const n = (rng() - 0.5) * 22;
            const edgeDark = y === overhang[x] - 1 ? -14 : 0;
            px(x, y, [clampByte(86 + n + edgeDark), clampByte(164 + n + edgeDark), clampByte(60 + n + edgeDark), 255]);
          } else {
            const base = dirtPixels[y][x];
            const shadow = y === overhang[x] ? -16 : 0;
            px(x, y, [
              clampByte(base[0] + shadow),
              clampByte(base[1] + shadow),
              clampByte(base[2] + shadow),
              255,
            ]);
          }
        }
      }
    });

    // Stone
    const stonePixels: RGBA[][] = [];
    this.drawTile(TileIndex.Stone, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        stonePixels[y] = [];
        for (let x = 0; x < 16; x++) {
          const streak = Math.sin((x + y * 2.3) * 0.7) * 7;
          const c = varyColor([125, 125, 128], streak + (rng() - 0.5) * 18);
          stonePixels[y][x] = c;
          px(x, y, c);
        }
      }
    });

    // Cobblestone
    this.drawTile(TileIndex.Cobblestone, (px, rng) => {
      const centers = [
        [3, 3], [10, 2], [14, 6],
        [5, 8], [11, 10], [2, 13], [9, 14], [15, 14],
      ];
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          let d1 = 999;
          let d2 = 999;
          let nearest = 0;
          for (let i = 0; i < centers.length; i++) {
            const dx = Math.min(Math.abs(x - centers[i][0]), 16 - Math.abs(x - centers[i][0]));
            const dy = Math.min(Math.abs(y - centers[i][1]), 16 - Math.abs(y - centers[i][1]));
            const d = Math.hypot(dx, dy);
            if (d < d1) {
              d2 = d1;
              d1 = d;
              nearest = i;
            } else if (d < d2) {
              d2 = d;
            }
          }
          const mortar = d2 - d1 < 1.15;
          if (mortar) {
            px(x, y, varyColor([68, 68, 70], (rng() - 0.5) * 12));
          } else {
            const shade = ((nearest * 17) % 24) - 12;
            px(x, y, varyColor([122, 122, 125], shade + (rng() - 0.5) * 14));
          }
        }
      }
    });

    // Sand
    this.drawTile(TileIndex.Sand, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const wave = Math.sin((y * 0.9 + x * 0.25)) * 6;
          const n = (rng() - 0.5) * 16 + wave;
          px(x, y, [clampByte(224 + n), clampByte(212 + n), clampByte(162 + n), 255]);
        }
      }
    });

    // Oak Log Side
    this.drawTile(TileIndex.OakLogSide, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const ridge = Math.sin(x * 1.45) * 14;
          const n = (rng() - 0.5) * 14 + ridge;
          px(x, y, [clampByte(104 + n), clampByte(82 + n * 0.8), clampByte(50 + n * 0.6), 255]);
        }
      }
    });

    // Oak Log Top
    this.drawTile(TileIndex.OakLogTop, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const dx = x - 7.5;
          const dy = y - 7.5;
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          if (dist >= 6.5) {
            px(x, y, varyColor([102, 80, 48], (rng() - 0.5) * 14));
          } else {
            const ring = Math.sin(dist * 2.4) * 12;
            const n = (rng() - 0.5) * 10 + ring;
            px(x, y, [clampByte(178 + n), clampByte(145 + n), clampByte(94 + n), 255]);
          }
        }
      }
    });

    // Oak Leaves
    this.drawTile(TileIndex.OakLeaves, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const hole = rng() < 0.16 && (x + y) % 2 === 0;
          if (hole) {
            px(x, y, [0, 0, 0, 0]);
          } else {
            const n = (rng() - 0.5) * 34;
            px(x, y, [clampByte(56 + n * 0.6), clampByte(132 + n), clampByte(44 + n * 0.5), 255]);
          }
        }
      }
    });

    // Oak Planks
    this.drawTile(TileIndex.OakPlanks, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        const plankRow = Math.floor(y / 4);
        const isHorizontalSeam = y % 4 === 3;
        const verticalSeamX = (plankRow * 7 + 5) % 16;
        for (let x = 0; x < 16; x++) {
          if (isHorizontalSeam || x === verticalSeamX) {
            px(x, y, varyColor([124, 94, 56], (rng() - 0.5) * 10));
          } else {
            const grain = Math.sin((x + plankRow * 5) * 0.6) * 7 + (rng() - 0.5) * 12;
            px(x, y, [clampByte(184 + grain), clampByte(148 + grain), clampByte(94 + grain), 255]);
          }
        }
      }
    });

    // Coal Ore
    this.drawTile(TileIndex.CoalOre, (px, rng) => {
      const specks = new Set([
        '3,3', '4,3', '3,4',
        '10,4', '11,4', '11,5',
        '6,8', '7,8', '7,9', '6,9',
        '12,11', '13,11', '12,12',
        '3,12', '4,12', '4,13',
      ]);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if (specks.has(`${x},${y}`)) {
            px(x, y, varyColor([32, 32, 36], (rng() - 0.5) * 14));
          } else {
            px(x, y, stonePixels[y][x]);
          }
        }
      }
    });

    // Gold Ore
    this.drawTile(TileIndex.GoldOre, (px, rng) => {
      const specks = new Set([
        '4,3', '5,3', '4,4',
        '11,4', '12,5',
        '6,8', '7,8', '7,9',
        '11,11', '12,11', '11,12',
        '3,11', '4,12',
      ]);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if (specks.has(`${x},${y}`)) {
            const shine = rng() > 0.5 ? 22 : 0;
            px(x, y, [clampByte(238 + shine), clampByte(198 + shine), clampByte(58 + shine), 255]);
          } else {
            px(x, y, stonePixels[y][x]);
          }
        }
      }
    });

    // Glass
    this.drawTile(TileIndex.Glass, (px) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const border = x === 0 || x === 15 || y === 0 || y === 15;
          const streak = (x === 3 && y >= 2 && y <= 5) || (x === 4 && y >= 2 && y <= 4) || (x === 11 && y >= 10 && y <= 12);
          if (border) {
            px(x, y, [215, 240, 250, 255]);
          } else if (streak) {
            px(x, y, [235, 250, 255, 235]);
          } else {
            px(x, y, [0, 0, 0, 0]);
          }
        }
      }
    });

    // Water
    this.drawTile(TileIndex.Water, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const ripple = Math.sin((x * 0.6 + y * 0.9)) * 14 + (rng() - 0.5) * 8;
          px(x, y, [clampByte(36 + ripple * 0.5), clampByte(118 + ripple), clampByte(218 + ripple), 195]);
        }
      }
    });

    // Bedrock
    this.drawTile(TileIndex.Bedrock, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const v = rng() > 0.5 ? 65 : 32;
          px(x, y, varyColor([v, v, v + 4], (rng() - 0.5) * 24));
        }
      }
    });

    // Torch (16x16 sprite: central 2px stick at x=7..8, y=6..15, glowing flame at y=4..7)
    this.drawTile(TileIndex.Torch, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if (x >= 7 && x <= 8 && y >= 6 && y <= 15) {
            if (y === 6) {
              // Bright white-yellow ember core
              px(x, y, [255, 248, 196, 255]);
            } else if (y === 7) {
              // Warm orange coal ring
              px(x, y, [246, 152, 42, 255]);
            } else if (y === 8) {
              // Charred neck
              px(x, y, [78, 56, 36, 255]);
            } else {
              // Oak stick
              const grain = x === 7 ? 12 : -10;
              const n = (rng() - 0.5) * 10 + grain;
              px(x, y, [clampByte(152 + n), clampByte(118 + n), clampByte(68 + n), 255]);
            }
          } else if ((x === 7 || x === 8) && y === 5) {
            px(x, y, [255, 214, 74, 255]);
          } else {
            px(x, y, [0, 0, 0, 0]);
          }
        }
      }
    });

    // Cavern Glow Crystal (luminous cyan-gold crystalline facets)
    this.drawTile(TileIndex.GlowCrystal, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const cx = Math.abs(x - 7.5);
          const cy = Math.abs(y - 7.5);
          const diamond = cx + cy;
          const border = x === 0 || x === 15 || y === 0 || y === 15;
          const facet = ((x * 3 + y * 5) % 7) * 5;
          const n = (rng() - 0.5) * 16;
          if (border) {
            px(x, y, [clampByte(46 + n), clampByte(138 + n), clampByte(168 + n), 255]);
          } else if (diamond < 4.5) {
            px(x, y, [clampByte(224 + n), clampByte(252 + n), clampByte(255), 255]);
          } else if (diamond < 8.5) {
            px(x, y, [clampByte(105 + facet + n), clampByte(228 + n), clampByte(242 + n), 255]);
          } else {
            px(x, y, [clampByte(62 + facet + n), clampByte(176 + n), clampByte(208 + n), 255]);
          }
        }
      }
    });

    // Crafting Table Top (3x3 inlaid crafting grid over oak border)
    this.drawTile(TileIndex.CraftingTableTop, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const border = x <= 1 || x >= 14 || y <= 1 || y >= 14;
          const gridLine =
            x >= 3 && x <= 12 && y >= 3 && y <= 12 && (x === 3 || x === 6 || x === 9 || x === 12 || y === 3 || y === 6 || y === 9 || y === 12);
          const n = (rng() - 0.5) * 10;
          if (border) {
            px(x, y, [clampByte(126 + n), clampByte(92 + n), clampByte(52 + n), 255]);
          } else if (gridLine) {
            px(x, y, [clampByte(78 + n), clampByte(54 + n), clampByte(32 + n), 255]);
          } else {
            px(x, y, [clampByte(188 + n), clampByte(150 + n), clampByte(96 + n), 255]);
          }
        }
      }
    });

    // Crafting Table Side (planks + dark workbench rim + hanging iron saw/hammer silhouette)
    this.drawTile(TileIndex.CraftingTableSide, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rng() - 0.5) * 10;
          if (y <= 2) {
            // Top workbench trim
            px(x, y, [clampByte(118 + n), clampByte(84 + n), clampByte(48 + n), 255]);
          } else if (x === 0 || x === 15) {
            // Corner pillars
            px(x, y, [clampByte(104 + n), clampByte(74 + n), clampByte(42 + n), 255]);
          } else if ((x === 5 || x === 6) && y >= 5 && y <= 11) {
            // Hanging metal saw blade
            px(x, y, [186, 192, 202, 255]);
          } else if ((x === 10 || x === 11) && y === 5) {
            // Hammer head
            px(x, y, [94, 98, 108, 255]);
          } else if (x === 10 && y >= 6 && y <= 11) {
            // Hammer handle
            px(x, y, [132, 94, 52, 255]);
          } else {
            const seam = y % 4 === 3;
            const base: [number, number, number] = seam ? [124, 94, 56] : [178, 142, 90];
            px(x, y, varyColor(base, n));
          }
        }
      }
    });

    // Sandstone Top
    this.drawTile(TileIndex.SandstoneTop, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const border = x === 0 || x === 15 || y === 0 || y === 15;
          const n = (rng() - 0.5) * 12;
          const d = border ? -14 : 0;
          px(x, y, [clampByte(226 + n + d), clampByte(214 + n + d), clampByte(160 + n + d), 255]);
        }
      }
    });

    // Sandstone Side (layered desert sedimentary bands)
    this.drawTile(TileIndex.SandstoneSide, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rng() - 0.5) * 10;
          if (y === 3 || y === 4) {
            px(x, y, [clampByte(192 + n), clampByte(176 + n), clampByte(124 + n), 255]);
          } else if (y === 10) {
            px(x, y, [clampByte(204 + n), clampByte(188 + n), clampByte(136 + n), 255]);
          } else if (y < 3) {
            px(x, y, [clampByte(232 + n), clampByte(220 + n), clampByte(168 + n), 255]);
          } else {
            px(x, y, [clampByte(218 + n), clampByte(204 + n), clampByte(150 + n), 255]);
          }
        }
      }
    });

    // Cactus Top
    this.drawTile(TileIndex.CactusTop, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
          const n = (rng() - 0.5) * 12;
          if (d < 2.5) {
            px(x, y, [clampByte(138 + n), clampByte(186 + n), clampByte(96 + n), 255]);
          } else if (d > 6.5) {
            px(x, y, [clampByte(36 + n), clampByte(98 + n), clampByte(34 + n), 255]);
          } else {
            px(x, y, [clampByte(56 + n), clampByte(136 + n), clampByte(46 + n), 255]);
          }
        }
      }
    });

    // Cactus Side (vertical ribs + pale spines)
    this.drawTile(TileIndex.CactusSide, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const rib = x % 4 === 0 ? -18 : x % 4 === 2 ? 12 : 0;
          const spine = (x === 1 && y % 5 === 2) || (x === 14 && y % 5 === 4) || (x === 6 && y % 6 === 1);
          if (spine) {
            px(x, y, [226, 232, 188, 255]);
          } else {
            const n = (rng() - 0.5) * 10 + rib;
            px(x, y, [clampByte(54 + n * 0.6), clampByte(134 + n), clampByte(44 + n * 0.5), 255]);
          }
        }
      }
    });

    // Snow Top
    this.drawTile(TileIndex.SnowTop, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const sparkle = (rng() - 0.5) * 12;
          px(x, y, [clampByte(242 + sparkle), clampByte(248 + sparkle), clampByte(255), 255]);
        }
      }
    });

    // Snow Grass Side (crisp snow overhang over dirt)
    this.drawTile(TileIndex.SnowGrassSide, (px, rng) => {
      const overhang = [4, 5, 4, 3, 5, 6, 4, 3, 4, 5, 4, 3, 5, 4, 3, 4];
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if (y < overhang[x]) {
            const n = (rng() - 0.5) * 10;
            const rim = y === overhang[x] - 1 ? -16 : 0;
            px(x, y, [clampByte(238 + n + rim), clampByte(246 + n + rim), clampByte(255 + rim), 255]);
          } else {
            const base = dirtPixels[y][x];
            const shadow = y === overhang[x] ? -18 : 0;
            px(x, y, [
              clampByte(base[0] + shadow),
              clampByte(base[1] + shadow),
              clampByte(base[2] + shadow),
              255,
            ]);
          }
        }
      }
    });

    // Spruce Log Side (rich dark alpine bark)
    this.drawTile(TileIndex.SpruceLogSide, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const ridge = Math.sin(x * 1.5) * 10;
          const n = (rng() - 0.5) * 12 + ridge;
          px(x, y, [clampByte(64 + n * 0.8), clampByte(46 + n * 0.7), clampByte(28 + n * 0.5), 255]);
        }
      }
    });

    // Spruce Leaves (frosted blue-green pine needles)
    this.drawTile(TileIndex.SpruceLeaves, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const hole = rng() < 0.14 && (x + y) % 2 === 1;
          if (hole) {
            px(x, y, [0, 0, 0, 0]);
          } else {
            const frost = rng() > 0.88 ? 38 : 0;
            const n = (rng() - 0.5) * 22;
            px(x, y, [
              clampByte(36 + n * 0.5 + frost),
              clampByte(88 + n + frost),
              clampByte(64 + n * 0.7 + frost),
              255,
            ]);
          }
        }
      }
    });

    // Deepslate (dark layered subterranean slate rock)
    this.drawTile(TileIndex.DeepSlate, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const cleavage = Math.sin((y * 1.4 + (x % 4) * 0.4)) * 9;
          const n = (rng() - 0.5) * 14 + cleavage;
          px(x, y, [clampByte(52 + n), clampByte(55 + n), clampByte(64 + n), 255]);
        }
      }
    });

    // Lush Moss Stone (vibrant velvety cavern moss)
    this.drawTile(TileIndex.MossStone, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const patch = Math.sin(x * 0.7) * Math.cos(y * 0.7) * 14;
          const spore = rng() > 0.93 ? 28 : 0;
          const n = (rng() - 0.5) * 18 + patch;
          px(x, y, [
            clampByte(64 + n * 0.6 + spore * 0.6),
            clampByte(148 + n + spore),
            clampByte(52 + n * 0.5),
            255,
          ]);
        }
      }
    });

    // Amethyst Crystal Geode (vivid violet-magenta crystalline facets)
    this.drawTile(TileIndex.AmethystCrystal, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const cx = Math.abs(x - 7.5);
          const cy = Math.abs(y - 7.5);
          const diamond = cx + cy;
          const border = x === 0 || x === 15 || y === 0 || y === 15;
          const facet = ((x * 5 + y * 3) % 7) * 6;
          const n = (rng() - 0.5) * 16;
          if (border) {
            px(x, y, [clampByte(92 + n), clampByte(42 + n), clampByte(138 + n), 255]);
          } else if (diamond < 4.2) {
            px(x, y, [clampByte(246 + n), clampByte(210 + n), clampByte(255), 255]);
          } else if (diamond < 8.5) {
            px(x, y, [clampByte(188 + facet + n), clampByte(96 + n), clampByte(238 + n), 255]);
          } else {
            px(x, y, [clampByte(132 + facet + n), clampByte(58 + n), clampByte(188 + n), 255]);
          }
        }
      }
    });

    // Bioluminescent Cave Glowshroom (cross-quad sprite)
    this.drawTile(TileIndex.CaveShroom, (px) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          // Pale stem from y=9..15, x=7..8
          if (y >= 9 && y <= 15 && x >= 7 && x <= 8) {
            px(x, y, x === 7 ? [196, 224, 218, 255] : [148, 182, 178, 255]);
          } else if (y >= 4 && y <= 9) {
            // Glowing dome cap
            const halfW = y === 4 ? 2 : y === 5 ? 4 : y <= 7 ? 5 : 6;
            if (Math.abs(x - 7.5) <= halfW) {
              const spot = (x === 6 && y === 6) || (x === 9 && y === 7) || (x === 7 && y === 5);
              if (spot) {
                px(x, y, [238, 255, 248, 255]);
              } else if (y === 9) {
                px(x, y, [48, 198, 172, 255]);
              } else {
                px(x, y, [68, 238, 206, 255]);
              }
            } else {
              px(x, y, [0, 0, 0, 0]);
            }
          } else {
            px(x, y, [0, 0, 0, 0]);
          }
        }
      }
    });

    // Dripstone Spike (tapered limestone stalagmite/stalactite cross sprite)
    this.drawTile(TileIndex.DripstoneSpike, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        // Width tapers toward top AND bottom slightly so it works great as rocky cavern spire
        const distFromMid = Math.abs(y - 11);
        const halfW = y < 2 ? 0.6 : Math.max(0.8, 5.2 - (15 - y) * 0.32);
        void distFromMid;
        for (let x = 0; x < 16; x++) {
          if (Math.abs(x - 7.5) <= halfW && y >= 1) {
            const n = (rng() - 0.5) * 16;
            const edge = Math.abs(x - 7.5) > halfW - 1 ? -18 : 0;
            px(x, y, [
              clampByte(156 + n + edge),
              clampByte(132 + n + edge),
              clampByte(112 + n + edge),
              255,
            ]);
          } else {
            px(x, y, [0, 0, 0, 0]);
          }
        }
      }
    });

    // Hanging Glow Vine (luminous golden-green cavern tendrils)
    this.drawTile(TileIndex.CaveVine, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const strandA = Math.abs(x - (5 + Math.sin(y * 0.5) * 1.2)) < 1.0 && y < 14;
          const strandB = Math.abs(x - (10 + Math.cos(y * 0.45) * 1.2)) < 1.0 && y < 15;
          const berry = (x === 5 && y === 9) || (x === 10 && y === 6) || (x === 10 && y === 12);
          if (berry) {
            px(x, y, [255, 232, 108, 255]);
          } else if (strandA || strandB) {
            const n = (rng() - 0.5) * 18;
            px(x, y, [clampByte(72 + n), clampByte(168 + n), clampByte(62 + n), 255]);
          } else {
            px(x, y, [0, 0, 0, 0]);
          }
        }
      }
    });
  }
}
