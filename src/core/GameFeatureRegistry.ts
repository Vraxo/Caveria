export type GameUpdatePhase = 'frame-start' | 'before-player' | 'after-player' | 'frame-end';

export interface GameFeatureParticipant<TSnapshot extends object> {
  id: string;
  updates?: Partial<Record<GameUpdatePhase, (dt: number) => void>>;
  snapshot?: () => Partial<TSnapshot>;
}

/**
 * Keeps feature lifecycle and save participation ordered and extensible without hiding core game flow.
 * Registration order is update order within each explicit frame phase. Loading remains explicit during
 * feature construction because each subsystem has different dependencies and restoration invariants.
 */
export class GameFeatureRegistry<TSnapshot extends object> {
  private readonly participants: Array<GameFeatureParticipant<TSnapshot>> = [];
  private readonly participantIds = new Set<string>();

  public constructor(
    private readonly expectedSnapshotKeys: ReadonlyArray<Extract<keyof TSnapshot, string>> = []
  ) {}

  public register(participant: GameFeatureParticipant<TSnapshot>): this {
    if (!participant.id) throw new Error('Game feature participant requires an id');
    if (this.participantIds.has(participant.id)) {
      throw new Error(`Duplicate game feature participant: ${participant.id}`);
    }
    this.participantIds.add(participant.id);
    this.participants.push(participant);
    return this;
  }

  public update(phase: GameUpdatePhase, dt: number): void {
    for (const participant of this.participants) {
      participant.updates?.[phase]?.(dt);
    }
  }

  /** Merges core state and participant fragments, rejecting ambiguous property ownership. */
  public capture(base: Partial<TSnapshot>): TSnapshot {
    const snapshot: Record<string, unknown> = { ...base };
    const owners = new Map(Object.keys(snapshot).map((key) => [key, 'core']));

    for (const participant of this.participants) {
      if (!participant.snapshot) continue;
      const fragment = participant.snapshot();
      for (const [key, value] of Object.entries(fragment)) {
        const owner = owners.get(key);
        if (owner) {
          throw new Error(
            `Save snapshot property "${key}" is owned by both ${owner} and ${participant.id}`
          );
        }
        owners.set(key, participant.id);
        snapshot[key] = value;
      }
    }

    for (const key of this.expectedSnapshotKeys) {
      if (!owners.has(key)) {
        throw new Error(`Save snapshot is missing required property "${key}"`);
      }
    }
    return snapshot as TSnapshot;
  }
}
