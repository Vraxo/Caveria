import { WebAudioEngine } from './WebAudioEngine';

export type AudioBus = 'sfx' | 'ambient';
type NoiseFilterType = 'lowpass' | 'bandpass' | 'highpass';

export interface NoiseBurstOptions {
  duration: number;
  filterType: NoiseFilterType;
  freq: number;
  freqEnd?: number;
  q?: number;
  gain: number;
  attack?: number;
  delay?: number;
  bus?: AudioBus;
}

export interface ToneOptions {
  type: OscillatorType;
  freq: number;
  freqEnd?: number;
  duration: number;
  gain: number;
  attack?: number;
  delay?: number;
  bus?: AudioBus;
}

/** Reusable oscillator/noise voices with short click-safe envelopes. */
export class SynthPrimitives {
  constructor(
    private readonly engine: WebAudioEngine,
    private readonly random: () => number = Math.random
  ) {}

  public noiseBurst(options: NoiseBurstOptions): void {
    const context = this.engine.context;
    const destination = options.bus === 'ambient' ? this.engine.ambientGain : this.engine.sfxGain;
    const noise = this.engine.noiseBuffer;
    if (!context || !destination || !noise) return;

    const start = context.currentTime + (options.delay ?? 0);
    const source = context.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    source.playbackRate.value = 0.85 + this.random() * 0.3;

    const filter = context.createBiquadFilter();
    filter.type = options.filterType;
    filter.frequency.setValueAtTime(options.freq, start);
    if (options.freqEnd !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(20, options.freqEnd),
        start + options.duration
      );
    }
    filter.Q.value = options.q ?? 0.8;

    const gain = context.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(options.gain, start + (options.attack ?? 0.004));
    gain.gain.exponentialRampToValueAtTime(0.0008, start + options.duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    source.start(start, this.random() * 1.2);
    source.stop(start + options.duration + 0.05);
  }

  public tone(options: ToneOptions): void {
    const context = this.engine.context;
    const destination = options.bus === 'ambient' ? this.engine.ambientGain : this.engine.sfxGain;
    if (!context || !destination) return;

    const start = context.currentTime + (options.delay ?? 0);
    const oscillator = context.createOscillator();
    oscillator.type = options.type;
    oscillator.frequency.setValueAtTime(options.freq, start);
    if (options.freqEnd !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, options.freqEnd),
        start + options.duration
      );
    }

    const gain = context.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(options.gain, start + (options.attack ?? 0.005));
    gain.gain.exponentialRampToValueAtTime(0.0008, start + options.duration);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(start);
    oscillator.stop(start + options.duration + 0.05);
  }

  public rand(min: number, max: number): number {
    return min + this.random() * (max - min);
  }
}
