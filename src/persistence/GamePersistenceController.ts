import { CaveriaSaveData, SAVE_VERSION, WorldPersistence } from './WorldPersistence';

export type GameSaveSnapshot = Omit<CaveriaSaveData, 'version' | 'seed' | 'savedAt'>;

/** Owns autosave cadence, browser lifecycle saves, reset controls, and save feedback. */
export class GamePersistenceController {
  private readonly persistence: WorldPersistence;
  private readonly statusEl = document.getElementById('save-status')!;
  private snapshotProvider: (() => GameSaveSnapshot) | null = null;
  private autosaveElapsed = 0;
  private statusTimer = 0;
  private suppressSave = false;

  constructor(
    private readonly seedLabel: string,
    private readonly onManualSave: () => void
  ) {
    this.persistence = new WorldPersistence(seedLabel);
  }

  public load(): CaveriaSaveData | null {
    return this.persistence.load();
  }

  public bind(snapshotProvider: () => GameSaveSnapshot): void {
    this.snapshotProvider = snapshotProvider;

    document.getElementById('save-now')!.addEventListener('click', (event) => {
      event.stopPropagation();
      this.onManualSave();
      this.save(true);
    });
    document.getElementById('reset-world')!.addEventListener('click', (event) => {
      event.stopPropagation();
      if (window.confirm(`Delete the saved world for seed “${this.seedLabel}”?`)) {
        this.suppressSave = true;
        this.persistence.clear();
        window.location.reload();
      }
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

  public showRestored(editCount: number): void {
    this.statusEl.textContent = `✓ World restored · ${editCount} voxel edits`;
    this.statusEl.classList.add('visible');
    this.statusTimer = 3.5;
  }

  public save(showFeedback: boolean): void {
    if (this.suppressSave || !this.snapshotProvider) return;
    const snapshot = this.snapshotProvider();
    const saved = this.persistence.save({
      version: SAVE_VERSION,
      seed: this.seedLabel,
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
