import { TileIndex } from '../../content/TileIndex';
import { clampByte, RGBA, varyColor } from './PixelArt';
import { TileDrawer } from './TexturePainter';

/** Paints terrain, vegetation, biome-surface, and ore textures. */
export function paintSurfaceTextures(drawTile: TileDrawer): void {
    // Grass Top
    drawTile(TileIndex.GrassTop, (px, rng) => {
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
    drawTile(TileIndex.Dirt, (px, rng) => {
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
    drawTile(TileIndex.GrassSide, (px, rng) => {
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
    drawTile(TileIndex.Stone, (px, rng) => {
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
    drawTile(TileIndex.Cobblestone, (px, rng) => {
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
    drawTile(TileIndex.Sand, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const wave = Math.sin((y * 0.9 + x * 0.25)) * 6;
          const n = (rng() - 0.5) * 16 + wave;
          px(x, y, [clampByte(224 + n), clampByte(212 + n), clampByte(162 + n), 255]);
        }
      }
    });

    // Oak Log Side
    drawTile(TileIndex.OakLogSide, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const ridge = Math.sin(x * 1.45) * 14;
          const n = (rng() - 0.5) * 14 + ridge;
          px(x, y, [clampByte(104 + n), clampByte(82 + n * 0.8), clampByte(50 + n * 0.6), 255]);
        }
      }
    });

    // Oak Log Top
    drawTile(TileIndex.OakLogTop, (px, rng) => {
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
    drawTile(TileIndex.OakLeaves, (px, rng) => {
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
    drawTile(TileIndex.OakPlanks, (px, rng) => {
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
    drawTile(TileIndex.CoalOre, (px, rng) => {
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
    drawTile(TileIndex.GoldOre, (px, rng) => {
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
    drawTile(TileIndex.Glass, (px) => {
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
    drawTile(TileIndex.Water, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const ripple = Math.sin((x * 0.6 + y * 0.9)) * 14 + (rng() - 0.5) * 8;
          px(x, y, [clampByte(36 + ripple * 0.5), clampByte(118 + ripple), clampByte(218 + ripple), 195]);
        }
      }
    });

    // Bedrock
    drawTile(TileIndex.Bedrock, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const v = rng() > 0.5 ? 65 : 32;
          px(x, y, varyColor([v, v, v + 4], (rng() - 0.5) * 24));
        }
      }
    });

    // Sandstone Top
    drawTile(TileIndex.SandstoneTop, (px, rng) => {
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
    drawTile(TileIndex.SandstoneSide, (px, rng) => {
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
    drawTile(TileIndex.CactusTop, (px, rng) => {
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
    drawTile(TileIndex.CactusSide, (px, rng) => {
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
    drawTile(TileIndex.SnowTop, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const sparkle = (rng() - 0.5) * 12;
          px(x, y, [clampByte(242 + sparkle), clampByte(248 + sparkle), clampByte(255), 255]);
        }
      }
    });

    // Snow Grass Side (crisp snow overhang over dirt)
    drawTile(TileIndex.SnowGrassSide, (px, rng) => {
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
    drawTile(TileIndex.SpruceLogSide, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const ridge = Math.sin(x * 1.5) * 10;
          const n = (rng() - 0.5) * 12 + ridge;
          px(x, y, [clampByte(64 + n * 0.8), clampByte(46 + n * 0.7), clampByte(28 + n * 0.5), 255]);
        }
      }
    });

    // Spruce Leaves (frosted blue-green pine needles)
    drawTile(TileIndex.SpruceLeaves, (px, rng) => {
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

}
