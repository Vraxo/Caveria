import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockId } from '../../src/content/BlockId';
import { createRabbitSpecies } from '../../src/entities/RabbitSpecies';
import { createStack, ItemId } from '../../src/items/Item';
import { Player } from '../../src/player/Player';
import { BreakParticles } from '../../src/rendering/BreakParticles';
import { DroppedItemManager } from '../../src/rendering/DroppedItems';
import { createFakeWorld } from '../fixtures/FakeWorld';
import { RecordingMobRuntime } from '../fixtures/RecordingMobRuntime';

afterEach(() => vi.restoreAllMocks());

describe('RabbitSpecies', () => {
  it('spawns Rabbits on desert sand through the arid biome profile', () => {
    const world = createFakeWorld({
      surfaceBiome: 'Desert Dunes',
      surfaceHeight: 0,
      getBlock: (_x, y) => y === 0 ? BlockId.Sand : BlockId.Air,
    });
    const player = {
      position: new THREE.Vector3(0, 1, 0),
      velocity: new THREE.Vector3(),
    } as unknown as Player;
    const species = createRabbitSpecies(
      new THREE.Scene(),
      world,
      player,
      { spawnDrop: vi.fn() } as unknown as DroppedItemManager,
      { spawnBurst: vi.fn() } as unknown as BreakParticles,
      {
        playRabbitSqueak: vi.fn(),
        playRabbitHit: vi.fn(),
        playRabbitDeath: vi.fn(),
      } as never
    );
    const runtime = new RecordingMobRuntime();
    vi.spyOn(Math, 'random').mockReturnValue(0);

    species.updateSpawning(3, runtime);

    expect(runtime.countSpecies('rabbit')).toBe(1);
    expect(species.interact(runtime.entities[0], createStack(ItemId.CaveBerries), false, runtime))
      .toBeNull();
    expect(species.interact(runtime.entities[0], createStack(ItemId.Cactus), false, runtime))
      .toMatchObject({ consumeHeld: true, swing: true });
  });

  it('does not spawn Rabbits in a temperate biome', () => {
    const world = createFakeWorld({
      surfaceBiome: 'Meadows',
      surfaceHeight: 0,
      getBlock: (_x, y) => y === 0 ? BlockId.Sand : BlockId.Air,
    });
    const player = {
      position: new THREE.Vector3(0, 1, 0),
      velocity: new THREE.Vector3(),
    } as unknown as Player;
    const species = createRabbitSpecies(
      new THREE.Scene(),
      world,
      player,
      {} as DroppedItemManager,
      {} as BreakParticles,
      {} as never
    );
    const runtime = new RecordingMobRuntime();
    vi.spyOn(Math, 'random').mockReturnValue(0);

    species.updateSpawning(3, runtime);

    expect(runtime.countSpecies('rabbit')).toBe(0);
  });
});
