import { TileIndex } from '../../content/TileIndex';
import { clampByte, varyColor } from './PixelArt';
import { TileDrawer } from './TexturePainter';

/** Paints crafted blocks, utility sprites, and general luminous textures. */
export function paintStructureTextures(drawTile: TileDrawer): void {
    // Torch (16x16 sprite: central 2px stick at x=7..8, y=6..15, glowing flame at y=4..7)
    drawTile(TileIndex.Torch, (px, rng) => {
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
    drawTile(TileIndex.GlowCrystal, (px, rng) => {
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
    drawTile(TileIndex.CraftingTableTop, (px, rng) => {
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
    drawTile(TileIndex.CraftingTableSide, (px, rng) => {
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

    drawTile(TileIndex.FurnaceTop, (px, rng) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const edge = x < 2 || x > 13 || y < 2 || y > 13;
        const seam = x % 5 === 0 || y % 5 === 0;
        const n = (rng() - 0.5) * 18;
        const base = edge ? 66 : seam ? 82 : 112;
        px(x, y, [clampByte(base + n), clampByte(base + n), clampByte(base + 4 + n), 255]);
      }
    });

    const furnaceSide = (lit: boolean): Parameters<typeof drawTile>[1] => (px, rng) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const n = (rng() - 0.5) * 16;
        const border = x === 0 || x === 15 || y === 0 || y === 15;
        const mouth = x >= 4 && x <= 11 && y >= 8 && y <= 13;
        const rim = x >= 3 && x <= 12 && y >= 7 && y <= 14 && !mouth;
        if (mouth) {
          if (lit && y >= 10) {
            const flame = (x + y) % 3;
            px(x, y, flame === 0 ? [255, 226, 92, 255] : flame === 1 ? [248, 116, 34, 255] : [164, 48, 24, 255]);
          } else {
            px(x, y, [24, 24, 28, 255]);
          }
        } else if (rim || border) {
          px(x, y, [clampByte(58 + n), clampByte(60 + n), clampByte(66 + n), 255]);
        } else {
          const stone = 104 + ((x * 7 + y * 3) % 4) * 7;
          px(x, y, [clampByte(stone + n), clampByte(stone + n), clampByte(stone + 5 + n), 255]);
        }
      }
    };
    drawTile(TileIndex.FurnaceSide, furnaceSide(false));
    drawTile(TileIndex.LitFurnaceSide, furnaceSide(true));

    drawTile(TileIndex.BedFootTop, (px, rng) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const seam = x === 0 || x === 15 || y === 0 || y === 15;
        const n = (rng() - 0.5) * 9;
        px(x, y, seam
          ? [106, 32, 40, 255]
          : [clampByte(190 + n), clampByte(54 + n), clampByte(64 + n), 255]);
      }
    });
    drawTile(TileIndex.BedHeadTop, (px, rng) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const seam = x === 0 || x === 15 || y === 0 || y === 15;
        const pillow = y >= 2 && y <= 7 && x >= 2 && x <= 13;
        const n = (rng() - 0.5) * 8;
        if (seam) px(x, y, [106, 32, 40, 255]);
        else if (pillow) px(x, y, [clampByte(226 + n), clampByte(222 + n), clampByte(204 + n), 255]);
        else px(x, y, [clampByte(190 + n), clampByte(54 + n), clampByte(64 + n), 255]);
      }
    });
    drawTile(TileIndex.BedSide, (px, rng) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const n = (rng() - 0.5) * 8;
        if (y < 9) px(x, y, [clampByte(178 + n), clampByte(48 + n), clampByte(58 + n), 255]);
        else if ((x < 2 || x > 13) && y > 11) px(x, y, [116, 78, 44, 255]);
        else px(x, y, [clampByte(134 + n), clampByte(94 + n), clampByte(54 + n), 255]);
      }
    });

}
