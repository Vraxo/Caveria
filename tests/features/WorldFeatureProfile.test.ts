import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORLD_FEATURE_PROFILE,
  WORLD_FEATURE_PROFILE_VERSION,
  isMobPackEnabled,
  normalizeWorldFeatureProfile,
  parseWorldFeatureProfile,
  serializeWorldFeatureProfile,
  setMobPackEnabled,
} from '../../src/features/WorldFeatureProfile';

describe('WorldFeatureProfile', () => {
  it('defaults to all built-in mob packs when a profile is not specified', () => {
    expect(parseWorldFeatureProfile(new URLSearchParams())).toEqual(
      DEFAULT_WORLD_FEATURE_PROFILE
    );
    expect(isMobPackEnabled(DEFAULT_WORLD_FEATURE_PROFILE, 'desert-wildlife')).toBe(true);
  });

  it('represents an explicitly empty selection and round-trips pack choices', () => {
    const disabled = parseWorldFeatureProfile(new URLSearchParams('mobPacks='));
    expect(disabled.enabledMobPacks).toEqual([]);
    expect(serializeWorldFeatureProfile(disabled)).toBe('');

    const enabled = parseWorldFeatureProfile(new URLSearchParams('mobPacks=desert-wildlife'));
    expect(isMobPackEnabled(enabled, 'desert-wildlife')).toBe(true);
    expect(serializeWorldFeatureProfile(enabled)).toBe('desert-wildlife');
  });

  it('deduplicates known packs and ignores unknown IDs in saved data', () => {
    expect(normalizeWorldFeatureProfile({
      version: WORLD_FEATURE_PROFILE_VERSION,
      enabledMobPacks: ['desert-wildlife', 'uninstalled-pack', 'desert-wildlife'],
    }).enabledMobPacks).toEqual(['desert-wildlife']);
  });

  it('falls back safely when the profile version or shape is unsupported', () => {
    expect(normalizeWorldFeatureProfile({ version: 999, enabledMobPacks: [] })).toEqual(
      DEFAULT_WORLD_FEATURE_PROFILE
    );
    expect(normalizeWorldFeatureProfile({ version: WORLD_FEATURE_PROFILE_VERSION })).toEqual(
      DEFAULT_WORLD_FEATURE_PROFILE
    );
  });

  it('can enable or disable a pack without mutating the original profile', () => {
    const disabled = setMobPackEnabled(DEFAULT_WORLD_FEATURE_PROFILE, 'desert-wildlife', false);
    expect(disabled.enabledMobPacks).toEqual([]);
    expect(DEFAULT_WORLD_FEATURE_PROFILE.enabledMobPacks).toEqual(['desert-wildlife']);
    expect(setMobPackEnabled(disabled, 'desert-wildlife', true).enabledMobPacks)
      .toEqual(['desert-wildlife']);
  });
});
