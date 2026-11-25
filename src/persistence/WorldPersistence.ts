import { ItemStack, ITEMS } from '../items/Item';
import { TOTAL_INVENTORY_SLOTS } from '../items/Inventory';
import { BlockId } from '../content/BlockId';
import { CHUNK_HEIGHT } from '../world/Chunk';

export const SAVE_VERSION = 1;
export type SerializedVoxelEdit = [x: number, y: number, z: number, block: BlockId];

export interface CaveriaSaveData {
  version: number;
  seed: string;
  savedAt: number;
  player: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    flyMode: boolean;
  };
  inventory: Array<ItemStack | null>;
  selectedHotbar: number;
  creativeMode: boolean;
  timeOfDay: number;
  weather: {
    phase: 'clear' | 'rain' | 'storm';
    intensity: number;
    timeRemaining: number;
  };
  muted: boolean;
  worldEdits: SerializedVoxelEdit[];
}

/** Versioned, seed-scoped local save storage. Terrain is regenerated; only edits are stored. */
export class WorldPersistence {
  private readonly storageKey: string;

  constructor(public readonly seedLabel: string) {
    this.storageKey = `caveria:world:v${SAVE_VERSION}:${encodeURIComponent(seedLabel)}`;
  }

  public load(): CaveriaSaveData | null {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<CaveriaSaveData>;
      if (parsed.version !== SAVE_VERSION || parsed.seed !== this.seedLabel) return null;
      return this.sanitize(parsed);
    } catch (error) {
      console.warn('[Caveria] Save could not be loaded; starting from generated terrain.', error);
      return null;
    }
  }

  public save(data: CaveriaSaveData): boolean {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      return true;
    } catch (error) {
      console.warn('[Caveria] Save failed (browser storage may be full or disabled).', error);
      return false;
    }
  }

  public clear(): void {
    localStorage.removeItem(this.storageKey);
  }

  private sanitize(raw: Partial<CaveriaSaveData>): CaveriaSaveData {
    const finite = (value: unknown, fallback: number): number =>
      typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    const player = raw.player ?? {
      x: 8.5,
      y: 90,
      z: 8.5,
      yaw: 0,
      pitch: 0,
      flyMode: false,
    };
    const worldCoord = (value: unknown, fallback: number): number =>
      Math.max(-1_000_000, Math.min(1_000_000, finite(value, fallback)));

    const inventory = new Array<ItemStack | null>(TOTAL_INVENTORY_SLOTS).fill(null);
    if (Array.isArray(raw.inventory)) {
      for (let i = 0; i < Math.min(TOTAL_INVENTORY_SLOTS, raw.inventory.length); i++) {
        const stack = raw.inventory[i];
        if (!stack || typeof stack !== 'object' || !ITEMS[stack.id]) continue;
        const def = ITEMS[stack.id];
        const count = Math.max(1, Math.min(def.maxStack, Math.floor(finite(stack.count, 1))));
        const durability =
          def.maxDurability === undefined
            ? undefined
            : Math.max(1, Math.min(def.maxDurability, Math.floor(finite(stack.durability, def.maxDurability))));
        inventory[i] = { id: stack.id, count, durability };
      }
    }

    const worldEdits: SerializedVoxelEdit[] = [];
    if (Array.isArray(raw.worldEdits)) {
      for (const edit of raw.worldEdits) {
        if (!Array.isArray(edit) || edit.length !== 4) continue;
        const [x, y, z, block] = edit;
        if (![x, y, z, block].every(Number.isFinite)) continue;
        if (y < 0 || y >= CHUNK_HEIGHT || !Number.isInteger(block) || block < 0 || block > 255) continue;
        worldEdits.push([
          Math.floor(worldCoord(x, 0)),
          Math.floor(y),
          Math.floor(worldCoord(z, 0)),
          block as BlockId,
        ]);
      }
    }

    return {
      version: SAVE_VERSION,
      seed: this.seedLabel,
      savedAt: finite(raw.savedAt, Date.now()),
      player: {
        x: worldCoord(player.x, 8.5),
        y: Math.max(1, Math.min(CHUNK_HEIGHT + 32, finite(player.y, 90))),
        z: worldCoord(player.z, 8.5),
        yaw: finite(player.yaw, 0),
        pitch: Math.max(-Math.PI / 2, Math.min(Math.PI / 2, finite(player.pitch, 0))),
        flyMode: Boolean(player.flyMode),
      },
      inventory,
      selectedHotbar: Math.max(0, Math.min(8, Math.floor(finite(raw.selectedHotbar, 0)))),
      creativeMode: Boolean(raw.creativeMode),
      timeOfDay: ((finite(raw.timeOfDay, 0.18) % 1) + 1) % 1,
      weather: {
        phase:
          raw.weather?.phase === 'rain' || raw.weather?.phase === 'storm'
            ? raw.weather.phase
            : 'clear',
        intensity: Math.max(0, Math.min(1, finite(raw.weather?.intensity, 0))),
        timeRemaining: Math.max(1, Math.min(600, finite(raw.weather?.timeRemaining, 75))),
      },
      muted: Boolean(raw.muted),
      worldEdits,
    };
  }
}
