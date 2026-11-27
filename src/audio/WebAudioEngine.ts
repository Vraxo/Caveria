function clampVolumePercent(percent: number): number {
  return Math.min(100, Math.max(0, Math.round(percent)));
}

/** Owns AudioContext lifecycle, mixer buses, compressor, noise source, and mute state. */
export class WebAudioEngine {
  private contextValue: AudioContext | null = null;
  private masterGainValue: GainNode | null = null;
  private sfxGainValue: GainNode | null = null;
  private ambientGainValue: GainNode | null = null;
  private noiseBufferValue: AudioBuffer | null = null;
  private mutedValue = false;
  /** SFX volume in percent, matching the default 0.9 gain. */
  private sfxVolumeValue = 90;
  /** Ambience volume in percent, matching the default 0.55 gain. */
  private ambienceVolumeValue = 55;

  public get context(): AudioContext | null { return this.contextValue; }
  public get sfxGain(): GainNode | null { return this.sfxGainValue; }
  public get ambientGain(): GainNode | null { return this.ambientGainValue; }
  public get noiseBuffer(): AudioBuffer | null { return this.noiseBufferValue; }
  public get muted(): boolean { return this.mutedValue; }

  public setSfxVolume(percent: number): void {
    this.sfxVolumeValue = clampVolumePercent(percent);
    if (this.contextValue && this.sfxGainValue) {
      this.sfxGainValue.gain.value = this.sfxVolumeValue / 100;
    }
  }
  public getSfxVolume(): number { return this.sfxVolumeValue; }
  public setAmbienceVolume(percent: number): void {
    this.ambienceVolumeValue = clampVolumePercent(percent);
    if (this.contextValue && this.ambientGainValue) {
      this.ambientGainValue.gain.value = this.ambienceVolumeValue / 100;
    }
  }
  public getAmbienceVolume(): number { return this.ambienceVolumeValue; }

  public unlock(): void {
    if (!this.contextValue) this.createGraph();
    if (this.contextValue?.state === 'suspended') void this.contextValue.resume();
  }

  public setMuted(muted: boolean): void {
    this.mutedValue = muted;
    if (this.contextValue && this.masterGainValue) {
      this.masterGainValue.gain.setTargetAtTime(muted ? 0 : 0.85, this.contextValue.currentTime, 0.02);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.mutedValue);
    return this.mutedValue;
  }

  public dispose(): void {
    if (this.contextValue && this.contextValue.state !== 'closed') void this.contextValue.close();
    this.contextValue = null;
    this.masterGainValue = null;
    this.sfxGainValue = null;
    this.ambientGainValue = null;
    this.noiseBufferValue = null;
  }

  private createGraph(): void {
    const AudioContextClass: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    this.contextValue = context;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 22;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.18;
    compressor.connect(context.destination);

    this.masterGainValue = context.createGain();
    this.masterGainValue.gain.value = this.mutedValue ? 0 : 0.85;
    this.masterGainValue.connect(compressor);

    this.sfxGainValue = context.createGain();
    this.sfxGainValue.gain.value = this.sfxVolumeValue / 100;
    this.sfxGainValue.connect(this.masterGainValue);

    this.ambientGainValue = context.createGain();
    this.ambientGainValue.gain.value = this.ambienceVolumeValue / 100;
    this.ambientGainValue.connect(this.masterGainValue);

    const length = context.sampleRate * 2;
    this.noiseBufferValue = context.createBuffer(1, length, context.sampleRate);
    const data = this.noiseBufferValue.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
}
