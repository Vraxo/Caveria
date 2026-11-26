import { TileIndex } from '../../content/TileIndex';

export const TILE_SIZE = 16;
export const ATLAS_COLS = 6;
export const ATLAS_ROWS = 7;
export const ATLAS_PIXEL_WIDTH = ATLAS_COLS * TILE_SIZE;
export const ATLAS_PIXEL_HEIGHT = ATLAS_ROWS * TILE_SIZE;

export type UVBounds = [u0: number, v0: number, u1: number, v1: number];

/** Converts a tile index into inset Three.js UV coordinates. */
export function getTileUVs(tile: TileIndex): UVBounds {
  const col = tile % ATLAS_COLS;
  const row = Math.floor(tile / ATLAS_COLS);
  const epsilon = 0.0015;
  return [
    (col + epsilon) / ATLAS_COLS,
    1 - (row + 1 - epsilon) / ATLAS_ROWS,
    (col + 1 - epsilon) / ATLAS_COLS,
    1 - (row + epsilon) / ATLAS_ROWS,
  ];
}

/** Converts a top-origin pixel rectangle inside a tile into Three.js UV coordinates. */
export function getSubTileUVs(
  tile: TileIndex,
  px0: number,
  py0: number,
  px1: number,
  py1: number
): UVBounds {
  const col = tile % ATLAS_COLS;
  const row = Math.floor(tile / ATLAS_COLS);
  const epsilon = 0.02;
  return [
    (col * TILE_SIZE + px0 + epsilon) / ATLAS_PIXEL_WIDTH,
    1 - (row * TILE_SIZE + py1 - epsilon) / ATLAS_PIXEL_HEIGHT,
    (col * TILE_SIZE + px1 - epsilon) / ATLAS_PIXEL_WIDTH,
    1 - (row * TILE_SIZE + py0 + epsilon) / ATLAS_PIXEL_HEIGHT,
  ];
}
