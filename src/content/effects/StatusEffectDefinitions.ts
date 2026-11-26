export type StatusEffectId =
  | 'well-fed'
  | 'regeneration'
  | 'poisoned'
  | 'warmth'
  | 'chilled'
  | 'antidote'
  | 'hydrated'
  | 'nausea'
  | 'water-breathing';

export interface StatusEffectSnapshot {
  id: StatusEffectId;
  remaining: number;
}

export interface StatusEffectDefinition {
  id: StatusEffectId;
  icon: string;
  name: string;
  beneficial: boolean;
  maxPersistedSeconds: number;
}

export const STATUS_EFFECT_DEFINITIONS: Readonly<Record<StatusEffectId, StatusEffectDefinition>> = {
  'well-fed': { id: 'well-fed', icon: '◆', name: 'Well Fed', beneficial: true, maxPersistedSeconds: 600 },
  regeneration: { id: 'regeneration', icon: '♥', name: 'Regeneration', beneficial: true, maxPersistedSeconds: 600 },
  poisoned: { id: 'poisoned', icon: '☠', name: 'Poisoned', beneficial: false, maxPersistedSeconds: 600 },
  warmth: { id: 'warmth', icon: '♨', name: 'Warmth', beneficial: true, maxPersistedSeconds: 600 },
  chilled: { id: 'chilled', icon: '❄', name: 'Chilled', beneficial: false, maxPersistedSeconds: 600 },
  antidote: { id: 'antidote', icon: '✚', name: 'Antidote', beneficial: true, maxPersistedSeconds: 600 },
  hydrated: { id: 'hydrated', icon: '●', name: 'Hydrated', beneficial: true, maxPersistedSeconds: 600 },
  nausea: { id: 'nausea', icon: '≈', name: 'Nauseous', beneficial: false, maxPersistedSeconds: 600 },
  'water-breathing': { id: 'water-breathing', icon: '◌', name: 'Water Breathing', beneficial: true, maxPersistedSeconds: 600 },
};

export const STATUS_EFFECT_IDS = Object.freeze(
  Object.keys(STATUS_EFFECT_DEFINITIONS) as StatusEffectId[]
);
