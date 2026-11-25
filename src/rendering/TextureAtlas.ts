import * as THREE from 'three';
import { BLOCKS, BlockId, TileIndex } from '../world/Block';
import { mulberry32 } from '../world/Noise';

export const TILE_SIZE = 16;
export const ATLAS_COLS = 5;
export const ATLAS_ROWS = 4;
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

    if (def.shape === 'torch') {
      const torchTile = this.tileCanvases.get(TileIndex.Torch);
      if (torchTile) {
        ic.drawImage(torchTile, 0, 0, 16, 16, 4, 3, 24, 26);
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
  }
}
