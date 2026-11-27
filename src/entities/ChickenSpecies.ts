import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { BlockId } from '../content/BlockId';
import { CHICKEN_ID, MOB_DEFINITIONS } from '../content/mobs/MobDefinitions';
import { Player } from '../player/Player';
import { BreakParticles } from '../rendering/BreakParticles';
import { DroppedItemManager } from '../rendering/DroppedItems';
import { World } from '../world/World';
import {
  ChickenVisual,
  createChickenVisual,
  disposeChickenVisual,
  updateChickenVisual,
} from './ChickenVisual';
import { SurfaceAnimalSpecies, SurfaceAnimalVisualAdapter } from './SurfaceAnimalSpecies';

const VISUAL: SurfaceAnimalVisualAdapter<ChickenVisual> = {
  create: createChickenVisual,
  root: (visual) => visual.root,
  update: updateChickenVisual,
  dispose: disposeChickenVisual,
};

/** Creates the registered Chicken behavior; instances themselves are owned by MobManager. */
export function createChickenSpecies(
  scene: THREE.Scene,
  world: World,
  player: Player,
  drops: DroppedItemManager,
  particles: BreakParticles,
  audio: AudioManager
): SurfaceAnimalSpecies<ChickenVisual> {
  return new SurfaceAnimalSpecies(scene, world, player, drops, particles, {
    definition: MOB_DEFINITIONS[CHICKEN_ID],
    allowedBiomes: new Set(['Meadows', 'Oak Forest']),
    visual: VISUAL,
    particles: BlockId.SnowBlock,
    wanderSpeed: 0.72,
    fleeSpeed: 2.3,
    fleeDistance: 5.2,
    minimumSpawnSpacing: 2.5,
    resource: 'eggs',
    playAmbientSound: () => audio.playChickenCluck(),
    playHitSound: () => audio.playChickenHit(),
    playDeathSound: () => audio.playChickenDeath(),
  });
}
