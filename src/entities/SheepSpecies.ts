import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { BlockId } from '../content/BlockId';
import { MOB_DEFINITIONS, SHEEP_ID } from '../content/mobs/MobDefinitions';
import { Player } from '../player/Player';
import { BreakParticles } from '../rendering/BreakParticles';
import { DroppedItemManager } from '../rendering/DroppedItems';
import { World } from '../world/World';
import {
  SheepVisual,
  createSheepVisual,
  disposeSheepVisual,
  updateSheepVisual,
} from './SheepVisual';
import { SurfaceAnimalSpecies, SurfaceAnimalVisualAdapter } from './SurfaceAnimalSpecies';

const VISUAL: SurfaceAnimalVisualAdapter<SheepVisual> = {
  create: createSheepVisual,
  root: (visual) => visual.root,
  update: updateSheepVisual,
  dispose: disposeSheepVisual,
};

/** Creates the registered Sheep behavior; instances themselves are owned by MobManager. */
export function createSheepSpecies(
  scene: THREE.Scene,
  world: World,
  player: Player,
  drops: DroppedItemManager,
  particles: BreakParticles,
  audio: AudioManager
): SurfaceAnimalSpecies<SheepVisual> {
  return new SurfaceAnimalSpecies(scene, world, player, drops, particles, {
    definition: MOB_DEFINITIONS[SHEEP_ID],
    allowedBiomes: new Set(['Meadows', 'Oak Forest', 'Snowy Taiga', 'Alpine Peaks']),
    visual: VISUAL,
    particles: BlockId.SnowBlock,
    wanderSpeed: 0.62,
    fleeSpeed: 1.9,
    fleeDistance: 5.8,
    minimumSpawnSpacing: 3.5,
    resource: 'wool',
    playAmbientSound: () => audio.playSheepBleat(),
    playHitSound: () => audio.playSheepHit(),
    playDeathSound: () => audio.playSheepDeath(),
  });
}
