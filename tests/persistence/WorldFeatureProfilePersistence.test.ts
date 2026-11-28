import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_WORLD_FEATURE_PROFILE,
  normalizeWorldFeatureProfile,
} from '../../src/features/WorldFeatureProfile';
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

describe('world feature profile persistence', () => {
  it('migrates existing saves without a profile to the default full profile', () => {
    localStorage.setItem('caveria:world:v1:legacy', JSON.stringify({
      version: SAVE_VERSION,
      seed: 'legacy',
    }));

    expect(new WorldPersistence('legacy').load()?.featureProfile)
      .toEqual(DEFAULT_WORLD_FEATURE_PROFILE);
  });

  it('restores a saved profile and lists it with the world summary', () => {
    const profile = normalizeWorldFeatureProfile({ version: 1, enabledMobPacks: [] });
    localStorage.setItem('caveria:world:v1:quiet', JSON.stringify({
      version: SAVE_VERSION,
      seed: 'quiet',
      featureProfile: profile,
    }));

    expect(new WorldPersistence('quiet').load()?.featureProfile).toEqual(profile);
    expect(WorldPersistence.listWorlds()[0].featureProfile).toEqual(profile);
  });

  it('normalizes unsupported stored profile versions instead of breaking world loading', () => {
    localStorage.setItem('caveria:world:v1:future', JSON.stringify({
      version: SAVE_VERSION,
      seed: 'future',
      featureProfile: { version: 999, enabledMobPacks: [] },
    }));

    expect(new WorldPersistence('future').load()?.featureProfile)
      .toEqual(DEFAULT_WORLD_FEATURE_PROFILE);
  });
});
