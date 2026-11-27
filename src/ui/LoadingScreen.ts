/** Controls the full-screen loading overlay shown during boot and world transitions. */
export class LoadingScreen {
  private readonly rootEl = document.getElementById('loading-screen');
  private readonly statusEl = document.getElementById('loading-status');
  private readonly fillEl = document.getElementById('loading-bar-fill');
  private readonly percentEl = document.getElementById('loading-percent');

  public show(statusText = 'Loading world...', progress = 0): void {
    if (!this.rootEl) return;
    this.rootEl.classList.remove('hidden');
    this.rootEl.setAttribute('aria-busy', 'true');
    this.setProgress(progress, statusText);
  }

  public setProgress(fraction: number, statusText?: string): void {
    const clamped = Math.max(0, Math.min(1, fraction));
    const percent = Math.round(clamped * 100);
    if (this.fillEl) this.fillEl.style.width = `${percent}%`;
    if (this.percentEl) this.percentEl.textContent = `${percent}%`;
    if (statusText !== undefined && this.statusEl) {
      this.statusEl.textContent = statusText;
    }
  }

  public hide(): void {
    if (!this.rootEl) return;
    this.setProgress(1, 'Ready');
    this.rootEl.setAttribute('aria-busy', 'false');
    this.rootEl.classList.add('hidden');
  }
}
