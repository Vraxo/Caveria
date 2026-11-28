import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockId } from '../../src/content/BlockId';
import { rollMobLoot } from '../../src/content/loot/MobLoot';
import { MOB_DEFINITIONS, POLAR_BEAR_ID } from '../../src/content/mobs/MobDefinitions';
import { PolarBearEntity, PolarBearSpecies } from '../../src/entities/PolarBearSpecies';
import { createStack, ItemId } from '../../src/items/Item';
import { Player } from '../../src/player/Player';
import { PlayerVitals } from '../../src/player/PlayerVitals';
import { BreakParticles } from '../../src/rendering/BreakParticles';
import { DroppedItemManager } from '../../src/rendering/DroppedItems';
import { createFakeWorld } from '../fixtures/FakeWorld';
import { RecordingMobRuntime } from '../fixtures/RecordingMobRuntime';

afterEach(() => vi.restoreAllMocks());

function createSpeciesFixture(surfaceBiome: 'Snowy Taiga' | 'Alpine Peaks' | 'Desert Dunes' | 'Meadows') {
  const ground = surfaceBiome === 'Desert Dunes' ? BlockId.Sand : BlockId.SnowGrass;
  const world = createFakeWorld({
    surfaceBiome,
    surfaceHeight: 0,
    getBlock: (_x, y) => (y === 0 ? ground : BlockId.Air),
  });
  const player = {
    position: new THREE.Vector3(0, 1, 0),
    velocity: new THREE.Vector3(),
  } as unknown as Player;
  const vitals = {
    dead: false,
    damage: vi.fn().mockReturnValue(true),
  } as unknown as PlayerVitals;
  const drops = { spawnDrop: vi.fn() } as unknown as DroppedItemManager;
  const particles = { spawnBurst: vi.fn() } as unknown as BreakParticles;
  const audio = {
    playPolarBearGrowl: vi.fn(),
    playPolarBearRoar: vi.fn(),
    playPolarBearHit: vi.fn(),
    playPolarBearDeath: vi.fn(),
  };
  const species = new PolarBearSpecies(
    new THREE.Scene(),
    world,
    player,
    vitals,
    drops,
    particles,
    audio as never
  );
  return { species, world, player, vitals, drops, particles, audio };
}

describe('PolarBearSpecies', () => {
  it('spawns Polar Bears and cubs in cold biomes, not in deserts or meadows', () => {
    const snowy = createSpeciesFixture('Snowy Taiga');
    const snowyRuntime = new RecordingMobRuntime();
    vi.spyOn(Math, 'random').mockReturnValue(0);

    snowy.species.updateSpawning(4, snowyRuntime);
    // Math.random() === 0 triggers both adult spawn and cub companion spawn
    expect(snowyRuntime.countSpecies(POLAR_BEAR_ID)).toBe(2);
    const bears = snowyRuntime.entities as PolarBearEntity[];
    expect(bears[0].state.growthRemaining).toBe(0);
    expect(bears[1].state.growthRemaining).toBeGreaterThan(0);

    for (const warmBiome of ['Desert Dunes', 'Meadows'] as const) {
      const warm = createSpeciesFixture(warmBiome);
      const warmRuntime = new RecordingMobRuntime();
      warm.species.updateSpawning(4, warmRuntime);
      expect(warmRuntime.countSpecies(POLAR_BEAR_ID)).toBe(0);
    }
  });

  it('stays neutral until provoked or protecting a cub, and calms with Raw River Fish', () => {
    const { species, player, vitals } = createSpeciesFixture('Snowy Taiga');
    const runtime = new RecordingMobRuntime();
    vi.spyOn(Math, 'random').mockReturnValue(0.9); // adult only

    species.updateSpawning(4, runtime);
    const adult = runtime.entities[0] as PolarBearEntity;
    adult.position.set(1.5, 1, 0);

    // Unprovoked adult does not attack even at close range.
    species.update(adult, 0.1, runtime);
    expect(vitals.damage).not.toHaveBeenCalled();

    // Attacking provokes the adult into retaliating.
    species.onDamaged(adult, new THREE.Vector3(1, 0, 0), runtime);
    adult.position.set(1.5, 1, 0);
    species.update(adult, 0.1, runtime);
    expect(vitals.damage).toHaveBeenCalledWith(5, 'mob');

    // Feeding Raw River Fish calms the provoked bear and heals it.
    adult.health = 16;
    const interaction = species.interact(adult, createStack(ItemId.RawRiverFish), false);
    expect(interaction).toEqual({ consumeHeld: true, swing: true });
    expect(adult.state.angerTimer).toBe(0);
    expect(adult.health).toBe(20);

    // Standing near a cub makes a nearby adult protective and aggressive.
    species.restore({
      id: 99,
      species: POLAR_BEAR_ID,
      position: [1.2, 1, 0],
      velocity: [0, 0, 0],
      health: 24,
      age: 0,
      hurtTimer: 0,
      state: { facingAngle: 0, angerTimer: 0, growthRemaining: 200 },
    }, runtime);
    adult.state.attackTimer = 0;
    player.position.set(0, 1, 0);
    species.update(adult, 0.1, runtime);
    expect(adult.state.angerTimer).toBeGreaterThan(0);
    expect(vitals.damage).toHaveBeenCalledTimes(2);
  });

  it('registers neutral definition, fish loot, and persists cub/adult state', () => {
    expect(MOB_DEFINITIONS[POLAR_BEAR_ID].tags).toEqual(
      expect.arrayContaining(['neutral', 'animal', 'surface'])
    );
    const loot = rollMobLoot('polar-bear', () => 0.9);
    expect(loot).toEqual([createStack(ItemId.RawRiverFish, 1)]);

    const { species } = createSpeciesFixture('Alpine Peaks');
    const runtime = new RecordingMobRuntime();
    species.restore({
      id: 7,
      species: POLAR_BEAR_ID,
      position: [4, 1, 4],
      velocity: [0, 0, 0],
      health: 18,
      age: 12,
      hurtTimer: 0,
      state: { facingAngle: 1.5, angerTimer: 5, growthRemaining: 120, persistent: true },
    }, runtime);

    const restored = runtime.entities[0] as PolarBearEntity;
    expect(species.saveState(restored)).toEqual({
      facingAngle: 1.5,
      angerTimer: 5,
      growthRemaining: 120,
      persistent: true,
    });
  });
});
