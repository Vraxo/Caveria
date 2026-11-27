import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockId } from '../../src/content/BlockId';
import { MOB_DEFINITIONS } from '../../src/content/mobs/MobDefinitions';
import { createStack, ItemId } from '../../src/items/Item';
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

function createHarness(options: {
  playerY?: number;
  biome?: 'Meadows' | 'Desert Dunes';
  resource?: 'eggs' | 'wool';
} = {}) {
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
      resource: options.resource ?? 'eggs',
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
      growthRemaining: 0,
      feedingCooldown: 0,
      loveTimer: 0,
      breedingCooldown: 0,
      sheared: false,
      resourceTimer: 100,
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

  it('feeds two adults, creates a smaller baby, and grows it into an adult', () => {
    const { species } = createHarness();
    const runtime = new RecordingMobRuntime();
    const firstTemplate = animalEntity({ root: new THREE.Group(), disposed: false });
    const secondTemplate = animalEntity({ root: new THREE.Group(), disposed: false });
    const first = runtime.spawn(species, {
      position: new THREE.Vector3(0, 1, 0),
      state: { ...firstTemplate.state },
      visual: firstTemplate.visual,
    });
    const second = runtime.spawn(species, {
      position: new THREE.Vector3(2, 1, 0),
      state: { ...secondTemplate.state },
      visual: secondTemplate.visual,
    });

    expect(species.interact(first, createStack(ItemId.CaveBerries), false, runtime))
      .toMatchObject({ consumeHeld: true });
    expect(species.interact(second, createStack(ItemId.CaveBerries), false, runtime))
      .toMatchObject({ consumeHeld: true });

    expect(runtime.entities).toHaveLength(3);
    const baby = runtime.entities[2];
    const babyState = baby.state as SurfaceAnimalState;
    const babyVisual = baby.visual as TestVisual;
    expect(babyState.growthRemaining).toBeGreaterThan(0);
    expect(babyVisual.root.scale.x).toBe(0.55);
    expect(first.state.breedingCooldown).toBeGreaterThan(0);
    expect(second.state.breedingCooldown).toBeGreaterThan(0);
    expect(species.interact(
      baby as ReturnType<typeof animalEntity>,
      createStack(ItemId.CaveBerries),
      false,
      runtime
    )).toMatchObject({ consumeHeld: true });
    expect(species.interact(
      baby as ReturnType<typeof animalEntity>,
      createStack(ItemId.CaveBerries),
      false,
      runtime
    )).toBeNull();

    babyState.growthRemaining = 0.1;
    species.update(baby as ReturnType<typeof animalEntity>, 0.2, runtime);
    expect(babyState.growthRemaining).toBe(0);
    expect(babyVisual.root.scale.x).toBe(1);
  });

  it('shears adult wool animals and regrows their wool over time', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const { species, spawnDrop } = createHarness({ resource: 'wool' });
    const runtime = new RecordingMobRuntime();
    const animal = animalEntity({ root: new THREE.Group(), disposed: false });

    const result = species.interact(animal, createStack(ItemId.Shears), false, runtime);

    expect(result).toMatchObject({ damageHeld: true });
    expect(animal.state.sheared).toBe(true);
    expect(spawnDrop).toHaveBeenCalledWith(
      animal.position.x,
      animal.position.y + 0.4,
      animal.position.z,
      expect.objectContaining({ id: ItemId.Wool })
    );
    species.update(animal, 181, runtime);
    expect(animal.state.sheared).toBe(false);
  });

  it('lays eggs when an adult Chicken resource timer expires', () => {
    const { species, spawnDrop } = createHarness();
    const runtime = new RecordingMobRuntime();
    const animal = animalEntity({ root: new THREE.Group(), disposed: false });
    animal.state.resourceTimer = 0;

    species.update(animal, 0.1, runtime);

    expect(spawnDrop).toHaveBeenCalledWith(
      0,
      1.25,
      0,
      expect.objectContaining({ id: ItemId.Egg })
    );
    expect(animal.state.resourceTimer).toBeGreaterThan(0);
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
