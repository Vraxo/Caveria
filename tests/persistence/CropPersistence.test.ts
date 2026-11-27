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

describe('crop persistence sanitization', () => {
  it('resolves saved crop IDs and stage bounds through the definition registry', () => {
    localStorage.setItem('caveria:world:v1:test', JSON.stringify({
      version: SAVE_VERSION,
      seed: 'test',
      farms: [
        { x: 1, y: 2, z: 3, crop: 'berries', stage: 99, growthRemaining: 12 },
        { x: 4, y: 5, z: 6, crop: 'removed-crop', stage: 1, growthRemaining: 12 },
      ],
    }));

    const farms = new WorldPersistence('test').load()?.farms;

    expect(farms?.[0]).toMatchObject({ crop: 'berries', stage: 2, growthRemaining: 12 });
    expect(farms?.[1]).toMatchObject({ crop: null, stage: 0 });
  });
});
