import { afterEach, describe, expect, it, vi } from 'vitest';
import { TileIndex } from '../../src/content/TileIndex';
import {
  loadTileCanvases,
  tileFilename,
  tileFileUrl,
} from '../../src/rendering/textures/TextureLoad';

class FakeImage {
  public naturalWidth = 16;
  public naturalHeight = 16;
  public onload: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  private _src = '';
  public set src(value: string) {
    this._src = value;
    queueMicrotask(() => this.onload?.());
  }
  public get src(): string {
    return this._src;
  }
}

describe('generated tile files', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('derives stable filenames and URLs from TileIndex', () => {
    expect(tileFilename(TileIndex.Sand)).toBe('tile-005.png');
    expect(tileFilename(TileIndex.GrassTop)).toBe('tile-000.png');
    expect(tileFileUrl(TileIndex.Stone)).toBe('generated-textures/tiles/tile-003.png');
  });

  it('loads tile canvases when files are present and skips missing ones', async () => {
    const drawImage = vi.fn();
    vi.stubGlobal('Image', FakeImage);
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage }),
      })),
    });

    const tiles = await loadTileCanvases();

    expect(tiles.has(TileIndex.Sand)).toBe(true);
    expect(tiles.get(TileIndex.Sand)!.width).toBe(16);
    expect(drawImage).toHaveBeenCalled();
  });

  it('returns an empty map when files are missing', async () => {
    // No Image global in this environment, so every tile load fails and is skipped.
    const tiles = await loadTileCanvases();
    expect(tiles.size).toBe(0);
  });
});
