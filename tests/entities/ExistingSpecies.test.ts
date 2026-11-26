import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockId } from '../../src/content/BlockId';
import { CaveCrawlerSpecies } from '../../src/entities/CaveCrawlerSpecies';
import { createCaveCrawlerVisual } from '../../src/entities/CaveCrawlerVisual';
import { CrystalMiteSpecies } from '../../src/entities/CrystalMiteSpecies';
import { createCrystalMiteVisual } from '../../src/entities/CrystalMiteVisual';
import { MobEntity } from '../../src/entities/MobTypes';
import { Player } from '../../src/player/Player';
import { PlayerVitals } from '../../src/player/PlayerVitals';
import { BreakParticles } from '../../src/rendering/BreakParticles';
import { DroppedItemManager } from '../../src/rendering/DroppedItems';
import { createFakeWorld } from '../fixtures/FakeWorld';
import { RecordingMobRuntime } from '../fixtures/RecordingMobRuntime';

const drops = { spawnDrop: vi.fn() } as unknown as DroppedItemManager;
const particles = { spawnBurst: vi.fn() } as unknown as BreakParticles;

afterEach(() => vi.restoreAllMocks());

describe('CrystalMiteSpecies', () => {
  it('flees a nearby player', () => {
    const player = {
      position: new THREE.Vector3(1, 0, 0),
      velocity: new THREE.Vector3(),
    } as unknown as Player;
    const species = new CrystalMiteSpecies(
      new THREE.Scene(),
      createFakeWorld(),
      player,
      drops,
      particles,
      {
        playCrystalMiteChirp: vi.fn(),
        playCrystalMiteHit: vi.fn(),
        playCrystalMiteDeath: vi.fn(),
      } as never
    );
    const entity = {
      id: 1,
      species: 'crystal-mite',
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      onGround: false,
      health: 4,
      age: 0,
      hurtTimer: 0,
      state: {
        activity: 'idle',
        activityTimer: 1,
        facingAngle: 0,
        targetCrystal: null,
        chirpTimer: 1,
      },
      visual: createCrystalMiteVisual(),
    } as MobEntity<any, ReturnType<typeof createCrystalMiteVisual>>;

    species.update(entity, 0.1, new RecordingMobRuntime());

    expect(entity.state.activity).toBe('fleeing-player');
    expect(entity.velocity.x).toBeLessThan(0);
  });

  it('chooses a nearby crystal for inspection', () => {
    const world = createFakeWorld({
      getBlock: (x, y, z) => {
        if (x === 2 && y === 0 && z === 0) return BlockId.AmethystCrystal;
        return y < 0 ? BlockId.Stone : BlockId.Air;
      },
    });
    const player = {
      position: new THREE.Vector3(20, 0, 20),
      velocity: new THREE.Vector3(),
    } as unknown as Player;
    const species = new CrystalMiteSpecies(
      new THREE.Scene(),
      world,
      player,
      drops,
      particles,
      {
        playCrystalMiteChirp: vi.fn(),
        playCrystalMiteHit: vi.fn(),
        playCrystalMiteDeath: vi.fn(),
      } as never
    );
    const entity = {
      id: 1,
      species: 'crystal-mite',
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      onGround: false,
      health: 4,
      age: 0,
      hurtTimer: 0,
      state: {
        activity: 'idle',
        activityTimer: 0,
        facingAngle: 0,
        targetCrystal: null,
        chirpTimer: 1,
      },
      visual: createCrystalMiteVisual(),
    } as MobEntity<any, ReturnType<typeof createCrystalMiteVisual>>;
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.2)
      .mockReturnValueOnce(0.3);

    species.update(entity, 0.1, new RecordingMobRuntime());

    expect(entity.state.activity).toBe('inspecting-crystal');
    expect(entity.state.targetCrystal?.x).toBe(2.5);
  });
});

describe('CaveCrawlerSpecies', () => {
  it('pursues, damages, poisons, and knocks back a visible player', () => {
    const player = {
      position: new THREE.Vector3(1, 0, 0),
      velocity: new THREE.Vector3(),
      getEyePosition: () => new THREE.Vector3(1, 1.6, 0),
    } as unknown as Player;
    const damage = vi.fn(() => true);
    const vitals = {
      dead: false,
      knockbackMultiplier: 1,
      damage,
    } as unknown as PlayerVitals;
    const poison = vi.fn();
    const species = new CaveCrawlerSpecies(
      new THREE.Scene(),
      createFakeWorld(),
      player,
      vitals,
      drops,
      particles,
      {
        playCaveCrawlerGrowl: vi.fn(),
        playCaveCrawlerHit: vi.fn(),
        playCaveCrawlerDeath: vi.fn(),
      } as never,
      poison
    );
    const entity = {
      id: 1,
      species: 'cave-crawler',
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      onGround: false,
      health: 10,
      age: 0,
      hurtTimer: 0,
      state: {
        activity: 'wandering',
        facingAngle: 0,
        decisionTimer: 1,
        attackTimer: 0,
        growlTimer: 1,
      },
      visual: createCaveCrawlerVisual(),
    } as MobEntity<any, ReturnType<typeof createCaveCrawlerVisual>>;
    vi.spyOn(Math, 'random').mockReturnValue(0.1);

    species.update(entity, 0.1, new RecordingMobRuntime());

    expect(entity.state.activity).toBe('pursuing-player');
    expect(damage).toHaveBeenCalledWith(3, 'mob');
    expect(poison).toHaveBeenCalledOnce();
    expect(player.velocity.x).toBeGreaterThan(0);
  });

  it('wanders instead of pursuing a dead player', () => {
    const player = {
      position: new THREE.Vector3(1, 0, 0),
      velocity: new THREE.Vector3(),
      getEyePosition: () => new THREE.Vector3(1, 1.6, 0),
    } as unknown as Player;
    const species = new CaveCrawlerSpecies(
      new THREE.Scene(),
      createFakeWorld(),
      player,
      { dead: true } as PlayerVitals,
      drops,
      particles,
      {
        playCaveCrawlerGrowl: vi.fn(),
        playCaveCrawlerHit: vi.fn(),
        playCaveCrawlerDeath: vi.fn(),
      } as never
    );
    const entity = {
      id: 1,
      species: 'cave-crawler',
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      onGround: false,
      health: 10,
      age: 0,
      hurtTimer: 0,
      state: {
        activity: 'pursuing-player',
        facingAngle: 0,
        decisionTimer: 1,
        attackTimer: 0,
        growlTimer: 1,
      },
      visual: createCaveCrawlerVisual(),
    } as MobEntity<any, ReturnType<typeof createCaveCrawlerVisual>>;

    species.update(entity, 0.1, new RecordingMobRuntime());

    expect(entity.state.activity).toBe('wandering');
  });
});
