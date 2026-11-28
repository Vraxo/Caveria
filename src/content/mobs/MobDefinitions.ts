import { MobSpeciesId, MobTag } from '../../entities/MobTypes';

export const CRYSTAL_MITE_ID = 'crystal-mite';
export const CAVE_CRAWLER_ID = 'cave-crawler';
export const CHICKEN_ID = 'chicken';
export const SHEEP_ID = 'sheep';
export const RABBIT_ID = 'rabbit';
export const CAMEL_ID = 'camel';
export const SCORPION_ID = 'scorpion';
export const SNAKE_ID = 'snake';
export const LIZARD_ID = 'lizard';
export const VULTURE_ID = 'vulture';
export const POLAR_BEAR_ID = 'polar-bear';

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
  [RABBIT_ID]: {
    id: RABBIT_ID,
    name: 'Rabbit',
    tags: ['passive', 'animal', 'surface'],
    maxHealth: 4,
    radius: 0.32,
    height: 0.7,
    maxPopulation: 7,
    despawnDistance: 52,
    spawnDelay: { minimum: 3.5, variance: 5 },
    lootTable: 'rabbit',
  },
  [CAMEL_ID]: {
    id: CAMEL_ID,
    name: 'Camel',
    tags: ['passive', 'animal', 'surface'],
    maxHealth: 16,
    radius: 0.72,
    height: 2.25,
    maxPopulation: 3,
    despawnDistance: 58,
    spawnDelay: { minimum: 7, variance: 8 },
    lootTable: 'camel',
  },
  [SCORPION_ID]: {
    id: SCORPION_ID,
    name: 'Scorpion',
    tags: ['hostile', 'animal', 'surface', 'poisonous', 'blocks-sleep'],
    maxHealth: 6,
    radius: 0.36,
    height: 0.38,
    maxPopulation: 5,
    despawnDistance: 48,
    spawnDelay: { minimum: 4, variance: 5 },
    lootTable: 'scorpion',
  },
  [SNAKE_ID]: {
    id: SNAKE_ID,
    name: 'Snake',
    tags: ['hostile', 'animal', 'surface', 'poisonous', 'blocks-sleep'],
    maxHealth: 5,
    radius: 0.3,
    height: 0.3,
    maxPopulation: 4,
    despawnDistance: 48,
    spawnDelay: { minimum: 5, variance: 6 },
    lootTable: 'snake',
  },
  [LIZARD_ID]: {
    id: LIZARD_ID,
    name: 'Lizard',
    tags: ['passive', 'animal', 'surface'],
    maxHealth: 3,
    radius: 0.25,
    height: 0.28,
    maxPopulation: 6,
    despawnDistance: 48,
    spawnDelay: { minimum: 3, variance: 5 },
    lootTable: 'lizard',
  },
  [VULTURE_ID]: {
    id: VULTURE_ID,
    name: 'Vulture',
    tags: ['passive', 'animal', 'surface'],
    maxHealth: 6,
    radius: 0.48,
    height: 0.8,
    maxPopulation: 4,
    despawnDistance: 64,
    spawnDelay: { minimum: 6, variance: 8 },
    lootTable: 'vulture',
  },
  [POLAR_BEAR_ID]: {
    id: POLAR_BEAR_ID,
    name: 'Polar Bear',
    tags: ['neutral', 'animal', 'surface'],
    maxHealth: 24,
    radius: 0.68,
    height: 1.4,
    maxPopulation: 4,
    despawnDistance: 58,
    spawnDelay: { minimum: 5, variance: 7 },
    lootTable: 'polar-bear',
  },
};
