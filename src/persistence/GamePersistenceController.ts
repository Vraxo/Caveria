import { CaveriaSaveData, SAVE_VERSION, WorldPersistence } from './WorldPersistence';

export type GameSaveSnapshot = Omit<
  CaveriaSaveData,
  'version' | 'worldId' | 'worldName' | 'seed' | 'createdAt' | 'savedAt'
>;

const GAME_SAVE_SNAPSHOT_FIELDS = {
  player: true,
  inventory: true,
  armor: true,
  selectedHotbar: true,
  creativeMode: true,
  timeOfDay: true,
  weather: true,
  muted: true,
  temperature: true,
  statusEffects: true,
  furnaces: true,
  chests: true,
  farms: true,
  beds: true,
  respawnBed: true,
  mobs: true,
  worldEdits: true,
} satisfies Record<keyof GameSaveSnapshot, true>;

export const GAME_SAVE_SNAPSHOT_KEYS = Object.keys(
  GAME_SAVE_SNAPSHOT_FIELDS
) as Array<keyof GameSaveSnapshot>;

/** Owns autosave cadence, browser lifecycle saves, reset controls, and save feedback. */
export class GamePersistenceController {
  private readonly persistence: WorldPersistence;
  private readonly statusEl = document.getElementById('save-status')!;
  private snapshotProvider: (() => GameSaveSnapshot) | null = null;
  private autosaveElapsed = 0;
  private statusTimer = 0;
  private createdAt = Date.now();
  private saveEnabled = false;
  private saveSuppressed = false;

  constructor(
    private readonly seedLabel: string,
    private readonly worldId: string,
    private readonly worldName: string,
    private readonly onManualSave: () => void
  ) {
    this.persistence = new WorldPersistence(seedLabel, worldId, worldName);
  }

  public load(): CaveriaSaveData | null {
    const save = this.persistence.load();
    if (save) {
      this.createdAt = save.createdAt;
      this.saveEnabled = true;
    }
    return save;
  }

  public bind(snapshotProvider: () => GameSaveSnapshot): void {
    this.snapshotProvider = snapshotProvider;

    document.getElementById('save-now')!.addEventListener('click', (event) => {
      event.stopPropagation();
      this.onManualSave();
      this.save(true);
    });
    window.addEventListener('beforeunload', () => this.save(false));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.save(false);
    });
  }

  public update(dt: number): void {
    this.autosaveElapsed += dt;
    if (this.autosaveElapsed >= 10) {
      this.autosaveElapsed = 0;
      this.save(false);
    }

    if (this.statusTimer > 0) {
      this.statusTimer -= dt;
      if (this.statusTimer <= 0) this.statusEl.classList.remove('visible', 'error');
    }
  }

  public enableSaving(): void {
    this.saveEnabled = true;
  }

  public suppressFurtherSaves(): void {
    this.saveSuppressed = true;
  }

  public showRestored(editCount: number): void {
    this.statusEl.textContent = `✓ World restored · ${editCount} voxel edits`;
    this.statusEl.classList.add('visible');
    this.statusTimer = 3.5;
  }

  public save(showFeedback: boolean): void {
    if (!this.saveEnabled || this.saveSuppressed || !this.snapshotProvider) return;
    const snapshot = this.snapshotProvider();
    const saved = this.persistence.save({
      version: SAVE_VERSION,
      worldId: this.worldId,
      worldName: this.worldName,
      seed: this.seedLabel,
      createdAt: this.createdAt,
      savedAt: Date.now(),
      ...snapshot,
    });

    if (!showFeedback && saved) return;
    this.statusEl.textContent = saved
      ? `✓ World saved · ${snapshot.worldEdits.length} voxel edits`
      : '⚠ Save failed · browser storage unavailable';
    this.statusEl.classList.toggle('error', !saved);
    this.statusEl.classList.add('visible');
    this.statusTimer = saved ? 2.4 : 5;
  }
}
