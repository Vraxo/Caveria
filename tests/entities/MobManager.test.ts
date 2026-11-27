import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { MobManager } from '../../src/entities/MobManager';
import { MobEntity, MobSpeciesBehavior, MobTag } from '../../src/entities/MobTypes';

interface TestState {
  updates: number;
}

interface TestVisual {
  disposed: boolean;
}

type TestEntity = MobEntity<TestState, TestVisual>;

function createSpecies(species: string, tags: MobTag[] = []) {
  const updateOrder: number[] = [];
  const behavior: MobSpeciesBehavior<TestState, TestVisual> = {
    species,
    name: species,
    tags: new Set(tags),
    maxHealth: 5,
    radius: 0.3,
    height: 0.6,
    hurtInvulnerabilitySeconds: 0.2,
    update: vi.fn((entity: TestEntity) => {
      entity.state.updates++;
      updateOrder.push(entity.id);
    }),
    interact: vi.fn(() => ({ swing: true })),
    saveState: (entity) => ({ ...entity.state }),
    restore: vi.fn((snapshot, runtime) => {
      runtime.spawn(behavior, {
        id: snapshot.id,
        position: new THREE.Vector3(...snapshot.position),
        velocity: new THREE.Vector3(...snapshot.velocity),
        health: snapshot.health,
        age: snapshot.age,
        hurtTimer: snapshot.hurtTimer,
        state: snapshot.state as TestState,
        visual: { disposed: false },
      });
    }),
    onDamaged: vi.fn(),
    onDeath: vi.fn(),
    dispose: vi.fn((entity: TestEntity) => {
      entity.visual.disposed = true;
    }),
  };
  return { behavior, updateOrder };
}

function spawn(manager: MobManager, species: MobSpeciesBehavior<TestState, TestVisual>, z = 0) {
  return manager.spawn(species, {
    position: new THREE.Vector3(0, 0, z),
    state: { updates: 0 },
    visual: { disposed: false },
  });
}

describe('MobManager', () => {
  it('owns globally unique instances and answers semantic queries', () => {
    const hostile = createSpecies('hostile-test', ['hostile']);
    const passive = createSpecies('passive-test', ['passive', 'animal']);
    const manager = new MobManager([hostile.behavior, passive.behavior]);

    const first = spawn(manager, hostile.behavior);
    const second = spawn(manager, passive.behavior, 4);

    expect(first.id).toBe(1);
    expect(second.id).toBe(2);
    expect(manager.count).toBe(2);
    expect(manager.countSpecies('hostile-test')).toBe(1);
    expect(manager.countTagged('animal')).toBe(1);
    expect(manager.hasWithin(new THREE.Vector3(), 1, 'hostile')).toBe(true);
    expect(manager.hasWithin(new THREE.Vector3(), 1, 'passive')).toBe(false);
    expect(manager.hasSpeciesWithinHorizontal('passive-test', second.position, 0.5)).toBe(true);
  });

  it('rejects duplicate registration and spawning through an unregistered behavior', () => {
    const registered = createSpecies('test');
    const duplicate = createSpecies('test');
    const unregistered = createSpecies('other');
    const manager = new MobManager([registered.behavior]);

    expect(() => manager.register(duplicate.behavior)).toThrow('Duplicate mob species behavior');
    expect(() => spawn(manager, unregistered.behavior)).toThrow('Cannot spawn unregistered mob species');
  });

  it('updates in registration order and reverse entity order within each species', () => {
    const alpha = createSpecies('alpha');
    const beta = createSpecies('beta');
    const manager = new MobManager([alpha.behavior, beta.behavior]);
    const alphaFirst = spawn(manager, alpha.behavior);
    const betaOnly = spawn(manager, beta.behavior);
    const alphaSecond = spawn(manager, alpha.behavior);

    manager.update(0.1);

    expect(alpha.updateOrder).toEqual([alphaSecond.id, alphaFirst.id]);
    expect(beta.updateOrder).toEqual([betaOnly.id]);
    expect(alphaFirst.age).toBeCloseTo(0.1);
  });

  it('raycasts the nearest body before terrain', () => {
    const species = createSpecies('target');
    const manager = new MobManager([species.behavior]);
    const nearest = spawn(manager, species.behavior);
    spawn(manager, species.behavior, 3);

    const hit = manager.raycast(
      new THREE.Vector3(0, 0.3, -3),
      new THREE.Vector3(0, 0, 1),
      10,
      10
    );
    const blocked = manager.raycast(
      new THREE.Vector3(0, 0.3, -3),
      new THREE.Vector3(0, 0, 1),
      10,
      2
    );

    expect(hit?.entityId).toBe(nearest.id);
    expect(hit?.species).toBe('target');
    expect(blocked).toBeNull();
  });

  it('snapshots and restores instances while preserving global IDs', () => {
    const species = createSpecies('persistent');
    const original = new MobManager([species.behavior]);
    const entity = spawn(original, species.behavior);
    entity.health = 3;
    entity.state.updates = 7;

    const snapshots = original.snapshots();
    const restored = new MobManager([species.behavior]);
    restored.restore(snapshots);
    const next = spawn(restored, species.behavior, 2);

    expect(restored.count).toBe(2);
    expect(snapshots[0]).toMatchObject({ id: entity.id, health: 3 });
    expect(next.id).toBe(entity.id + 1);
  });

  it('routes right-click interaction through the targeted species', () => {
    const species = createSpecies('interactive');
    const manager = new MobManager([species.behavior]);
    const entity = spawn(manager, species.behavior);
    const hit = {
      species: species.behavior.species,
      entityId: entity.id,
      id: entity.id,
      name: species.behavior.name,
      distance: 1,
      health: entity.health,
      maxHealth: species.behavior.maxHealth,
    };

    expect(manager.interact(hit, null, false)).toEqual({ swing: true });
    expect(species.behavior.interact).toHaveBeenCalledOnce();
  });

  it('centralizes hurt gating, death callbacks, removal, and disposal', () => {
    const species = createSpecies('target');
    const manager = new MobManager([species.behavior]);
    const entity = spawn(manager, species.behavior);
    const hit = {
      species: species.behavior.species,
      entityId: entity.id,
      id: entity.id,
      name: species.behavior.name,
      distance: 1,
      health: entity.health,
      maxHealth: species.behavior.maxHealth,
    };

    expect(manager.damage(hit, 3, new THREE.Vector3(1, 0, 0))).toBe(true);
    expect(entity.health).toBe(2);
    expect(entity.hurtTimer).toBe(0.2);
    expect(species.behavior.onDamaged).toHaveBeenCalledOnce();
    expect(manager.damage(hit, 3, new THREE.Vector3())).toBe(false);

    entity.hurtTimer = 0;
    expect(manager.damage(hit, 3, new THREE.Vector3())).toBe(true);
    expect(species.behavior.onDeath).toHaveBeenCalledOnce();
    expect(species.behavior.dispose).toHaveBeenCalledOnce();
    expect(entity.visual.disposed).toBe(true);
    expect(manager.count).toBe(0);
  });
});
