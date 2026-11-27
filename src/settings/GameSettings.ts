/**
 * Persisted game settings with safe per-setting defaults.
 * Stored in localStorage; missing or invalid values fall back to defaults.
 */

const STORAGE_KEY = 'caveria-settings-v1';

export interface GameSettings {
  /** Chunk render distance, in chunks (World.renderDistance). */
  chunkRenderDistance: number;
}

/** Default chunk render distance — doubled from the original 5-chunk value. */
export const DEFAULT_CHUNK_RENDER_DISTANCE = 10;

const DEFAULTS: GameSettings = {
  chunkRenderDistance: DEFAULT_CHUNK_RENDER_DISTANCE,
};

function normalizeChunkRenderDistance(value: unknown): number {
  const distance = typeof value === 'number' ? value : NaN;
  return Number.isFinite(distance) && distance >= 1
    ? Math.floor(distance)
    : DEFAULTS.chunkRenderDistance;
}

export function readSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<GameSettings>) : {};
    return { chunkRenderDistance: normalizeChunkRenderDistance(saved.chunkRenderDistance) };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Merges partial settings with current ones, persists the result, and returns it. */
export function updateSettings(partial: Partial<GameSettings>): GameSettings {
  const next: GameSettings = { ...readSettings(), ...partial };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: settings keep their defaults for this session.
  }
  return next;
}
