import { describe, expect, it, vi } from 'vitest';
import { GameFeatureRegistry } from '../../src/core/GameFeatureRegistry';

interface TestSnapshot {
  core: number;
  alpha: string;
  beta: boolean;
}

describe('GameFeatureRegistry', () => {
  it('updates participants in registration order within explicit phases', () => {
    const order: string[] = [];
    const first = vi.fn((dt: number) => order.push(`first:${dt}`));
    const second = vi.fn((dt: number) => order.push(`second:${dt}`));
    const registry = new GameFeatureRegistry<TestSnapshot>()
      .register({ id: 'first', updates: { 'frame-start': first } })
      .register({ id: 'second', updates: { 'frame-start': second } })
      .register({ id: 'other-phase', updates: { 'frame-end': () => order.push('end') } });

    registry.update('frame-start', 0.25);

    expect(order).toEqual(['first:0.25', 'second:0.25']);
    expect(first).toHaveBeenCalledWith(0.25);
    expect(second).toHaveBeenCalledWith(0.25);
  });

  it('combines core state with feature-owned persistence fragments', () => {
    const registry = new GameFeatureRegistry<TestSnapshot>()
      .register({ id: 'alpha', snapshot: () => ({ alpha: 'saved' }) })
      .register({ id: 'beta', snapshot: () => ({ beta: true }) });

    expect(registry.capture({ core: 7 })).toEqual({
      core: 7,
      alpha: 'saved',
      beta: true,
    });
  });

  it('rejects incomplete snapshots when required schema keys are declared', () => {
    const registry = new GameFeatureRegistry<TestSnapshot>(['core', 'alpha', 'beta'])
      .register({ id: 'alpha', snapshot: () => ({ alpha: 'saved' }) });

    expect(() => registry.capture({ core: 1 }))
      .toThrow('missing required property "beta"');
  });

  it('rejects duplicate participants and ambiguous save-property ownership', () => {
    const registry = new GameFeatureRegistry<TestSnapshot>()
      .register({ id: 'alpha', snapshot: () => ({ alpha: 'one' }) });

    expect(() => registry.register({ id: 'alpha' }))
      .toThrow('Duplicate game feature participant');
    expect(() => registry.capture({ core: 1, alpha: 'core' }))
      .toThrow('owned by both core and alpha');

    const conflicting = new GameFeatureRegistry<TestSnapshot>()
      .register({ id: 'first', snapshot: () => ({ beta: true }) })
      .register({ id: 'second', snapshot: () => ({ beta: false }) });
    expect(() => conflicting.capture({ core: 1 }))
      .toThrow('owned by both first and second');
  });
});
