import { MobSpeciesId, MobTag } from '../../entities/MobTypes';

export const CRYSTAL_MITE_ID = 'crystal-mite';
export const CAVE_CRAWLER_ID = 'cave-crawler';
export const CHICKEN_ID = 'chicken';
export const SHEEP_ID = 'sheep';

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
  [CHICKEN_ID]: {
    id: CHICKEN_ID,
    name: 'Chicken',
    tags: ['passive', 'animal', 'surface'],
    maxHealth: 4,
    radius: 0.38,
    height: 0.9,
    maxPopulation: 8,
    despawnDistance: 52,
    spawnDelay: { minimum: 3, variance: 5 },
    lootTable: 'chicken',
  },
  [SHEEP_ID]: {
    id: SHEEP_ID,
    name: 'Sheep',
    tags: ['passive', 'animal', 'surface'],
    maxHealth: 8,
    radius: 0.55,
    height: 1.15,
    maxPopulation: 6,
    despawnDistance: 52,
    spawnDelay: { minimum: 4, variance: 6 },
    lootTable: 'sheep',
  },
};
