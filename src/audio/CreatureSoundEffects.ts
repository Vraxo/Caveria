import { SynthPrimitives } from './SynthPrimitives';

/** Small procedural voices for living cave creatures. */
export class CreatureSoundEffects {
  constructor(private readonly synth: SynthPrimitives) {}

  public playCrystalMiteChirp(): void {
    const base = this.synth.rand(900, 1250);
    this.synth.tone({ type: 'triangle', freq: base, freqEnd: base * 1.45, duration: 0.09, gain: 0.028, attack: 0.012 });
    this.synth.tone({ type: 'sine', freq: base * 1.3, freqEnd: base * 0.9, duration: 0.1, gain: 0.018, attack: 0.008, delay: 0.075 });
  }

  public playCrystalMiteHit(): void {
    this.synth.noiseBurst({ duration: 0.11, filterType: 'bandpass', freq: 1100, freqEnd: 420, q: 1.5, gain: 0.055, attack: 0.004 });
    this.synth.tone({ type: 'square', freq: 520, freqEnd: 210, duration: 0.12, gain: 0.028, attack: 0.004 });
  }

  public playCrystalMiteDeath(): void {
    this.synth.noiseBurst({ duration: 0.3, filterType: 'bandpass', freq: 850, freqEnd: 180, q: 0.8, gain: 0.07, attack: 0.005 });
    this.synth.tone({ type: 'triangle', freq: 460, freqEnd: 95, duration: 0.34, gain: 0.05, attack: 0.008 });
  }

  public playCaveCrawlerGrowl(): void {
    this.synth.noiseBurst({ duration: 0.34, filterType: 'lowpass', freq: 520, freqEnd: 130, gain: 0.06, attack: 0.03 });
    this.synth.tone({ type: 'sawtooth', freq: 125, freqEnd: 72, duration: 0.38, gain: 0.035, attack: 0.025 });
  }

  public playCaveCrawlerHit(): void {
    this.synth.noiseBurst({ duration: 0.16, filterType: 'bandpass', freq: 680, freqEnd: 190, gain: 0.075, attack: 0.004 });
  }

  public playCaveCrawlerDeath(): void {
    this.synth.noiseBurst({ duration: 0.52, filterType: 'lowpass', freq: 600, freqEnd: 65, gain: 0.1, attack: 0.008 });
    this.synth.tone({ type: 'sawtooth', freq: 160, freqEnd: 45, duration: 0.5, gain: 0.045, attack: 0.01 });
  }
}
