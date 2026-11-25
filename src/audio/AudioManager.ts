import { BlockId } from '../content/BlockId';

/**
 * Procedural Retro Audio Engine for Caveria.
 *
 * Every sound is synthesized live with the Web Audio API — no audio files.
 * Retro character comes from square/triangle oscillators, filtered noise
 * bursts, short envelopes, and per-play pitch randomization.
 *
 * The AudioContext is created lazily on the first user gesture (Play button /
 * pointer lock) to satisfy browser autoplay policies.
 */

type NoiseFilterType = 'lowpass' | 'bandpass' | 'highpass';

interface NoiseBurstOpts {
  duration: number;
  filterType: NoiseFilterType;
  freq: number;
  freqEnd?: number;
  q?: number;
  gain: number;
  attack?: number;
  delay?: number;
}

interface ToneOpts {
  type: OscillatorType;
  freq: number;
  freqEnd?: number;
  duration: number;
  gain: number;
  attack?: number;
  delay?: number;
}

export class AudioManager {
  public muted = false;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // Ambient loop nodes
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private ambientStarted = false;

  // Ambient event timers (seconds until next event)
  private birdTimer = 2.5;
  private dripTimer = 1.2;
  private cricketTimer = 0.8;
  private bubbleTimer = 0.4;

  // Throttles
  private lastMineHit = 0;
  private lastStep = 0;
  private stepAlternate = false;

  /** Must be called from a user gesture (click / keydown). Safe to call repeatedly. */
  public unlock(): void {
    if (!this.ctx) {
      const AC: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();

      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 22;
      comp.ratio.value = 8;
      comp.attack.value = 0.004;
      comp.release.value = 0.18;
      comp.connect(this.ctx.destination);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.85;
      this.masterGain.connect(comp);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.masterGain);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0.55;
      this.ambientGain.connect(this.masterGain);

      // Pre-render 2s of white noise for all noise-based sounds.
      const len = this.ctx.sampleRate * 2;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    this.startAmbientLoop();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.85, this.ctx.currentTime, 0.02);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // ---------------------------------------------------------------------------
  // Low-level synth helpers
  // ---------------------------------------------------------------------------

  private noiseBurst(opts: NoiseBurstOpts): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.playbackRate.value = 0.85 + Math.random() * 0.3;

    const filter = this.ctx.createBiquadFilter();
    filter.type = opts.filterType;
    filter.frequency.setValueAtTime(opts.freq, t0);
    if (opts.freqEnd !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), t0 + opts.duration);
    }
    filter.Q.value = opts.q ?? 0.8;

    const gain = this.ctx.createGain();
    const attack = opts.attack ?? 0.004;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(opts.gain, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + opts.duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(t0, Math.random() * 1.2);
    src.stop(t0 + opts.duration + 0.05);
  }

  private tone(opts: ToneOpts): void {
    if (!this.ctx || !this.sfxGain) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const osc = this.ctx.createOscillator();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), t0 + opts.duration);
    }

    const gain = this.ctx.createGain();
    const attack = opts.attack ?? 0.005;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(opts.gain, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + opts.duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + opts.duration + 0.05);
  }

  private rand(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  // ---------------------------------------------------------------------------
  // Block interaction sounds (mining / breaking / placing)
  // ---------------------------------------------------------------------------

  public playMineHit(blockId: BlockId): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastMineHit < 0.11) return;
    this.lastMineHit = now;

    switch (blockId) {
      case BlockId.Stone:
      case BlockId.Cobblestone:
      case BlockId.DeepSlate:
      case BlockId.CoalOre:
      case BlockId.GoldOre:
      case BlockId.Sandstone:
        // Metallic clink: short noise tick + high square blip
        this.noiseBurst({ duration: 0.07, filterType: 'bandpass', freq: this.rand(2400, 3400), q: 2.2, gain: 0.16 });
        this.tone({ type: 'square', freq: this.rand(680, 920), freqEnd: this.rand(420, 560), duration: 0.06, gain: 0.05 });
        break;
      case BlockId.OakLog:
      case BlockId.SpruceLog:
      case BlockId.OakPlanks:
      case BlockId.CraftingTable:
        // Wooden knock
        this.noiseBurst({ duration: 0.08, filterType: 'bandpass', freq: this.rand(700, 1000), q: 1.6, gain: 0.2 });
        this.tone({ type: 'triangle', freq: this.rand(170, 230), freqEnd: 110, duration: 0.09, gain: 0.14 });
        break;
      case BlockId.OakLeaves:
      case BlockId.SpruceLeaves:
        // Leafy rustle
        this.noiseBurst({ duration: 0.14, filterType: 'highpass', freq: 3200, gain: 0.1 });
        break;
      case BlockId.Glass:
        this.noiseBurst({ duration: 0.1, filterType: 'highpass', freq: 5200, gain: 0.14 });
        this.tone({ type: 'sine', freq: this.rand(2200, 2800), freqEnd: 1400, duration: 0.12, gain: 0.06 });
        break;
      case BlockId.GlowCrystal:
      case BlockId.AmethystCrystal:
        // Crystal chime tick
        this.tone({ type: 'sine', freq: this.rand(1500, 2100), freqEnd: this.rand(1100, 1400), duration: 0.16, gain: 0.1 });
        this.tone({ type: 'sine', freq: this.rand(2600, 3200), duration: 0.1, gain: 0.05 });
        this.noiseBurst({ duration: 0.05, filterType: 'highpass', freq: 6000, gain: 0.06 });
        break;
      case BlockId.Torch:
      case BlockId.CaveShroom:
      case BlockId.CaveVine:
      case BlockId.DripstoneSpike:
        this.noiseBurst({ duration: 0.07, filterType: 'bandpass', freq: this.rand(1100, 1600), q: 1.4, gain: 0.1 });
        break;
      case BlockId.Water:
        this.noiseBurst({ duration: 0.16, filterType: 'lowpass', freq: 900, freqEnd: 300, gain: 0.12 });
        break;
      default:
        // Dirt / grass / sand / snow / moss / cactus: soft thud
        this.noiseBurst({ duration: 0.09, filterType: 'lowpass', freq: this.rand(500, 800), gain: 0.16 });
        break;
    }
  }

  public playBreak(blockId: BlockId): void {
    if (!this.ctx) return;
    switch (blockId) {
      case BlockId.Stone:
      case BlockId.Cobblestone:
      case BlockId.DeepSlate:
      case BlockId.CoalOre:
      case BlockId.GoldOre:
      case BlockId.Sandstone:
        this.noiseBurst({ duration: 0.22, filterType: 'lowpass', freq: 1800, freqEnd: 300, gain: 0.3 });
        this.noiseBurst({ duration: 0.1, filterType: 'bandpass', freq: 2600, q: 2, gain: 0.16 });
        this.tone({ type: 'square', freq: 320, freqEnd: 120, duration: 0.14, gain: 0.08 });
        break;
      case BlockId.OakLog:
      case BlockId.SpruceLog:
      case BlockId.OakPlanks:
      case BlockId.CraftingTable:
        this.noiseBurst({ duration: 0.2, filterType: 'bandpass', freq: 800, q: 1.2, gain: 0.28 });
        this.tone({ type: 'triangle', freq: 200, freqEnd: 90, duration: 0.18, gain: 0.16 });
        break;
      case BlockId.OakLeaves:
      case BlockId.SpruceLeaves:
        this.noiseBurst({ duration: 0.3, filterType: 'highpass', freq: 2400, gain: 0.16 });
        break;
      case BlockId.Glass:
        this.noiseBurst({ duration: 0.35, filterType: 'highpass', freq: 4200, gain: 0.24 });
        this.tone({ type: 'sine', freq: 2800, freqEnd: 900, duration: 0.3, gain: 0.1 });
        this.tone({ type: 'sine', freq: 3600, freqEnd: 1200, duration: 0.22, gain: 0.07, delay: 0.04 });
        break;
      case BlockId.GlowCrystal:
      case BlockId.AmethystCrystal:
        this.tone({ type: 'sine', freq: 1800, freqEnd: 900, duration: 0.35, gain: 0.14 });
        this.tone({ type: 'sine', freq: 2700, freqEnd: 1400, duration: 0.28, gain: 0.09, delay: 0.05 });
        this.noiseBurst({ duration: 0.18, filterType: 'highpass', freq: 5000, gain: 0.1 });
        break;
      case BlockId.Torch:
      case BlockId.CaveShroom:
      case BlockId.CaveVine:
        this.tone({ type: 'sine', freq: 700, freqEnd: 300, duration: 0.12, gain: 0.1 });
        this.noiseBurst({ duration: 0.1, filterType: 'bandpass', freq: 1400, gain: 0.08 });
        break;
      default:
        this.noiseBurst({ duration: 0.2, filterType: 'lowpass', freq: 1100, freqEnd: 250, gain: 0.26 });
        break;
    }
  }

  public playPlace(blockId: BlockId): void {
    if (!this.ctx) return;
    switch (blockId) {
      case BlockId.Stone:
      case BlockId.Cobblestone:
      case BlockId.DeepSlate:
      case BlockId.CoalOre:
      case BlockId.GoldOre:
      case BlockId.Sandstone:
        this.noiseBurst({ duration: 0.1, filterType: 'bandpass', freq: 2000, q: 1.8, gain: 0.2 });
        this.tone({ type: 'square', freq: 480, freqEnd: 260, duration: 0.07, gain: 0.06 });
        break;
      case BlockId.OakLog:
      case BlockId.SpruceLog:
      case BlockId.OakPlanks:
      case BlockId.CraftingTable:
        this.noiseBurst({ duration: 0.1, filterType: 'bandpass', freq: 750, q: 1.5, gain: 0.22 });
        this.tone({ type: 'triangle', freq: 220, freqEnd: 130, duration: 0.09, gain: 0.12 });
        break;
      case BlockId.Glass:
        this.tone({ type: 'sine', freq: 2400, freqEnd: 1600, duration: 0.12, gain: 0.08 });
        this.noiseBurst({ duration: 0.08, filterType: 'highpass', freq: 5000, gain: 0.08 });
        break;
      case BlockId.GlowCrystal:
      case BlockId.AmethystCrystal:
        this.tone({ type: 'sine', freq: 1600, freqEnd: 1100, duration: 0.2, gain: 0.1 });
        break;
      case BlockId.Torch:
      case BlockId.CaveShroom:
      case BlockId.CaveVine:
        this.tone({ type: 'sine', freq: 520, freqEnd: 340, duration: 0.08, gain: 0.09 });
        break;
      default:
        this.noiseBurst({ duration: 0.1, filterType: 'lowpass', freq: 800, freqEnd: 350, gain: 0.2 });
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Movement sounds
  // ---------------------------------------------------------------------------

  public playStep(surfaceBlock: BlockId, sprinting: boolean): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastStep < 0.16) return;
    this.lastStep = now;
    this.stepAlternate = !this.stepAlternate;
    const pitch = this.stepAlternate ? 1.0 : 0.88;
    const vol = sprinting ? 0.13 : 0.09;

    switch (surfaceBlock) {
      case BlockId.Stone:
      case BlockId.Cobblestone:
      case BlockId.DeepSlate:
      case BlockId.CoalOre:
      case BlockId.GoldOre:
      case BlockId.Sandstone:
        this.noiseBurst({ duration: 0.06, filterType: 'bandpass', freq: 1800 * pitch, q: 2, gain: vol });
        break;
      case BlockId.OakLog:
      case BlockId.OakPlanks:
      case BlockId.CraftingTable:
        this.noiseBurst({ duration: 0.07, filterType: 'bandpass', freq: 650 * pitch, q: 1.6, gain: vol * 1.2 });
        break;
      case BlockId.OakLeaves:
      case BlockId.SpruceLeaves:
        this.noiseBurst({ duration: 0.11, filterType: 'highpass', freq: 3000, gain: vol * 0.8 });
        break;
      case BlockId.Glass:
        this.noiseBurst({ duration: 0.06, filterType: 'highpass', freq: 5200, gain: vol * 0.7 });
        break;
      case BlockId.Sand:
      case BlockId.SnowBlock:
      case BlockId.SnowGrass:
        this.noiseBurst({ duration: 0.12, filterType: 'lowpass', freq: 600 * pitch, gain: vol * 1.1 });
        break;
      default:
        this.noiseBurst({ duration: 0.08, filterType: 'lowpass', freq: 750 * pitch, gain: vol });
        break;
    }
  }

  public playJump(): void {
    if (!this.ctx) return;
    this.noiseBurst({ duration: 0.09, filterType: 'bandpass', freq: 500, q: 1.2, gain: 0.07 });
  }

  public playLand(hard: boolean): void {
    if (!this.ctx) return;
    this.noiseBurst({
      duration: hard ? 0.18 : 0.1,
      filterType: 'lowpass',
      freq: hard ? 900 : 700,
      freqEnd: 220,
      gain: hard ? 0.22 : 0.12,
    });
    if (hard) {
      this.tone({ type: 'triangle', freq: 160, freqEnd: 80, duration: 0.14, gain: 0.1 });
    }
  }

  public playSplash(): void {
    if (!this.ctx) return;
    this.noiseBurst({ duration: 0.4, filterType: 'lowpass', freq: 1600, freqEnd: 350, gain: 0.24 });
    this.noiseBurst({ duration: 0.22, filterType: 'bandpass', freq: 1100, q: 1.2, gain: 0.1, delay: 0.08 });
  }

  // ---------------------------------------------------------------------------
  // UI / inventory / pickup sounds
  // ---------------------------------------------------------------------------

  public playPickup(): void {
    if (!this.ctx) return;
    // Classic two-note pop
    this.tone({ type: 'square', freq: 660, duration: 0.06, gain: 0.06 });
    this.tone({ type: 'square', freq: 990, duration: 0.09, gain: 0.06, delay: 0.055 });
  }

  public playCrystalPickup(): void {
    if (!this.ctx) return;
    this.tone({ type: 'sine', freq: 1320, duration: 0.12, gain: 0.08 });
    this.tone({ type: 'sine', freq: 1760, duration: 0.16, gain: 0.08, delay: 0.06 });
    this.tone({ type: 'sine', freq: 2640, duration: 0.2, gain: 0.05, delay: 0.12 });
  }

  public playUiClick(): void {
    if (!this.ctx) return;
    this.tone({ type: 'square', freq: 880, duration: 0.045, gain: 0.05 });
  }

  public playHotbarSelect(): void {
    if (!this.ctx) return;
    this.tone({ type: 'square', freq: 520, duration: 0.04, gain: 0.04 });
  }

  public playInventoryOpen(): void {
    if (!this.ctx) return;
    this.noiseBurst({ duration: 0.14, filterType: 'bandpass', freq: 900, q: 1.4, gain: 0.08 });
    this.tone({ type: 'triangle', freq: 340, freqEnd: 520, duration: 0.1, gain: 0.05 });
  }

  public playInventoryClose(): void {
    if (!this.ctx) return;
    this.noiseBurst({ duration: 0.12, filterType: 'bandpass', freq: 700, q: 1.4, gain: 0.07 });
    this.tone({ type: 'triangle', freq: 520, freqEnd: 340, duration: 0.09, gain: 0.045 });
  }

  public playCraft(): void {
    if (!this.ctx) return;
    this.noiseBurst({ duration: 0.08, filterType: 'bandpass', freq: 1200, q: 1.6, gain: 0.1 });
    this.tone({ type: 'square', freq: 740, duration: 0.07, gain: 0.05, delay: 0.05 });
    this.tone({ type: 'square', freq: 1100, duration: 0.1, gain: 0.05, delay: 0.11 });
  }

  public playToss(): void {
    if (!this.ctx) return;
    this.noiseBurst({ duration: 0.12, filterType: 'bandpass', freq: 600, freqEnd: 1400, q: 1.4, gain: 0.08 });
  }

  public playToolBreak(): void {
    if (!this.ctx) return;
    this.noiseBurst({ duration: 0.16, filterType: 'bandpass', freq: 1600, q: 1.8, gain: 0.18 });
    this.tone({ type: 'square', freq: 300, freqEnd: 140, duration: 0.14, gain: 0.08 });
  }

  public playModeToggle(): void {
    if (!this.ctx) return;
    this.tone({ type: 'square', freq: 440, duration: 0.06, gain: 0.05 });
    this.tone({ type: 'square', freq: 660, duration: 0.08, gain: 0.05, delay: 0.06 });
  }

  // ---------------------------------------------------------------------------
  // Ambient soundscape (wind / birds / cave drips / crickets / bubbles)
  // ---------------------------------------------------------------------------

  private startAmbientLoop(): void {
    if (!this.ctx || !this.ambientGain || !this.noiseBuffer || this.ambientStarted) return;
    this.ambientStarted = true;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.playbackRate.value = 0.5;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 420;
    this.windFilter.Q.value = 0.6;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.05;

    src.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.ambientGain);
    src.start();
  }

  /**
   * Call every frame. `skyBrightness` is 0..1 (1 = noon, ~0.15 = night).
   * `underground` = player is deep below the surface; `underwater` = head in water.
   */
  public updateAmbient(
    dt: number,
    opts: { underground: boolean; underwater: boolean; skyBrightness: number }
  ): void {
    if (!this.ctx || !this.windGain || !this.windFilter) return;
    const t = this.ctx.currentTime;

    // Wind level: breezy on surface by day, calm underground, muffled underwater.
    let windTarget = 0.045 + opts.skyBrightness * 0.05;
    if (opts.underground) windTarget = 0.012;
    if (opts.underwater) windTarget = 0.02;
    // Slow organic gusting
    const gust = 1 + Math.sin(t * 0.35) * 0.35 + Math.sin(t * 0.13 + 1.7) * 0.25;
    this.windGain.gain.setTargetAtTime(windTarget * gust, t, 0.4);
    this.windFilter.frequency.setTargetAtTime(
      opts.underwater ? 300 : 380 + opts.skyBrightness * 220 + Math.sin(t * 0.5) * 60,
      t,
      0.5
    );

    // Birds: daytime surface only
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = this.rand(2.2, 7.5);
      if (!opts.underground && !opts.underwater && opts.skyBrightness > 0.55) {
        this.playBirdChirp();
      }
    }

    // Cave drips: underground only
    this.dripTimer -= dt;
    if (this.dripTimer <= 0) {
      this.dripTimer = this.rand(0.7, 3.2);
      if (opts.underground && !opts.underwater) {
        this.playCaveDrip();
      }
    }

    // Crickets: night surface only
    this.cricketTimer -= dt;
    if (this.cricketTimer <= 0) {
      this.cricketTimer = this.rand(0.5, 1.4);
      if (!opts.underground && !opts.underwater && opts.skyBrightness < 0.3) {
        this.playCricket();
      }
    }

    // Bubbles: underwater only
    this.bubbleTimer -= dt;
    if (this.bubbleTimer <= 0) {
      this.bubbleTimer = this.rand(0.25, 0.9);
      if (opts.underwater) {
        this.playBubble();
      }
    }
  }

  private playBirdChirp(): void {
    if (!this.ctx || !this.ambientGain) return;
    const t0 = this.ctx.currentTime;
    const base = this.rand(2400, 3600);
    const notes = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < notes; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      const start = t0 + i * 0.11;
      osc.frequency.setValueAtTime(base * this.rand(0.95, 1.15), start);
      osc.frequency.exponentialRampToValueAtTime(base * this.rand(1.2, 1.5), start + 0.05);
      osc.frequency.exponentialRampToValueAtTime(base * 0.9, start + 0.09);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.035, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.1);
      osc.connect(gain);
      gain.connect(this.ambientGain);
      osc.start(start);
      osc.stop(start + 0.12);
    }
  }

  private playCaveDrip(): void {
    if (!this.ctx || !this.ambientGain) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    const f = this.rand(900, 1500);
    osc.frequency.setValueAtTime(f, t0);
    osc.frequency.exponentialRampToValueAtTime(f * 0.45, t0 + 0.09);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.07, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.22);
    osc.connect(gain);
    gain.connect(this.ambientGain);
    osc.start(t0);
    osc.stop(t0 + 0.25);
    // Faint echo
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(f * 0.8, t0 + 0.18);
    osc2.frequency.exponentialRampToValueAtTime(f * 0.4, t0 + 0.26);
    const gain2 = this.ctx.createGain();
    gain2.gain.setValueAtTime(0, t0 + 0.18);
    gain2.gain.linearRampToValueAtTime(0.025, t0 + 0.185);
    gain2.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.36);
    osc2.connect(gain2);
    gain2.connect(this.ambientGain);
    osc2.start(t0 + 0.18);
    osc2.stop(t0 + 0.4);
  }

  private playCricket(): void {
    if (!this.ctx || !this.ambientGain) return;
    const t0 = this.ctx.currentTime;
    const freq = this.rand(4200, 4800);
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = t0 + i * 0.07;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.016, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.05);
      osc.connect(gain);
      gain.connect(this.ambientGain);
      osc.start(start);
      osc.stop(start + 0.06);
    }
  }

  private playBubble(): void {
    if (!this.ctx || !this.ambientGain) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    const f = this.rand(500, 900);
    osc.frequency.setValueAtTime(f, t0);
    osc.frequency.exponentialRampToValueAtTime(f * 1.8, t0 + 0.08);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.03, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.1);
    osc.connect(gain);
    gain.connect(this.ambientGain);
    osc.start(t0);
    osc.stop(t0 + 0.12);
  }
}
