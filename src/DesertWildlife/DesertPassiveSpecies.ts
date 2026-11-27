import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { BlockId } from '../content/BlockId';
import {
  CAMEL_ID,
  LIZARD_ID,
  MOB_DEFINITIONS,
} from '../content/mobs/MobDefinitions';
import {
  SurfaceAnimalSpecies,
  SurfaceAnimalVisualAdapter,
  type SurfaceAnimalEntity,
} from '../entities/SurfaceAnimalSpecies';
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
  openCamelStorage(camel: SurfaceAnimalEntity<WildlifeVisual>): void;
  isNight(): boolean;
}

export function createCamelSpecies({
  scene, world, player, drops, particles, audio, camelRiding, openCamelStorage,
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
    storageSlots: 18,
    playAmbientSound: () => audio.playCamelCall(),
    playHitSound: () => audio.playDesertWildlifeHit(),
    playDeathSound: () => audio.playDesertWildlifeDeath(),
    onEmptyHandInteract: (camel, _runtime, sneaking) => {
      if (camel.state.growthRemaining > 0) return null;
      camel.state.persistent = true;
      if (sneaking) {
        openCamelStorage(camel);
        return { swing: true };
      }
      return camelRiding.mount(camel) ? { swing: true } : null;
    },
    isExternallyControlled: (camel) => camelRiding.isMounted(camel),
    preventDespawn: (camel) => camel.state.persistent === true,
    onDeath: (camel) => {
      for (const stack of camel.state.storage ?? []) {
        if (!stack) continue;
        drops.spawnDrop(camel.position.x, camel.position.y + 0.8, camel.position.z, { ...stack });
      }
      camel.state.storage?.fill(null);
    },
    onRemoved: (camel) => camelRiding.dismountIfMounted(camel),
  });
}

export function createLizardSpecies({
  scene, world, player, drops, particles, audio, isNight,
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
    // Desert Lizards bask through the hot day unless a nearby player startles them.
    isExternallyControlled: (lizard) => !isNight()
      && Math.hypot(
        lizard.position.x - player.position.x,
        lizard.position.z - player.position.z
      ) >= 5.5,
  });
}
