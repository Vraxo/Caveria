import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import {
  MOB_DEFINITIONS,
  SCORPION_ID,
  SNAKE_ID,
} from '../content/mobs/MobDefinitions';
import { MobSpeciesBehavior } from '../entities/MobTypes';
import { Player } from '../player/Player';
import { PlayerVitals } from '../player/PlayerVitals';
import { BreakParticles } from '../rendering/BreakParticles';
import { DroppedItemManager } from '../rendering/DroppedItems';
import { World } from '../world/World';
import { CamelRidingController } from './CamelRidingController';
import { DesertHostileSpecies } from './DesertHostileSpecies';
import { createCamelSpecies, createLizardSpecies } from './DesertPassiveSpecies';
import { createScorpionVisual, createSnakeVisual } from './DesertWildlifeVisuals';
import { VultureSpecies } from './VultureSpecies';

export interface DesertWildlifeDependencies {
  scene: THREE.Scene;
  world: World;
  player: Player;
  vitals: PlayerVitals;
  drops: DroppedItemManager;
  particles: BreakParticles;
  audio: AudioManager;
  camelRiding: CamelRidingController;
  poisonPlayer(): void;
}

/** Builds one registered behavior per desert species; MobManager retains all instance ownership. */
export function createDesertWildlife(
  dependencies: DesertWildlifeDependencies
): ReadonlyArray<MobSpeciesBehavior<any, any>> {
  const {
    scene, world, player, vitals, drops, particles, audio, camelRiding, poisonPlayer,
  } = dependencies;
  const shared = { scene, world, player, drops, particles, audio, camelRiding };
  return [
    createCamelSpecies(shared),
    new DesertHostileSpecies(
      scene,
      world,
      player,
      vitals,
      drops,
      particles,
      {
        definition: MOB_DEFINITIONS[SCORPION_ID],
        createVisual: createScorpionVisual,
        wanderSpeed: 0.65,
        pursuitSpeed: 1.75,
        sightDistance: 9,
        attackDistance: 1.05,
        attackDamage: 2,
        poisonChance: 0.3,
        minimumSpawnSpacing: 2.5,
        playCall: () => audio.playScorpionChitter(),
        playHit: () => audio.playDesertWildlifeHit(),
        playDeath: () => audio.playDesertWildlifeDeath(),
      },
      poisonPlayer
    ),
    new DesertHostileSpecies(
      scene,
      world,
      player,
      vitals,
      drops,
      particles,
      {
        definition: MOB_DEFINITIONS[SNAKE_ID],
        createVisual: createSnakeVisual,
        wanderSpeed: 0.75,
        pursuitSpeed: 1.55,
        sightDistance: 8,
        attackDistance: 1,
        attackDamage: 2,
        poisonChance: 0.4,
        minimumSpawnSpacing: 3,
        playCall: () => audio.playSnakeHiss(),
        playHit: () => audio.playDesertWildlifeHit(),
        playDeath: () => audio.playDesertWildlifeDeath(),
      },
      poisonPlayer
    ),
    createLizardSpecies(shared),
    new VultureSpecies(
      scene,
      world,
      player,
      drops,
      particles,
      () => audio.playVultureCry(),
      () => audio.playDesertWildlifeHit(),
      () => audio.playDesertWildlifeDeath()
    ),
  ];
}
