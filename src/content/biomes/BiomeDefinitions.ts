import { ItemId } from '../../items/ItemTypes';
import { BlockId } from '../BlockId';
import {
  CAVERN_BIOMES,
  type CavernBiome,
  SURFACE_BIOMES,
  type SurfaceBiome,
} from './BiomeTypes';

export type BiomeTag =
  | 'arid'
  | 'cold'
  | 'forest'
  | 'fresh-surface-water'
  | 'temperate'
  | 'grazable'
  | 'geode'
  | 'lush'
  | 'dripstone';

export interface SurfaceBiomeSelectionContext {
  surfaceY: number;
  temperatureNoise: number;
  humidityNoise: number;
}

export interface SurfaceTerrainProfile {
  surfaceBlock(surfaceY: number): BlockId;
  shallowSubsurfaceBlock(depth: number, shore: boolean): BlockId;
  deepSubsurfaceBlock?(depth: number): BlockId | null;
}

export interface FishingBiomeWeightShift {
  from: ItemId;
  to: ItemId;
  weight: number;
}

export interface SurfaceBiomeDefinition {
  id: SurfaceBiome;
  tags: ReadonlyArray<BiomeTag>;
  selectionPriority: number;
  matches(context: SurfaceBiomeSelectionContext): boolean;
  terrain: SurfaceTerrainProfile;
  temperature: { day: number; night: number };
  precipitation: 'rain' | 'snow';
  surfaceWater: 'fresh' | 'variable';
  fishingWeightShifts: ReadonlyArray<FishingBiomeWeightShift>;
}

export interface CavernBiomeDefinition {
  id: CavernBiome;
  tags: ReadonlyArray<BiomeTag>;
  selectionPriority: number;
  matches(noise: number): boolean;
}

const GRASS_TERRAIN: SurfaceTerrainProfile = {
  surfaceBlock: () => BlockId.Grass,
  shallowSubsurfaceBlock: (_depth, shore) => shore ? BlockId.Sand : BlockId.Dirt,
};

const SURFACE_DEFINITIONS = {
  'Desert Dunes': {
    id: 'Desert Dunes',
    tags: ['arid'],
    selectionPriority: 20,
    matches: ({ temperatureNoise, humidityNoise }) =>
      temperatureNoise > 0.24 && humidityNoise < 0.08,
    terrain: {
      surfaceBlock: () => BlockId.Sand,
      shallowSubsurfaceBlock: (depth) => depth === 3 ? BlockId.Sandstone : BlockId.Sand,
      deepSubsurfaceBlock: (depth) => depth <= 6 ? BlockId.Sandstone : null,
    },
    temperature: { day: 78, night: 38 },
    precipitation: 'rain',
    surfaceWater: 'variable',
    fishingWeightShifts: [
      { from: ItemId.RawRiverFish, to: ItemId.Stick, weight: 10 },
    ],
  },
  'Snowy Taiga': {
    id: 'Snowy Taiga',
    tags: ['cold', 'forest', 'fresh-surface-water', 'grazable'],
    selectionPriority: 30,
    matches: ({ surfaceY, temperatureNoise }) => temperatureNoise < -0.22 || surfaceY >= 68,
    terrain: {
      surfaceBlock: () => BlockId.SnowGrass,
      shallowSubsurfaceBlock: (_depth, shore) => shore ? BlockId.Sand : BlockId.Dirt,
    },
    temperature: { day: 23, night: 10 },
    precipitation: 'snow',
    surfaceWater: 'fresh',
    fishingWeightShifts: [],
  },
  'Alpine Peaks': {
    id: 'Alpine Peaks',
    tags: ['cold', 'fresh-surface-water', 'grazable'],
    selectionPriority: 10,
    matches: ({ surfaceY }) => surfaceY >= 74,
    terrain: {
      surfaceBlock: (surfaceY) => surfaceY >= 79 ? BlockId.SnowBlock : BlockId.Stone,
      shallowSubsurfaceBlock: (_depth, shore) => shore ? BlockId.Sand : BlockId.Stone,
    },
    temperature: { day: 17, night: 5 },
    precipitation: 'snow',
    surfaceWater: 'fresh',
    fishingWeightShifts: [],
  },
  'Oak Forest': {
    id: 'Oak Forest',
    tags: ['forest', 'fresh-surface-water', 'temperate', 'grazable'],
    selectionPriority: 40,
    matches: ({ humidityNoise }) => humidityNoise > 0.06,
    terrain: GRASS_TERRAIN,
    temperature: { day: 52, night: 34 },
    precipitation: 'rain',
    surfaceWater: 'fresh',
    fishingWeightShifts: [],
  },
  Meadows: {
    id: 'Meadows',
    tags: ['temperate', 'grazable'],
    selectionPriority: 50,
    matches: () => true,
    terrain: GRASS_TERRAIN,
    temperature: { day: 52, night: 34 },
    precipitation: 'rain',
    surfaceWater: 'variable',
    fishingWeightShifts: [],
  },
} satisfies Record<SurfaceBiome, SurfaceBiomeDefinition>;

const CAVERN_DEFINITIONS = {
  'Lush Bioluminescent Cavern': {
    id: 'Lush Bioluminescent Cavern',
    tags: ['lush'],
    selectionPriority: 10,
    matches: (noise) => noise > 0.18,
  },
  'Crystal Geode Hall': {
    id: 'Crystal Geode Hall',
    tags: ['geode'],
    selectionPriority: 20,
    matches: (noise) => noise < -0.18,
  },
  'Dripstone Depths': {
    id: 'Dripstone Depths',
    tags: ['dripstone'],
    selectionPriority: 30,
    matches: () => true,
  },
} satisfies Record<CavernBiome, CavernBiomeDefinition>;

export class BiomeDefinitionRegistry {
  private readonly surfaceSelection: ReadonlyArray<SurfaceBiomeDefinition>;
  private readonly cavernSelection: ReadonlyArray<CavernBiomeDefinition>;

  public constructor(
    public readonly surface: Readonly<Record<SurfaceBiome, SurfaceBiomeDefinition>>,
    public readonly cavern: Readonly<Record<CavernBiome, CavernBiomeDefinition>>
  ) {
    for (const biome of SURFACE_BIOMES) validateSurfaceDefinition(surface[biome], biome);
    for (const biome of CAVERN_BIOMES) validateCavernDefinition(cavern[biome], biome);
    this.surfaceSelection = Object.values(surface)
      .sort((a, b) => a.selectionPriority - b.selectionPriority);
    this.cavernSelection = Object.values(cavern)
      .sort((a, b) => a.selectionPriority - b.selectionPriority);
  }

  public selectSurface(context: SurfaceBiomeSelectionContext): SurfaceBiomeDefinition {
    const definition = this.surfaceSelection.find((candidate) => candidate.matches(context));
    if (!definition) throw new Error('No surface biome matched the selection context');
    return definition;
  }

  public selectCavern(noise: number): CavernBiomeDefinition {
    const definition = this.cavernSelection.find((candidate) => candidate.matches(noise));
    if (!definition) throw new Error('No cavern biome matched the selection noise');
    return definition;
  }

  public getSurface(id: SurfaceBiome): SurfaceBiomeDefinition {
    return this.surface[id];
  }

  public getCavern(id: CavernBiome): CavernBiomeDefinition {
    return this.cavern[id];
  }
}

function validateSurfaceDefinition(
  definition: SurfaceBiomeDefinition | undefined,
  expectedId: SurfaceBiome
): void {
  if (!definition || definition.id !== expectedId) {
    throw new Error(`Missing or mismatched surface biome definition: ${expectedId}`);
  }
  if (!Number.isFinite(definition.selectionPriority)) {
    throw new Error(`${expectedId} has an invalid selection priority`);
  }
}

function validateCavernDefinition(
  definition: CavernBiomeDefinition | undefined,
  expectedId: CavernBiome
): void {
  if (!definition || definition.id !== expectedId) {
    throw new Error(`Missing or mismatched cavern biome definition: ${expectedId}`);
  }
  if (!Number.isFinite(definition.selectionPriority)) {
    throw new Error(`${expectedId} has an invalid selection priority`);
  }
}

export const BIOME_DEFINITIONS = new BiomeDefinitionRegistry(
  SURFACE_DEFINITIONS,
  CAVERN_DEFINITIONS
);
