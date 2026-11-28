import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CHUNK_RENDER_DISTANCE,
  DEFAULT_TEXTURE_PACK,
  MAX_CHUNK_RENDER_DISTANCE,
  MIN_CHUNK_RENDER_DISTANCE,
  readSettings,
  updateSettings,
} from '../../src/settings/GameSettings';

describe('GameSettings', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubLocalStorage(): Map<string, string> {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => void store.set(key, value),
    });
    return store;
  }

  it('defaults the chunk render distance and texture pack when nothing is stored', () => {
    stubLocalStorage();
    expect(readSettings().chunkRenderDistance).toBe(DEFAULT_CHUNK_RENDER_DISTANCE);
    expect(readSettings().texturePack).toBe(DEFAULT_TEXTURE_PACK);
    expect(DEFAULT_CHUNK_RENDER_DISTANCE).toBeGreaterThan(5); // doubled from the old 5
  });

  it('persists updated settings and reads them back', () => {
    const store = stubLocalStorage();
    const settings = updateSettings({ chunkRenderDistance: 12, texturePack: 'ocd' });
    expect(settings.chunkRenderDistance).toBe(12);
    expect(settings.texturePack).toBe('ocd');
    expect(readSettings().chunkRenderDistance).toBe(12);
    expect(readSettings().texturePack).toBe('ocd');
    expect(store.size).toBeGreaterThan(0);
  });

  it('clamps render distance to the supported slider range', () => {
    stubLocalStorage();

    expect(updateSettings({ chunkRenderDistance: MIN_CHUNK_RENDER_DISTANCE - 1 }).chunkRenderDistance)
      .toBe(MIN_CHUNK_RENDER_DISTANCE);
    expect(updateSettings({ chunkRenderDistance: MAX_CHUNK_RENDER_DISTANCE + 1 }).chunkRenderDistance)
      .toBe(MAX_CHUNK_RENDER_DISTANCE);
  });

  it('falls back to defaults for invalid stored values', () => {
    const store = stubLocalStorage();
    store.set(
      'caveria-settings-v1',
      JSON.stringify({ chunkRenderDistance: -3, texturePack: '../bad' })
    );
    expect(readSettings().chunkRenderDistance).toBe(DEFAULT_CHUNK_RENDER_DISTANCE);
    expect(readSettings().texturePack).toBe(DEFAULT_TEXTURE_PACK);
  });

  it('keeps defaults when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    });
    expect(readSettings().chunkRenderDistance).toBe(DEFAULT_CHUNK_RENDER_DISTANCE);
  });
});
