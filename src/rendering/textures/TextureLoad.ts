import { TileIndex } from '../../content/TileIndex';
import { TILE_SIZE } from './AtlasLayout';

/**
 * Loads block tile PNG files exported to `generated-textures/tiles/` when the user
 * has placed them there. Returns only the tiles that actually loaded; missing or
 * unreadable files are skipped so procedural generation can fall back per tile.
 */

/** Directory (relative to the app root) that holds exported tile PNGs. */
export const TILES_BASE_URL = 'generated-textures/tiles/';

/** Stable PNG filename for a tile, e.g. `tile-003.png`. */
export function tileFilename(tile: TileIndex): string {
  return `tile-${String(tile).padStart(3, '0')}.png`;
}

/** Relative URL of the PNG file for a tile. */
export function tileFileUrl(tile: TileIndex): string {
  return TILES_BASE_URL + tileFilename(tile);
}

function loadTileImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load tile image: ${url}`));
    image.src = url;
  });
}

function imageToCanvas(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || TILE_SIZE;
  canvas.height = image.naturalHeight || TILE_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Failed to acquire 2D canvas context for loaded tile');
  context.drawImage(image, 0, 0);
  return canvas;
}

export async function loadTileCanvases(
  baseUrl: string = TILES_BASE_URL
): Promise<Map<TileIndex, HTMLCanvasElement>> {
  const tiles = new Map<TileIndex, HTMLCanvasElement>();
  const tileValues = Object.values(TileIndex).filter(
    (value): value is TileIndex => typeof value === 'number'
  );
  await Promise.all(
    tileValues.map(async (tile) => {
      try {
        const image = await loadTileImage(baseUrl + tileFilename(tile));
        tiles.set(tile, imageToCanvas(image));
      } catch {
        // Missing file: generation falls back for this tile.
      }
    })
  );
  return tiles;
}
