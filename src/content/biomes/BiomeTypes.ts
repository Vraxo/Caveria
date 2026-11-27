export const SURFACE_BIOMES = [
  'Desert Dunes',
  'Snowy Taiga',
  'Alpine Peaks',
  'Oak Forest',
  'Meadows',
] as const;

export type SurfaceBiome = typeof SURFACE_BIOMES[number];

export const CAVERN_BIOMES = [
  'Lush Bioluminescent Cavern',
  'Crystal Geode Hall',
  'Dripstone Depths',
] as const;

export type CavernBiome = typeof CAVERN_BIOMES[number];
