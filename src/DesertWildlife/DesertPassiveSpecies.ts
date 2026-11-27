import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { BlockId } from '../content/BlockId';
import {
  CAMEL_ID,
  LIZARD_ID,
  MOB_DEFINITIONS,
} from '../content/mobs/MobDefinitions';
import { SurfaceAnimalSpecies, SurfaceAnimalVisualAdapter } from '../entities/SurfaceAnimalSpecies';
import { ItemId } from '../items/Item';
import { Player } from '../player/Player';
import { BreakParticles } from '../rendering/BreakParticles';
import { DroppedItemManager } from '../rendering/DroppedItems';
import { World } from '../world/World';
import { CamelRidingController } from './CamelRidingController';
import {
  WildlifeVisual,
  createCamelVisual,
  createLizardVisual,
  disposeWildlifeVisual,
  updateGroundWildlifeVisual,
} from './DesertWildlifeVisuals';

function adapter(create: () => WildlifeVisual): SurfaceAnimalVisualAdapter<WildlifeVisual> {
  return {
    create,
    root: (visual) => visual.root,
    update: updateGroundWildlifeVisual,
    dispose: disposeWildlifeVisual,
  };
}

interface DesertPassiveDependencies {
  scene: THREE.Scene;
  world: World;
  player: Player;
  drops: DroppedItemManager;
  particles: BreakParticles;
  audio: AudioManager;
  camelRiding: CamelRidingController;
}

export function createCamelSpecies({
  scene, world, player, drops, particles, audio, camelRiding,
}: DesertPassiveDependencies): SurfaceAnimalSpecies<WildlifeVisual> {
  return new SurfaceAnimalSpecies(scene, world, player, drops, particles, {
    definition: MOB_DEFINITIONS[CAMEL_ID],
    requiredBiomeTag: 'arid',
    visual: adapter(createCamelVisual),
    particles: BlockId.Sand,
    wanderSpeed: 0.55,
    fleeSpeed: 1.45,
    fleeDistance: 4.5,
    minimumSpawnSpacing: 6,
    spawnGround: new Set([BlockId.Sand]),
    breedingItem: ItemId.Cactus,
    resource: 'none',
    playAmbientSound: () => audio.playCamelCall(),
    playHitSound: () => audio.playDesertWildlifeHit(),
    playDeathSound: () => audio.playDesertWildlifeDeath(),
    onEmptyHandInteract: (camel) => camelRiding.mount(camel) ? { swing: true } : null,
    isExternallyControlled: (camel) => camelRiding.isMounted(camel),
    onRemoved: (camel) => camelRiding.dismountIfMounted(camel),
  });
}

export function createLizardSpecies({
  scene, world, player, drops, particles, audio,
}: DesertPassiveDependencies): SurfaceAnimalSpecies<WildlifeVisual> {
  return new SurfaceAnimalSpecies(scene, world, player, drops, particles, {
    definition: MOB_DEFINITIONS[LIZARD_ID],
    requiredBiomeTag: 'arid',
    visual: adapter(createLizardVisual),
    particles: BlockId.Sand,
    wanderSpeed: 0.9,
    fleeSpeed: 2.7,
    fleeDistance: 5.5,
    minimumSpawnSpacing: 2,
    spawnGround: new Set([BlockId.Sand]),
    breedingItem: ItemId.Cactus,
    resource: 'none',
    playAmbientSound: () => audio.playLizardChirp(),
    playHitSound: () => audio.playDesertWildlifeHit(),
    playDeathSound: () => audio.playDesertWildlifeDeath(),
  });
}
