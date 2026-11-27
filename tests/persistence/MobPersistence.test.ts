import { beforeEach, describe, expect, it } from 'vitest';
import { SAVE_VERSION, WorldPersistence } from '../../src/persistence/WorldPersistence';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  public get length(): number { return this.values.size; }
  public clear(): void { this.values.clear(); }
  public getItem(key: string): string | null { return this.values.get(key) ?? null; }
  public key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  public removeItem(key: string): void { this.values.delete(key); }
  public setItem(key: string, value: string): void { this.values.set(key, value); }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
  });
});

describe('mob persistence sanitization', () => {
  it('restores valid mob snapshots and ignores unknown species', () => {
    localStorage.setItem('caveria:world:v1:test', JSON.stringify({
      version: SAVE_VERSION,
      seed: 'test',
      mobs: [
        {
          id: 7,
          species: 'sheep',
          position: [3, 5, 8],
          velocity: [1, -2, 0],
          health: 999,
          age: 40,
          hurtTimer: 0.2,
          state: { sheared: true, growthRemaining: 12 },
        },
        {
          id: 8,
          species: 'missing-species',
          position: [0, 0, 0],
          velocity: [0, 0, 0],
          health: 1,
          state: {},
        },
      ],
    }));

    const save = new WorldPersistence('test').load();

    expect(save?.mobs).toHaveLength(1);
    expect(save?.mobs[0]).toMatchObject({
      id: 7,
      species: 'sheep',
      position: [3, 5, 8],
      health: 8,
      state: { sheared: true, growthRemaining: 12 },
    });
  });

  it('defaults missing mob data for older saves to an empty collection', () => {
    localStorage.setItem('caveria:world:v1:test', JSON.stringify({
      version: SAVE_VERSION,
      seed: 'test',
    }));

    expect(new WorldPersistence('test').load()?.mobs).toEqual([]);
  });
});
