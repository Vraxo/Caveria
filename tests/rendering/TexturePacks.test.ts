import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TileIndex } from '../../src/content/TileIndex';
import {
  BUILTIN_TEXTURE_PACKS,
  DEFAULT_TEXTURE_PACK_ID,
  loadTexturePackManifest,
  loadTexturePackTiles,
  packFolderUrl,
  resolveTexturePack,
} from '../../src/rendering/textures/TexturePacks';
import { tileFilename } from '../../src/rendering/textures/TextureLoad';

class RecordingImage {
  public static requestedUrls: string[] = [];
  public naturalWidth = 16;
  public naturalHeight = 16;
  public onload: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  private _src = '';
  public set src(value: string) {
    this._src = value;
    RecordingImage.requestedUrls.push(value);
    queueMicrotask(() => this.onload?.());
  }
  public get src(): string {
    return this._src;
  }
}

describe('TexturePacks', () => {
  afterEach(() => {
    RecordingImage.requestedUrls = [];
    vi.unstubAllGlobals();
  });

  it('builds safe relative pack folder URLs', () => {
    expect(packFolderUrl('default')).toBe('texture-packs/default/');
    expect(packFolderUrl('ocd')).toBe('texture-packs/ocd/');
  });

  it('parses packs.json and ignores invalid or unsafe pack entries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          { id: 'ocd', name: 'oCd', description: 'Crisp geometric pack', tiles: 'all' },
          { id: '../escape', name: 'Bad Pack' },
          { id: '', name: 'Empty' },
          { id: 'custom', name: 'Custom', tiles: [TileIndex.GrassTop, 9999] },
        ],
      }))
    );

    const packs = await loadTexturePackManifest();
    expect(packs.map((p) => p.id)).toEqual(['default', 'ocd', 'custom']);
    expect(packs.find((p) => p.id === 'custom')?.tiles).toEqual([TileIndex.GrassTop]);
  });

  it('falls back to built-in packs when packs.json cannot be loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false }))
    );

    const packs = await loadTexturePackManifest();
    expect(packs).toEqual(BUILTIN_TEXTURE_PACKS);
  });

  it('resolves saved pack ids with a default fallback', () => {
    expect(resolveTexturePack(BUILTIN_TEXTURE_PACKS, 'ocd').id).toBe('ocd');
    expect(resolveTexturePack(BUILTIN_TEXTURE_PACKS, 'missing').id).toBe(DEFAULT_TEXTURE_PACK_ID);
  });

  it('skips network requests for packs with tiles: [] and loads only requested tiles', async () => {
    vi.stubGlobal('Image', RecordingImage);
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: vi.fn() }),
      })),
    });

    const emptyTiles = await loadTexturePackTiles({
      id: 'default',
      name: 'Default',
      tiles: [],
    });
    expect(emptyTiles.size).toBe(0);
    expect(RecordingImage.requestedUrls).toHaveLength(0);

    const subsetTiles = await loadTexturePackTiles({
      id: 'ocd',
      name: 'oCd',
      tiles: [TileIndex.GrassTop, TileIndex.Stone],
    });
    expect(subsetTiles.size).toBe(2);
    expect(RecordingImage.requestedUrls).toEqual([
      'texture-packs/ocd/tile-000.png',
      'texture-packs/ocd/tile-003.png',
    ]);
  });

  it('ships valid packs.json and all 51 16x16 PNG tiles in default and ocd packs', () => {
    const packsPath = path.resolve(process.cwd(), 'public/texture-packs/packs.json');
    const manifest = JSON.parse(fs.readFileSync(packsPath, 'utf8')) as Array<{ id: string }>;
    expect(manifest.map((p) => p.id)).toContain('default');
    expect(manifest.map((p) => p.id)).toContain('ocd');

    const tileValues = Object.values(TileIndex).filter(
      (value): value is TileIndex => typeof value === 'number'
    );
    for (const packId of ['default', 'ocd']) {
      const packDir = path.resolve(process.cwd(), 'public/texture-packs', packId);
      for (const tile of tileValues) {
        const filePath = path.join(packDir, tileFilename(tile));
        expect(fs.existsSync(filePath), `missing ${packId}/${tileFilename(tile)}`).toBe(true);
        const buf = fs.readFileSync(filePath);
        // PNG signature + IHDR width/height = 16x16
        expect(buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
        expect(buf.readUInt32BE(16)).toBe(16);
        expect(buf.readUInt32BE(20)).toBe(16);
      }
    }
  });
});
