import {
  isMobPackEnabled,
  type MobPackId,
  type WorldFeatureProfile,
} from './WorldFeatureProfile';

/** Constructs and registers a pack only when the world's profile enables it. */
export async function initializeMobPackIfEnabled<TBehavior>(
  profile: WorldFeatureProfile,
  packId: MobPackId,
  createPack: () => Promise<ReadonlyArray<TBehavior>>,
  register: (behavior: TBehavior) => void
): Promise<boolean> {
  if (!isMobPackEnabled(profile, packId)) return false;

  const behaviors = await createPack();
  for (const behavior of behaviors) register(behavior);
  return true;
}
