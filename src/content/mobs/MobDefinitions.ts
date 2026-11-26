import { MobSpeciesId, MobTag } from '../../entities/MobTypes';

export const CRYSTAL_MITE_ID = 'crystal-mite';
export const CAVE_CRAWLER_ID = 'cave-crawler';

export interface MobDefinition {
  id: MobSpeciesId;
  name: string;
  tags: ReadonlyArray<MobTag>;
  maxHealth: number;
  radius: number;
  height: number;
  maxPopulation: number;
  despawnDistance: number;
  spawnDelay: { minimum: number; variance: number };
  lootTable: string;
}

export const MOB_DEFINITIONS: Readonly<Record<string, MobDefinition>> = {
  [CRYSTAL_MITE_ID]: {
    id: CRYSTAL_MITE_ID,
    name: 'Crystal Mite',
    tags: ['passive', 'underground'],
    maxHealth: 4,
    radius: 0.28,
    height: 0.48,
    maxPopulation: 7,
    despawnDistance: 42,
    spawnDelay: { minimum: 1.8, variance: 2.4 },
    lootTable: 'crystal-mite',
  },
  [CAVE_CRAWLER_ID]: {
    id: CAVE_CRAWLER_ID,
    name: 'Cave Crawler',
    tags: ['hostile', 'underground', 'blocks-sleep', 'poisonous'],
    maxHealth: 10,
    radius: 0.38,
    height: 0.65,
    maxPopulation: 4,
    despawnDistance: 46,
    spawnDelay: { minimum: 3.5, variance: 4 },
    lootTable: 'cave-crawler',
  },
};
