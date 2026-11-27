import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CamelRidingController } from '../../src/DesertWildlife/CamelRidingController';
import { createDesertWildlife } from '../../src/DesertWildlife/createDesertWildlife';
import { BlockId } from '../../src/content/BlockId';
import { Input } from '../../src/core/Input';
import { MOB_DEFINITIONS } from '../../src/content/mobs/MobDefinitions';
import { MobSpeciesBehavior } from '../../src/entities/MobTypes';
import { createStack, ItemId } from '../../src/items/Item';
import { Player } from '../../src/player/Player';
import { PlayerVitals } from '../../src/player/PlayerVitals';
import { BreakParticles } from '../../src/rendering/BreakParticles';
import { DroppedItemManager } from '../../src/rendering/DroppedItems';
import { createFakeWorld } from '../fixtures/FakeWorld';
import { RecordingMobRuntime } from '../fixtures/RecordingMobRuntime';

function createHarness(biome: 'Desert Dunes' | 'Meadows' = 'Desert Dunes') {
  const world = createFakeWorld({
    surfaceBiome: biome,
    surfaceHeight: 0,
    getBlock: (_x, y) => y === 0 ? BlockId.Sand : BlockId.Air,
  });
  const player = new Player(
    new THREE.PerspectiveCamera(),
    new THREE.Vector3(0, 1, 0)
  );
  const camelRiding = new CamelRidingController(player, world);
  const damage = vi.fn(() => true);
  const vitals = {
    dead: false,
    knockbackMultiplier: 1,
    damage,
  } as unknown as PlayerVitals;
  const poisonPlayer = vi.fn();
  const openCamelStorage = vi.fn();
  const spawnDrop = vi.fn();
  const behaviors = createDesertWildlife({
    scene: new THREE.Scene(),
    world,
    player,
    vitals,
    drops: { spawnDrop } as unknown as DroppedItemManager,
    particles: { spawnBurst: vi.fn() } as unknown as BreakParticles,
    camelRiding,
    openCamelStorage,
    audio: {
      playCamelCall: vi.fn(),
      playScorpionChitter: vi.fn(),
      playSnakeHiss: vi.fn(),
      playLizardChirp: vi.fn(),
      playVultureCry: vi.fn(),
      playDesertWildlifeHit: vi.fn(),
      playDesertWildlifeDeath: vi.fn(),
    } as never,
    poisonPlayer,
  });
  return {
    behaviors, player, damage, poisonPlayer, camelRiding, openCamelStorage, spawnDrop,
  };
}

afterEach(() => vi.restoreAllMocks());

describe('desert wildlife', () => {
  it('registers all five species with the central mob behavior contract', () => {
    const { behaviors } = createHarness();

    expect(behaviors.map((behavior) => behavior.species)).toEqual([
      'camel', 'scorpion', 'snake', 'lizard', 'vulture',
    ]);
    for (const id of ['camel', 'scorpion', 'snake', 'lizard', 'vulture']) {
      expect(MOB_DEFINITIONS[id].tags).toContain('surface');
      expect(MOB_DEFINITIONS[id].tags).toContain('animal');
    }
  });

  it('spawns every species in an arid biome and none in Meadows', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const desert = createHarness().behaviors;
    const desertRuntime = new RecordingMobRuntime();
    for (const behavior of desert) behavior.updateSpawning?.(6, desertRuntime);

    expect(desertRuntime.entities.map((entity) => entity.species)).toEqual([
      'camel', 'scorpion', 'snake', 'lizard', 'vulture',
    ]);
    expect(desertRuntime.entities.find((entity) => entity.species === 'vulture')!.position.y)
      .toBeGreaterThan(3);

    const meadow = createHarness('Meadows').behaviors;
    const meadowRuntime = new RecordingMobRuntime();
    for (const behavior of meadow) behavior.updateSpawning?.(6, meadowRuntime);
    expect(meadowRuntime.entities).toHaveLength(0);
  });

  it('lets Camels and Lizards consume Cactus through shared husbandry', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { behaviors } = createHarness();
    const runtime = new RecordingMobRuntime();
    for (const behavior of behaviors) behavior.updateSpawning?.(6, runtime);

    for (const species of ['camel', 'lizard']) {
      const behavior = behaviors.find((candidate) => candidate.species === species)!;
      const entity = runtime.entities.find((candidate) => candidate.species === species)!;
      expect(behavior.interact?.(entity, createStack(ItemId.Cactus), false, runtime))
        .toMatchObject({ consumeHeld: true, swing: true });
    }
  });

  it('mounts adult Camels with an empty hand and transfers movement control', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { behaviors, player, camelRiding } = createHarness();
    const runtime = new RecordingMobRuntime();
    for (const behavior of behaviors) behavior.updateSpawning?.(6, runtime);
    const camelBehavior = behaviors.find((behavior) => behavior.species === 'camel')!;
    const camel = runtime.entities.find((entity) => entity.species === 'camel')!;

    expect(camelBehavior.interact?.(camel, null, false, runtime))
      .toMatchObject({ swing: true });
    expect(camelRiding.mountedEntityId).toBe(camel.id);

    camel.onGround = true;
    const ridingInput = {
      isKeyDown: (code: string) => code === 'KeyW',
      consumeKeyPress: () => false,
    } as unknown as Input;
    const startZ = camel.position.z;
    camelRiding.update(0.1, ridingInput);
    camelBehavior.update(camel, 0.1, runtime);

    expect(camel.position.z).toBeLessThan(startZ);
    expect(player.position.x).toBe(camel.position.x);
    expect(player.position.z).toBe(camel.position.z);
    expect(player.position.y).toBeCloseTo(camel.position.y + 1.62);

    const dismountInput = {
      isKeyDown: () => false,
      consumeKeyPress: (code: string) => code === 'ShiftLeft',
    } as unknown as Input;
    expect(camelRiding.update(0.1, dismountInput)).toBe(false);
    expect(camelRiding.isRiding).toBe(false);
  });

  it('opens persistent Camel storage while sneaking and drops its contents on death', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const {
      behaviors, player, openCamelStorage, spawnDrop,
    } = createHarness();
    const runtime = new RecordingMobRuntime();
    for (const behavior of behaviors) behavior.updateSpawning?.(6, runtime);
    const camelBehavior = behaviors.find((behavior) => behavior.species === 'camel')!;
    const camel = runtime.entities.find((entity) => entity.species === 'camel')!;

    expect(camel.state.storage).toHaveLength(18);
    expect(camelBehavior.interact?.(camel, null, false, runtime, true))
      .toMatchObject({ swing: true });
    expect(openCamelStorage).toHaveBeenCalledWith(camel);
    expect(camel.state.persistent).toBe(true);

    camel.state.storage[0] = createStack(ItemId.Cactus, 3);
    player.position.set(200, 1, 200);
    camelBehavior.update(camel, 0.1, runtime);
    expect(runtime.entities).toContain(camel);

    camelBehavior.onDeath(camel, runtime);
    expect(spawnDrop).toHaveBeenCalledWith(
      camel.position.x,
      camel.position.y + 0.8,
      camel.position.z,
      createStack(ItemId.Cactus, 3)
    );
    expect(camel.state.storage.every((slot: unknown) => slot === null)).toBe(true);
  });

  it('round-trips every species through the shared persistence contract', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { behaviors } = createHarness();
    const runtime = new RecordingMobRuntime();
    for (const behavior of behaviors) behavior.updateSpawning?.(6, runtime);
    const camel = runtime.entities.find((entity) => entity.species === 'camel')!;
    camel.state.storage[0] = createStack(ItemId.Cactus, 2);
    camel.state.persistent = true;
    const restored = new RecordingMobRuntime();

    for (const behavior of behaviors) {
      const entity = runtime.entities.find((candidate) => candidate.species === behavior.species)!;
      behavior.restore?.({
        id: entity.id,
        species: entity.species,
        position: entity.position.toArray(),
        velocity: entity.velocity.toArray(),
        health: entity.health,
        age: entity.age,
        hurtTimer: entity.hurtTimer,
        state: behavior.saveState?.(entity),
      }, restored);
    }

    expect(restored.entities.map((entity) => entity.species)).toEqual([
      'camel', 'scorpion', 'snake', 'lizard', 'vulture',
    ]);
    const restoredCamel = restored.entities.find((entity) => entity.species === 'camel')!;
    expect(restoredCamel.state.storage[0]).toEqual(createStack(ItemId.Cactus, 2));
    expect(restoredCamel.state.persistent).toBe(true);
  });

  it('gives Scorpion and Snake attacks damage and venom', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { behaviors, player, damage, poisonPlayer } = createHarness();
    const runtime = new RecordingMobRuntime();
    for (const behavior of behaviors) behavior.updateSpawning?.(6, runtime);

    for (const species of ['scorpion', 'snake']) {
      const behavior = behaviors.find((candidate) => candidate.species === species) as
        unknown as MobSpeciesBehavior<any, any>;
      const entity = runtime.entities.find((candidate) => candidate.species === species)!;
      entity.position.set(0.5, 1, 0);
      player.velocity.set(0, 0, 0);
      behavior.update(entity, 0.1, runtime);
    }

    expect(damage).toHaveBeenCalledTimes(2);
    expect(poisonPlayer).toHaveBeenCalledTimes(2);
  });
});
