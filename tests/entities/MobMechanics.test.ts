import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockId } from '../../src/content/BlockId';
import {
  findGroundMobSpawn,
  moveGroundMob,
  raycastMobs,
} from '../../src/entities/MobMechanics';
import { createFakeWorld } from '../fixtures/FakeWorld';

afterEach(() => vi.restoreAllMocks());

describe('moveGroundMob', () => {
  it('applies acceleration and lands on a solid floor', () => {
    const world = createFakeWorld();
    const body = {
      position: new THREE.Vector3(0, 0.05, 0),
      velocity: new THREE.Vector3(),
      onGround: false,
    };

    const result = moveGroundMob(
      body,
      { directionX: 1, directionZ: 0, speed: 2 },
      { radius: 0.3, height: 0.6 },
      world,
      0.1,
      { response: 5 }
    );

    expect(result.collidedHorizontally).toBe(false);
    expect(body.onGround).toBe(true);
    expect(body.position.y).toBe(0);
    expect(body.velocity.x).toBeCloseTo(1);
  });

  it('reports body collision without deciding the species reaction', () => {
    const world = createFakeWorld({
      getBlock: (x, y) => y < 0 || x >= 0.6 ? BlockId.Stone : BlockId.Air,
    });
    const body = {
      position: new THREE.Vector3(0, 0, 0),
      velocity: new THREE.Vector3(),
      onGround: true,
    };

    const result = moveGroundMob(
      body,
      { directionX: 1, directionZ: 0, speed: 2 },
      { radius: 0.3, height: 0.6 },
      world,
      0.3,
      { response: 5 }
    );

    expect(result.collidedHorizontally).toBe(true);
    expect(body.position.x).toBe(0);
  });

  it('caps falling speed at terminal velocity', () => {
    const world = createFakeWorld({ getBlock: () => BlockId.Air });
    const body = {
      position: new THREE.Vector3(0, 100, 0),
      velocity: new THREE.Vector3(0, -17, 0),
      onGround: false,
    };

    moveGroundMob(
      body,
      { directionX: 0, directionZ: 0, speed: 0 },
      { radius: 0.3, height: 0.6 },
      world,
      1,
      { response: 5 }
    );

    expect(body.velocity.y).toBe(-18);
  });
});

describe('raycastMobs', () => {
  it('returns the nearest body and respects terrain distance', () => {
    const mobs = [
      { id: 1, position: new THREE.Vector3(0, 0, 0), health: 4 },
      { id: 2, position: new THREE.Vector3(0, 0, 3), health: 4 },
    ];
    const baseOptions = {
      species: 'test',
      name: 'Test',
      maxHealth: 4,
      shape: { radius: 0.3, height: 0.6 },
      origin: new THREE.Vector3(0, 0.3, -3),
      direction: new THREE.Vector3(0, 0, 1),
      maxDistance: 10,
    };

    expect(raycastMobs(mobs, { ...baseOptions, blockDistance: 10 })?.id).toBe(1);
    expect(raycastMobs(mobs, { ...baseOptions, blockDistance: 2 })).toBeNull();
  });
});

describe('findGroundMobSpawn', () => {
  it('finds open ground and applies environmental predicates', () => {
    const world = createFakeWorld();
    const acceptsColumn = vi.fn(() => true);
    const acceptsCandidate = vi.fn(() => true);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const position = findGroundMobSpawn(world, new THREE.Vector3(), {
      attempts: 1,
      minimumRadius: 5,
      radiusVariance: 0,
      scanAbove: 1,
      scanBelow: 1,
      acceptsColumn,
      acceptsCandidate,
    });

    expect(position?.toArray()).toEqual([5.5, 0, 0.5]);
    expect(acceptsColumn).toHaveBeenCalledWith(5, 0);
    expect(acceptsCandidate).toHaveBeenCalled();
  });

  it('returns null when a column predicate rejects every attempt', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const position = findGroundMobSpawn(createFakeWorld(), new THREE.Vector3(), {
      attempts: 2,
      minimumRadius: 5,
      radiusVariance: 0,
      scanAbove: 1,
      scanBelow: 1,
      acceptsColumn: () => false,
    });

    expect(position).toBeNull();
  });
});
