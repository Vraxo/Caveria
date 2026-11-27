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

describe('biome size persistence', () => {
  it('defaults older saves without biome metadata to Standard', () => {
    localStorage.setItem('caveria:world:v1:legacy', JSON.stringify({
      version: SAVE_VERSION,
      seed: 'legacy',
    }));

    expect(new WorldPersistence('legacy').load()?.biomeSize).toBe('standard');
  });

  it('restores valid metadata and rejects unknown presets', () => {
    localStorage.setItem('caveria:world:v1:large', JSON.stringify({
      version: SAVE_VERSION,
      seed: 'large',
      biomeSize: 'large',
    }));
    localStorage.setItem('caveria:world:v1:invalid', JSON.stringify({
      version: SAVE_VERSION,
      seed: 'invalid',
      biomeSize: 'enormous',
    }));

    expect(new WorldPersistence('large').load()?.biomeSize).toBe('large');
    expect(new WorldPersistence('invalid').load()?.biomeSize).toBe('standard');
  });
});
