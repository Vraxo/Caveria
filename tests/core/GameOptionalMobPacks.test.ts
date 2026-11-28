import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../../src/core/Game';
import {
  DEFAULT_WORLD_FEATURE_PROFILE,
  setMobPackEnabled,
} from '../../src/features/WorldFeatureProfile';

const packMocks = vi.hoisted(() => ({
  camelConstructions: vi.fn(),
  createWildlife: vi.fn(),
  behaviors: [{ species: 'camel' }, { species: 'vulture' }],
}));

vi.mock('../../src/DesertWildlife/CamelRidingController', () => ({
  CamelRidingController: class {
    public constructor(...args: unknown[]) {
      packMocks.camelConstructions(...args);
    }
  },
}));

vi.mock('../../src/DesertWildlife/createDesertWildlife', () => ({
  createDesertWildlife: (...args: unknown[]) => {
    packMocks.createWildlife(...args);
    return packMocks.behaviors;
  },
}));

function createUninitializedGame(profile: typeof DEFAULT_WORLD_FEATURE_PROFILE) {
  const mobs = {
    register: vi.fn(),
    restore: vi.fn(),
  };
  const game = Object.assign(Object.create(Game.prototype) as Record<string, unknown>, {
    featureProfile: profile,
    optionalMobPacksInitialized: false,
    savedMobSnapshots: [{ id: 7, species: 'camel' }],
    mobs,
    player: {},
    world: {},
    scene: {},
    vitals: {},
    drops: {},
    particles: {},
    audio: {},
    dayNight: { isNight: true },
    statusEffects: { poison: vi.fn() },
    openCamelStorage: vi.fn(),
  });
  return { game, mobs };
}

async function initializeOptionalMobPacks(game: object): Promise<void> {
  const initialize = Object.getOwnPropertyDescriptor(
    Game.prototype,
    'initializeOptionalMobPacks'
  )!.value as (this: object) => Promise<void>;
  await initialize.call(game);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Game optional mob pack initialization', () => {
  it('does not construct or register Desert Wildlife when its profile is disabled', async () => {
    const profile = setMobPackEnabled(
      DEFAULT_WORLD_FEATURE_PROFILE,
      'desert-wildlife',
      false
    );
    const { game, mobs } = createUninitializedGame(profile);

    await initializeOptionalMobPacks(game);

    expect(packMocks.camelConstructions).not.toHaveBeenCalled();
    expect(packMocks.createWildlife).not.toHaveBeenCalled();
    expect(mobs.register).not.toHaveBeenCalled();
    expect(mobs.restore).toHaveBeenCalledWith([{ id: 7, species: 'camel' }]);
  });

  it('constructs the pack and registers its species before restoring saved mobs when enabled', async () => {
    const { game, mobs } = createUninitializedGame(DEFAULT_WORLD_FEATURE_PROFILE);

    await initializeOptionalMobPacks(game);

    expect(packMocks.camelConstructions).toHaveBeenCalledOnce();
    expect(packMocks.createWildlife).toHaveBeenCalledOnce();
    expect(mobs.register.mock.calls.map(([behavior]) => behavior))
      .toEqual(packMocks.behaviors);
    expect(mobs.restore).toHaveBeenCalledWith([{ id: 7, species: 'camel' }]);
    expect(mobs.register.mock.invocationCallOrder[0])
      .toBeLessThan(mobs.restore.mock.invocationCallOrder[0]);
  });
});
