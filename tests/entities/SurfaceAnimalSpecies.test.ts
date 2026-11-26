import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockId } from '../../src/content/BlockId';
import { MOB_DEFINITIONS } from '../../src/content/mobs/MobDefinitions';
import { Player } from '../../src/player/Player';
import { BreakParticles } from '../../src/rendering/BreakParticles';
import { DroppedItemManager } from '../../src/rendering/DroppedItems';
import {
  SurfaceAnimalSpecies,
  SurfaceAnimalState,
  SurfaceAnimalVisualAdapter,
} from '../../src/entities/SurfaceAnimalSpecies';
import { MobEntity } from '../../src/entities/MobTypes';
import { createFakeWorld } from '../fixtures/FakeWorld';
import { RecordingMobRuntime } from '../fixtures/RecordingMobRuntime';

interface TestVisual {
  root: THREE.Group;
  disposed: boolean;
}

const visualAdapter: SurfaceAnimalVisualAdapter<TestVisual> = {
  create: () => ({ root: new THREE.Group(), disposed: false }),
  root: (visual) => visual.root,
  update: vi.fn((visual, state) => visual.root.position.copy(state.position)),
  dispose: vi.fn((visual) => { visual.disposed = true; }),
};

function createHarness(options: { playerY?: number; biome?: 'Meadows' | 'Desert Dunes' } = {}) {
  const scene = new THREE.Scene();
  const world = createFakeWorld({
    getBlock: (_x, y) => y === 0 ? BlockId.Grass : BlockId.Air,
    surfaceHeight: 0,
    surfaceBiome: options.biome ?? 'Meadows',
  });
  const player = {
    position: new THREE.Vector3(1, options.playerY ?? 1, 0),
    velocity: new THREE.Vector3(),
  } as unknown as Player;
  const spawnDrop = vi.fn();
  const spawnBurst = vi.fn();
  const playAmbientSound = vi.fn();
  const playHitSound = vi.fn();
  const playDeathSound = vi.fn();
  const species = new SurfaceAnimalSpecies(
    scene,
    world,
    player,
    { spawnDrop } as unknown as DroppedItemManager,
    { spawnBurst } as unknown as BreakParticles,
    {
      definition: MOB_DEFINITIONS.chicken,
      allowedBiomes: new Set(['Meadows']),
      visual: visualAdapter,
      particles: BlockId.SnowBlock,
      wanderSpeed: 0.7,
      fleeSpeed: 2.3,
      fleeDistance: 5,
      minimumSpawnSpacing: 2.5,
      playAmbientSound,
      playHitSound,
      playDeathSound,
    }
  );
  return {
    scene,
    player,
    species,
    spawnDrop,
    spawnBurst,
    playAmbientSound,
    playHitSound,
    playDeathSound,
  };
}

function animalEntity(visual: TestVisual): MobEntity<SurfaceAnimalState, TestVisual> {
  return {
    id: 1,
    species: 'chicken',
    position: new THREE.Vector3(0, 1, 0),
    velocity: new THREE.Vector3(),
    onGround: false,
    health: 4,
    age: 0,
    hurtTimer: 0,
    state: {
      activity: 'idle',
      activityTimer: 1,
      facingAngle: 0,
      ambientSoundTimer: 0,
    },
    visual,
  };
}

afterEach(() => vi.restoreAllMocks());

describe('SurfaceAnimalSpecies', () => {
  it('spawns an individual entity on natural ground in an allowed biome', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { species, scene } = createHarness();
    const runtime = new RecordingMobRuntime();

    species.updateSpawning(3, runtime);

    expect(runtime.countSpecies('chicken')).toBe(1);
    expect(runtime.entities[0].position.toArray()).toEqual([10.5, 1, 0.5]);
    expect(scene.children).toHaveLength(1);
  });

  it('does not spawn underground or in a rejected biome', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const underground = createHarness({ playerY: -4 });
    const desert = createHarness({ biome: 'Desert Dunes' });
    const undergroundRuntime = new RecordingMobRuntime();
    const desertRuntime = new RecordingMobRuntime();

    underground.species.updateSpawning(3, undergroundRuntime);
    desert.species.updateSpawning(3, desertRuntime);

    expect(undergroundRuntime.entities).toHaveLength(0);
    expect(desertRuntime.entities).toHaveLength(0);
  });

  it('flees a nearby player, animates, and emits an ambient call', () => {
    const { species, playAmbientSound } = createHarness();
    const runtime = new RecordingMobRuntime();
    const visual: TestVisual = { root: new THREE.Group(), disposed: false };
    const animal = animalEntity(visual);

    species.update(animal, 0.1, runtime);

    expect(animal.state.activity).toBe('fleeing-player');
    expect(animal.velocity.x).toBeLessThan(0);
    expect(playAmbientSound).toHaveBeenCalledOnce();
    expect(visualAdapter.update).toHaveBeenCalledOnce();
  });

  it('removes distant animals through the central runtime', () => {
    const { species, player } = createHarness();
    player.position.set(100, 1, 100);
    const runtime = new RecordingMobRuntime();
    const visual: TestVisual = { root: new THREE.Group(), disposed: false };
    const animal = runtime.spawn(species, {
      position: new THREE.Vector3(),
      state: animalEntity(visual).state,
      visual,
    });

    species.update(animal, 0.1, runtime);

    expect(runtime.removed).toEqual([animal.id]);
  });

  it('provides hit feedback, loot, death particles, and visual disposal', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const {
      species,
      scene,
      spawnDrop,
      spawnBurst,
      playHitSound,
      playDeathSound,
    } = createHarness();
    const runtime = new RecordingMobRuntime();
    const visual: TestVisual = { root: new THREE.Group(), disposed: false };
    scene.add(visual.root);
    const animal = animalEntity(visual);

    species.onDamaged(animal, new THREE.Vector3(1, 0, 0), runtime);
    species.onDeath(animal, runtime);
    species.dispose(animal);

    expect(animal.velocity.x).toBe(3.4);
    expect(playHitSound).toHaveBeenCalledOnce();
    expect(playDeathSound).toHaveBeenCalledOnce();
    expect(spawnDrop).toHaveBeenCalledTimes(2);
    expect(spawnBurst).toHaveBeenCalledOnce();
    expect(visual.disposed).toBe(true);
    expect(scene.children).toHaveLength(0);
  });
});
