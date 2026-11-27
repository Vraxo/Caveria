import { TileIndex } from '../../content/TileIndex';
import { loadTileCanvases } from './TextureLoad';

/** Root relative URL containing texture pack folders and `packs.json`. */
export const TEXTURE_PACKS_BASE_URL = 'texture-packs/';

/** Manifest listing installed texture pack folders. */
export const TEXTURE_PACKS_MANIFEST_URL = `${TEXTURE_PACKS_BASE_URL}packs.json`;

/** Default built-in procedural pack identifier. */
export const DEFAULT_TEXTURE_PACK_ID = 'default';

export interface TexturePackDescriptor {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  /**
   * Optional tile override hint for a pack folder:
   * - `'all'` or omitted: load all present `tile-XXX.png` files from the folder.
   * - `number[]`: load only those tile indices (e.g. `[]` for purely procedural packs).
   */
  readonly tiles?: 'all' | readonly number[];
}

/** Fallback list used if `texture-packs/packs.json` cannot be fetched. */
export const BUILTIN_TEXTURE_PACKS: readonly TexturePackDescriptor[] = [
  {
    id: DEFAULT_TEXTURE_PACK_ID,
    name: 'Default',
    description: 'Original Caveria voxel textures',
    tiles: 'all',
  },
  {
    id: 'ocd',
    name: 'oCd',
    description: 'Minimalist crisp geometric block textures inspired by oCd',
    tiles: 'all',
  },
];

const VALID_TILE_INDICES = new Set<number>(
  Object.values(TileIndex).filter((value): value is TileIndex => typeof value === 'number')
);

/** Relative URL prefix for a texture pack folder, e.g. `texture-packs/ocd/`. */
export function packFolderUrl(packId: string): string {
  return `${TEXTURE_PACKS_BASE_URL}${encodeURIComponent(packId)}/`;
}

function normalizeDescriptor(raw: unknown): TexturePackDescriptor | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  if (!id || !name || id.includes('/') || id.includes('\\') || id === '.' || id === '..') {
    return null;
  }
  const description =
    typeof record.description === 'string' && record.description.trim()
      ? record.description.trim()
      : undefined;
  let tiles: 'all' | readonly number[] | undefined;
  if (record.tiles === 'all') {
    tiles = 'all';
  } else if (Array.isArray(record.tiles)) {
    tiles = record.tiles.filter(
      (item): item is number => typeof item === 'number' && VALID_TILE_INDICES.has(item)
    );
  }
  return { id, name, description, tiles };
}

/** Loads the installed texture pack list from `texture-packs/packs.json`. */
export async function loadTexturePackManifest(
  manifestUrl: string = TEXTURE_PACKS_MANIFEST_URL
): Promise<TexturePackDescriptor[]> {
  try {
    if (typeof fetch !== 'function') return [...BUILTIN_TEXTURE_PACKS];
    const response = await fetch(manifestUrl);
    if (!response.ok) return [...BUILTIN_TEXTURE_PACKS];
    const parsed: unknown = await response.json();
    if (!Array.isArray(parsed)) return [...BUILTIN_TEXTURE_PACKS];

    const seen = new Set<string>();
    const packs: TexturePackDescriptor[] = [];
    for (const item of parsed) {
      const descriptor = normalizeDescriptor(item);
      if (descriptor && !seen.has(descriptor.id)) {
        seen.add(descriptor.id);
        packs.push(descriptor);
      }
    }
    if (packs.length === 0) return [...BUILTIN_TEXTURE_PACKS];
    if (!seen.has(DEFAULT_TEXTURE_PACK_ID)) {
      packs.unshift(BUILTIN_TEXTURE_PACKS[0]);
    }
    return packs;
  } catch {
    return [...BUILTIN_TEXTURE_PACKS];
  }
}

/** Resolves a saved pack id against available packs, falling back to `default`. */
export function resolveTexturePack(
  packs: readonly TexturePackDescriptor[],
  requestedId: string
): TexturePackDescriptor {
  return (
    packs.find((pack) => pack.id === requestedId) ??
    packs.find((pack) => pack.id === DEFAULT_TEXTURE_PACK_ID) ??
    packs[0] ??
    BUILTIN_TEXTURE_PACKS[0]
  );
}

/** Loads the override tile canvases for a texture pack folder. */
export async function loadTexturePackTiles(
  pack: TexturePackDescriptor
): Promise<Map<TileIndex, HTMLCanvasElement>> {
  if (Array.isArray(pack.tiles)) {
    if (pack.tiles.length === 0) return new Map();
    return loadTileCanvases(packFolderUrl(pack.id), pack.tiles as TileIndex[]);
  }
  return loadTileCanvases(packFolderUrl(pack.id));
}
