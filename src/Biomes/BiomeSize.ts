export const BIOME_SIZES = ['compact', 'standard', 'large'] as const;
export type BiomeSize = typeof BIOME_SIZES[number];

export interface BiomeSizeProfile {
  id: BiomeSize;
  label: string;
  description: string;
  /** Lower sampling frequencies produce larger regions. */
  surfaceFrequencyMultiplier: number;
  cavernFrequencyMultiplier: number;
}

export const DEFAULT_BIOME_SIZE: BiomeSize = 'standard';

export const BIOME_SIZE_PROFILES: Readonly<Record<BiomeSize, BiomeSizeProfile>> = {
  compact: {
    id: 'compact',
    label: 'Compact',
    description: 'More frequent transitions, usually 150–300 blocks per region',
    surfaceFrequencyMultiplier: 1,
    cavernFrequencyMultiplier: 1,
  },
  standard: {
    id: 'standard',
    label: 'Standard',
    description: 'Broad regions, usually 300–600 blocks',
    surfaceFrequencyMultiplier: 0.75,
    cavernFrequencyMultiplier: 0.75,
  },
  large: {
    id: 'large',
    label: 'Large',
    description: 'Expansive regions, usually 600–1,200 blocks',
    surfaceFrequencyMultiplier: 0.4,
    cavernFrequencyMultiplier: 0.4,
  },
};

export function parseBiomeSize(value: unknown): BiomeSize {
  return typeof value === 'string' && BIOME_SIZES.includes(value as BiomeSize)
    ? value as BiomeSize
    : DEFAULT_BIOME_SIZE;
}
