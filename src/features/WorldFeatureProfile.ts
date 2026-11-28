export const WORLD_FEATURE_PROFILE_VERSION = 1 as const;

export const MOB_PACK_IDS = ['desert-wildlife'] as const;
export type MobPackId = typeof MOB_PACK_IDS[number];

/** Per-world content choices. This is part of world identity, not a global user preference. */
export interface WorldFeatureProfile {
  version: typeof WORLD_FEATURE_PROFILE_VERSION;
  enabledMobPacks: ReadonlyArray<MobPackId>;
}

export const DEFAULT_WORLD_FEATURE_PROFILE: WorldFeatureProfile = Object.freeze({
  version: WORLD_FEATURE_PROFILE_VERSION,
  enabledMobPacks: Object.freeze([...MOB_PACK_IDS]),
});

function isMobPackId(value: unknown): value is MobPackId {
  return typeof value === 'string' && (MOB_PACK_IDS as readonly string[]).includes(value);
}

/** Normalizes persisted or URL-provided profile data, dropping unknown and duplicate pack IDs. */
export function normalizeWorldFeatureProfile(value: unknown): WorldFeatureProfile {
  if (!value || typeof value !== 'object') return DEFAULT_WORLD_FEATURE_PROFILE;
  const profile = value as Record<string, unknown>;
  if (profile.version !== WORLD_FEATURE_PROFILE_VERSION || !Array.isArray(profile.enabledMobPacks)) {
    return DEFAULT_WORLD_FEATURE_PROFILE;
  }

  const enabledMobPacks = [...new Set(profile.enabledMobPacks.filter(isMobPackId))];
  return {
    version: WORLD_FEATURE_PROFILE_VERSION,
    enabledMobPacks: Object.freeze(enabledMobPacks),
  };
}

/** Missing URL configuration means a normal full-featured world; an empty value means no packs. */
export function parseWorldFeatureProfile(params: URLSearchParams): WorldFeatureProfile {
  const rawMobPacks = params.get('mobPacks');
  if (rawMobPacks === null) return DEFAULT_WORLD_FEATURE_PROFILE;
  return normalizeWorldFeatureProfile({
    version: WORLD_FEATURE_PROFILE_VERSION,
    enabledMobPacks: rawMobPacks === '' ? [] : rawMobPacks.split(','),
  });
}

export function serializeWorldFeatureProfile(profile: WorldFeatureProfile): string {
  return normalizeWorldFeatureProfile(profile).enabledMobPacks.join(',');
}

export function isMobPackEnabled(profile: WorldFeatureProfile, packId: MobPackId): boolean {
  return normalizeWorldFeatureProfile(profile).enabledMobPacks.includes(packId);
}

export function setMobPackEnabled(
  profile: WorldFeatureProfile,
  packId: MobPackId,
  enabled: boolean
): WorldFeatureProfile {
  const selected = new Set(normalizeWorldFeatureProfile(profile).enabledMobPacks);
  if (enabled) selected.add(packId);
  else selected.delete(packId);
  return normalizeWorldFeatureProfile({
    version: WORLD_FEATURE_PROFILE_VERSION,
    enabledMobPacks: [...selected],
  });
}
