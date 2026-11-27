import type { BedSnapshot } from '../gameplay/BedManager';
import type { FarmPlotSnapshot } from '../gameplay/FarmingManager';
import {
  STATUS_EFFECT_DEFINITIONS,
  STATUS_EFFECT_IDS,
  type StatusEffectId,
  type StatusEffectSnapshot,
} from '../content/effects/StatusEffectDefinitions';
import { CHEST_SLOT_COUNT, type ChestStateSnapshot } from '../gameplay/ChestManager';
import type { FurnaceStateSnapshot } from '../gameplay/FurnaceManager';
import { ArmorSlot, ItemStack, ITEMS } from '../items/Item';
import { TOTAL_INVENTORY_SLOTS } from '../items/Inventory';
import { BlockId } from '../content/BlockId';
import { CHUNK_HEIGHT } from '../world/Chunk';
import type { SavedMobSnapshot } from '../entities/MobTypes';
import { MOB_DEFINITIONS } from '../content/mobs/MobDefinitions';

export const SAVE_VERSION = 1;
export type SerializedVoxelEdit = [x: number, y: number, z: number, block: BlockId];

const SAVE_PREFIX = `caveria:world:v${SAVE_VERSION}:`;
const ID_SAVE_PREFIX = `${SAVE_PREFIX}id:`;
const LEGACY_WORLD_PREFIX = 'legacy:';

export interface WorldSummary {
  worldId: string;
  worldName: string;
  seed: string;
  savedAt: number;
  createdAt: number;
  editCount: number;
}

export interface CaveriaSaveData {
  version: number;
  worldId: string;
  worldName: string;
  seed: string;
  createdAt: number;
  savedAt: number;
  player: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    flyMode: boolean;
    health: number;
    hunger: number;
    saturation: number;
  };
  inventory: Array<ItemStack | null>;
  armor: Record<ArmorSlot, ItemStack | null>;
  selectedHotbar: number;
  creativeMode: boolean;
  timeOfDay: number;
  weather: {
    phase: 'clear' | 'rain' | 'storm';
    intensity: number;
    timeRemaining: number;
  };
  muted: boolean;
  temperature: number;
  statusEffects: StatusEffectSnapshot[];
  furnaces: FurnaceStateSnapshot[];
  chests: ChestStateSnapshot[];
  farms: FarmPlotSnapshot[];
  beds: BedSnapshot[];
  respawnBed: [number, number, number] | null;
  mobs: SavedMobSnapshot[];
  worldEdits: SerializedVoxelEdit[];
}

/** Versioned multi-world local storage. Terrain is regenerated; only metadata and edits are stored. */
export class WorldPersistence {
  private readonly storageKey: string;

  constructor(
    public readonly seedLabel: string,
    public readonly worldId = `${LEGACY_WORLD_PREFIX}${seedLabel}`,
    public readonly worldName = seedLabel
  ) {
    this.storageKey = WorldPersistence.keyForWorld(worldId, seedLabel);
  }

  public static listWorlds(): WorldSummary[] {
    const worlds: WorldSummary[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(SAVE_PREFIX)) continue;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as Partial<CaveriaSaveData>;
        if (parsed.version !== SAVE_VERSION || typeof parsed.seed !== 'string') continue;

        const legacy = !key.startsWith(ID_SAVE_PREFIX);
        const worldId =
          typeof parsed.worldId === 'string' && parsed.worldId.length > 0
            ? parsed.worldId
            : legacy
              ? `${LEGACY_WORLD_PREFIX}${parsed.seed}`
              : decodeURIComponent(key.slice(ID_SAVE_PREFIX.length));
        const worldName =
          typeof parsed.worldName === 'string' && parsed.worldName.trim().length > 0
            ? parsed.worldName.trim().slice(0, 48)
            : parsed.seed === 'caveria' ? 'Caveria World' : parsed.seed;
        worlds.push({
          worldId,
          worldName,
          seed: parsed.seed,
          savedAt: WorldPersistence.finite(parsed.savedAt, 0),
          createdAt: WorldPersistence.finite(parsed.createdAt, parsed.savedAt ?? Date.now()),
          editCount: Array.isArray(parsed.worldEdits) ? parsed.worldEdits.length : 0,
        });
      } catch (error) {
        console.warn(`[Caveria] Ignoring unreadable saved world ${key}.`, error);
      }
    }
    return worlds.sort((a, b) => b.savedAt - a.savedAt);
  }

  public static deleteWorld(worldId: string, seed: string): void {
    localStorage.removeItem(WorldPersistence.keyForWorld(worldId, seed));
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

  private static keyForWorld(worldId: string, seed: string): string {
    return worldId.startsWith(LEGACY_WORLD_PREFIX)
      ? `${SAVE_PREFIX}${encodeURIComponent(seed)}`
      : `${ID_SAVE_PREFIX}${encodeURIComponent(worldId)}`;
  }

  private static finite(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private sanitize(raw: Partial<CaveriaSaveData>): CaveriaSaveData {
    const finite = WorldPersistence.finite;
    const player = raw.player ?? {
      x: 8.5,
      y: 90,
      z: 8.5,
      yaw: 0,
      pitch: 0,
      flyMode: false,
      health: 20,
      hunger: 20,
      saturation: 5,
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

    const armor: Record<ArmorSlot, ItemStack | null> = {
      helmet: null,
      chestplate: null,
      leggings: null,
      boots: null,
    };
    for (const slot of Object.keys(armor) as ArmorSlot[]) {
      const stack = raw.armor?.[slot];
      if (!stack || !ITEMS[stack.id] || ITEMS[stack.id].armorSlot !== slot) continue;
      const maxDurability = ITEMS[stack.id].maxDurability;
      armor[slot] = {
        id: stack.id,
        count: 1,
        durability: maxDurability === undefined
          ? undefined
          : Math.max(1, Math.min(maxDurability, Math.floor(finite(stack.durability, maxDurability)))),
      };
    }

    const sanitizeStack = (stack: ItemStack | null | undefined): ItemStack | null => {
      if (!stack || !ITEMS[stack.id]) return null;
      const definition = ITEMS[stack.id];
      return {
        id: stack.id,
        count: Math.max(1, Math.min(definition.maxStack, Math.floor(finite(stack.count, 1)))),
        durability: definition.maxDurability === undefined
          ? undefined
          : Math.max(1, Math.min(definition.maxDurability, Math.floor(finite(stack.durability, definition.maxDurability)))),
      };
    };
    const furnaces: FurnaceStateSnapshot[] = [];
    if (Array.isArray(raw.furnaces)) {
      for (const furnace of raw.furnaces.slice(0, 2048)) {
        if (!furnace || typeof furnace !== 'object') continue;
        const x = Math.floor(worldCoord(furnace.x, 0));
        const y = Math.max(0, Math.min(CHUNK_HEIGHT - 1, Math.floor(finite(furnace.y, 0))));
        const z = Math.floor(worldCoord(furnace.z, 0));
        furnaces.push({
          x,
          y,
          z,
          input: sanitizeStack(furnace.input),
          fuel: sanitizeStack(furnace.fuel),
          output: sanitizeStack(furnace.output),
          burnRemaining: Math.max(0, Math.min(600, finite(furnace.burnRemaining, 0))),
          burnTotal: Math.max(0, Math.min(600, finite(furnace.burnTotal, 0))),
          smeltProgress: Math.max(0, Math.min(60, finite(furnace.smeltProgress, 0))),
        });
      }
    }

    const chests: ChestStateSnapshot[] = [];
    if (Array.isArray(raw.chests)) {
      for (const chest of raw.chests.slice(0, 2048)) {
        if (!chest || typeof chest !== 'object') continue;
        const slots = new Array<ItemStack | null>(CHEST_SLOT_COUNT).fill(null);
        if (Array.isArray(chest.slots)) {
          for (let index = 0; index < Math.min(CHEST_SLOT_COUNT, chest.slots.length); index++) {
            slots[index] = sanitizeStack(chest.slots[index]);
          }
        }
        chests.push({
          x: Math.floor(worldCoord(chest.x, 0)),
          y: Math.max(0, Math.min(CHUNK_HEIGHT - 1, Math.floor(finite(chest.y, 0)))),
          z: Math.floor(worldCoord(chest.z, 0)),
          slots,
        });
      }
    }

    const farms: FarmPlotSnapshot[] = [];
    if (Array.isArray(raw.farms)) {
      for (const farm of raw.farms.slice(0, 4096)) {
        if (!farm || typeof farm !== 'object') continue;
        const crop = farm.crop === 'berries' || farm.crop === 'shroom' ? farm.crop : null;
        farms.push({
          x: Math.floor(worldCoord(farm.x, 0)),
          y: Math.max(0, Math.min(CHUNK_HEIGHT - 2, Math.floor(finite(farm.y, 0)))),
          z: Math.floor(worldCoord(farm.z, 0)),
          crop,
          stage: crop ? Math.max(0, Math.min(2, Math.floor(finite(farm.stage, 0)))) : 0,
          growthRemaining: Math.max(0, Math.min(300, finite(farm.growthRemaining, 40))),
          drySeconds: Math.max(0, Math.min(120, finite(farm.drySeconds, 0))),
        });
      }
    }

    const beds: BedSnapshot[] = [];
    if (Array.isArray(raw.beds)) {
      for (const bed of raw.beds.slice(0, 2048)) {
        if (!bed || typeof bed !== 'object') continue;
        const footX = Math.floor(worldCoord(bed.footX, 0));
        const footY = Math.max(0, Math.min(CHUNK_HEIGHT - 1, Math.floor(finite(bed.footY, 0))));
        const footZ = Math.floor(worldCoord(bed.footZ, 0));
        const headX = Math.floor(worldCoord(bed.headX, footX));
        const headY = Math.max(0, Math.min(CHUNK_HEIGHT - 1, Math.floor(finite(bed.headY, footY))));
        const headZ = Math.floor(worldCoord(bed.headZ, footZ));
        if (headY !== footY || Math.abs(headX - footX) + Math.abs(headZ - footZ) !== 1) continue;
        beds.push({ footX, footY, footZ, headX, headY, headZ });
      }
    }
    const respawnBed: [number, number, number] | null =
      Array.isArray(raw.respawnBed) && raw.respawnBed.length === 3
        ? [
            Math.floor(worldCoord(raw.respawnBed[0], 0)),
            Math.max(0, Math.min(CHUNK_HEIGHT - 1, Math.floor(finite(raw.respawnBed[1], 0)))),
            Math.floor(worldCoord(raw.respawnBed[2], 0)),
          ]
        : null;

    const validEffects = new Set<StatusEffectId>(STATUS_EFFECT_IDS);
    const statusEffects: StatusEffectSnapshot[] = [];
    if (Array.isArray(raw.statusEffects)) {
      for (const effect of raw.statusEffects.slice(0, 12)) {
        if (!effect || typeof effect !== 'object' || !validEffects.has(effect.id as StatusEffectId)) continue;
        const id = effect.id as StatusEffectId;
        const remaining = Math.max(
          0,
          Math.min(STATUS_EFFECT_DEFINITIONS[id].maxPersistedSeconds, finite(effect.remaining, 0))
        );
        if (remaining > 0) statusEffects.push({ id, remaining });
      }
    }

    const mobs: SavedMobSnapshot[] = [];
    const mobIds = new Set<number>();
    if (Array.isArray(raw.mobs)) {
      for (const mob of raw.mobs.slice(0, 256)) {
        if (!mob || typeof mob !== 'object' || !MOB_DEFINITIONS[mob.species]) continue;
        const id = Math.max(1, Math.floor(finite(mob.id, 0)));
        if (mobIds.has(id)) continue;
        if (!Array.isArray(mob.position) || mob.position.length !== 3) continue;
        const velocity = Array.isArray(mob.velocity) && mob.velocity.length === 3
          ? mob.velocity
          : [0, 0, 0];
        mobIds.add(id);
        mobs.push({
          id,
          species: mob.species,
          position: [
            worldCoord(mob.position[0], 0),
            Math.max(0, Math.min(CHUNK_HEIGHT + 16, finite(mob.position[1], 1))),
            worldCoord(mob.position[2], 0),
          ],
          velocity: [
            Math.max(-30, Math.min(30, finite(velocity[0], 0))),
            Math.max(-30, Math.min(30, finite(velocity[1], 0))),
            Math.max(-30, Math.min(30, finite(velocity[2], 0))),
          ],
          health: Math.max(1, Math.min(MOB_DEFINITIONS[mob.species].maxHealth, finite(mob.health, 1))),
          age: Math.max(0, Math.min(1_000_000, finite(mob.age, 0))),
          hurtTimer: Math.max(0, Math.min(2, finite(mob.hurtTimer, 0))),
          state: mob.state && typeof mob.state === 'object' ? mob.state : {},
        });
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
      worldId: this.worldId,
      worldName:
        typeof raw.worldName === 'string' && raw.worldName.trim().length > 0
          ? raw.worldName.trim().slice(0, 48)
          : this.worldName,
      seed: this.seedLabel,
      createdAt: finite(raw.createdAt, finite(raw.savedAt, Date.now())),
      savedAt: finite(raw.savedAt, Date.now()),
      player: {
        x: worldCoord(player.x, 8.5),
        y: Math.max(1, Math.min(CHUNK_HEIGHT + 32, finite(player.y, 90))),
        z: worldCoord(player.z, 8.5),
        yaw: finite(player.yaw, 0),
        pitch: Math.max(-Math.PI / 2, Math.min(Math.PI / 2, finite(player.pitch, 0))),
        flyMode: Boolean(player.flyMode),
        health: Math.max(1, Math.min(20, Math.round(finite(player.health, 20)))),
        hunger: Math.max(0, Math.min(20, Math.round(finite(player.hunger, 20)))),
        saturation: Math.max(0, Math.min(20, finite(player.saturation, 5))),
      },
      inventory,
      armor,
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
      temperature: Math.max(0, Math.min(100, finite(raw.temperature, 50))),
      statusEffects,
      furnaces,
      chests,
      farms,
      beds,
      respawnBed,
      mobs,
      worldEdits,
    };
  }
}
