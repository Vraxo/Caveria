import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { BlockId } from '../content/BlockId';
import { MOB_DEFINITIONS, RABBIT_ID } from '../content/mobs/MobDefinitions';
import { ItemId } from '../items/Item';
import { Player } from '../player/Player';
import { BreakParticles } from '../rendering/BreakParticles';
import { DroppedItemManager } from '../rendering/DroppedItems';
import { World } from '../world/World';
import {
  RabbitVisual,
  createRabbitVisual,
  disposeRabbitVisual,
  updateRabbitVisual,
} from './RabbitVisual';
import { SurfaceAnimalSpecies, SurfaceAnimalVisualAdapter } from './SurfaceAnimalSpecies';

const VISUAL: SurfaceAnimalVisualAdapter<RabbitVisual> = {
  create: createRabbitVisual,
  root: (visual) => visual.root,
  update: updateRabbitVisual,
  dispose: disposeRabbitVisual,
};

/** Creates desert Rabbit behavior; instances themselves are owned by MobManager. */
export function createRabbitSpecies(
  scene: THREE.Scene,
  world: World,
  player: Player,
  drops: DroppedItemManager,
  particles: BreakParticles,
  audio: AudioManager
): SurfaceAnimalSpecies<RabbitVisual> {
  return new SurfaceAnimalSpecies(scene, world, player, drops, particles, {
    definition: MOB_DEFINITIONS[RABBIT_ID],
    requiredBiomeTag: 'arid',
    visual: VISUAL,
    particles: BlockId.Sand,
    wanderSpeed: 1.05,
    fleeSpeed: 3.1,
    fleeDistance: 6.2,
    minimumSpawnSpacing: 2.2,
    spawnGround: new Set([BlockId.Sand]),
    breedingItem: ItemId.Cactus,
    resource: 'none',
    playAmbientSound: () => audio.playRabbitSqueak(),
    playHitSound: () => audio.playRabbitHit(),
    playDeathSound: () => audio.playRabbitDeath(),
  });
}
