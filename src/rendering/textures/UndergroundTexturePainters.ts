import { TileIndex } from '../../content/TileIndex';
import { clampByte } from './PixelArt';
import { TileDrawer } from './TexturePainter';

/** Paints Caveria underground strata, crystals, and cross-quad flora. */
export function paintUndergroundTextures(drawTile: TileDrawer): void {
    // Deepslate (dark layered subterranean slate rock)
    drawTile(TileIndex.DeepSlate, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const cleavage = Math.sin((y * 1.4 + (x % 4) * 0.4)) * 9;
          const n = (rng() - 0.5) * 14 + cleavage;
          px(x, y, [clampByte(52 + n), clampByte(55 + n), clampByte(64 + n), 255]);
        }
      }
    });

    // Lush Moss Stone (vibrant velvety cavern moss)
    drawTile(TileIndex.MossStone, (px, rng) => {
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
    drawTile(TileIndex.AmethystCrystal, (px, rng) => {
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
    drawTile(TileIndex.CaveShroom, (px) => {
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
    drawTile(TileIndex.DripstoneSpike, (px, rng) => {
      for (let y = 0; y < 16; y++) {
        // Width tapers toward top AND bottom slightly so it works great as rocky cavern spire
        const halfW = y < 2 ? 0.6 : Math.max(0.8, 5.2 - (15 - y) * 0.32);
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
    drawTile(TileIndex.CaveVine, (px, rng) => {
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
