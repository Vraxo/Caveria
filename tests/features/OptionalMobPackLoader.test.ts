import { describe, expect, it, vi } from 'vitest';
import { initializeMobPackIfEnabled } from '../../src/features/OptionalMobPackLoader';
import {
  DEFAULT_WORLD_FEATURE_PROFILE,
  setMobPackEnabled,
} from '../../src/features/WorldFeatureProfile';

describe('optional mob pack initialization', () => {
  it('skips pack construction and registration when the world profile disables it', async () => {
    const createPack = vi.fn(async () => ['camel', 'scorpion']);
    const register = vi.fn();
    const disabledProfile = setMobPackEnabled(
      DEFAULT_WORLD_FEATURE_PROFILE,
      'desert-wildlife',
      false
    );

    const initialized = await initializeMobPackIfEnabled(
      disabledProfile,
      'desert-wildlife',
      createPack,
      register
    );

    expect(initialized).toBe(false);
    expect(createPack).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });

  it('constructs the selected pack once and registers every species when enabled', async () => {
    const species = ['camel', 'scorpion', 'snake', 'lizard', 'vulture'];
    const createPack = vi.fn(async () => species);
    const register = vi.fn();

    const initialized = await initializeMobPackIfEnabled(
      DEFAULT_WORLD_FEATURE_PROFILE,
      'desert-wildlife',
      createPack,
      register
    );

    expect(initialized).toBe(true);
    expect(createPack).toHaveBeenCalledOnce();
    expect(register.mock.calls.map(([behavior]) => behavior)).toEqual(species);
  });
});
