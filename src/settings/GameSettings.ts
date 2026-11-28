/**
 * Persisted game settings with safe per-setting defaults.
 * Stored in localStorage; missing or invalid values fall back to defaults.
 */

const STORAGE_KEY = 'caveria-settings-v1';

export interface GameSettings {
  /** Chunk render distance, in chunks (World.renderDistance). */
  chunkRenderDistance: number;
  /** Active texture pack folder id under `public/texture-packs/`. */
  texturePack: string;
}

/** Supported slider range for chunk render distance. */
export const MIN_CHUNK_RENDER_DISTANCE = 4;
export const MAX_CHUNK_RENDER_DISTANCE = 16;

/** Default chunk render distance — doubled from the original 5-chunk value. */
export const DEFAULT_CHUNK_RENDER_DISTANCE = 10;

/** Default built-in procedural texture pack id. */
export const DEFAULT_TEXTURE_PACK = 'default';

const DEFAULTS: GameSettings = {
  chunkRenderDistance: DEFAULT_CHUNK_RENDER_DISTANCE,
  texturePack: DEFAULT_TEXTURE_PACK,
};

function normalizeChunkRenderDistance(value: unknown): number {
  const distance = typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(distance) || distance < 1) return DEFAULTS.chunkRenderDistance;
  return Math.min(
    MAX_CHUNK_RENDER_DISTANCE,
    Math.max(MIN_CHUNK_RENDER_DISTANCE, Math.floor(distance))
  );
}

function normalizeTexturePack(value: unknown): string {
  if (typeof value !== 'string') return DEFAULTS.texturePack;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('/') || trimmed.includes('\\') || trimmed === '.' || trimmed === '..') {
    return DEFAULTS.texturePack;
  }
  return trimmed;
}

export function readSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<GameSettings>) : {};
    return {
      chunkRenderDistance: normalizeChunkRenderDistance(saved.chunkRenderDistance),
      texturePack: normalizeTexturePack(saved.texturePack),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Merges partial settings with current ones, persists the result, and returns it. */
export function updateSettings(partial: Partial<GameSettings>): GameSettings {
  const current = readSettings();
  const next: GameSettings = {
    chunkRenderDistance: normalizeChunkRenderDistance(
      partial.chunkRenderDistance ?? current.chunkRenderDistance
    ),
    texturePack: normalizeTexturePack(partial.texturePack ?? current.texturePack),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: settings keep their defaults for this session.
  }
  return next;
}
