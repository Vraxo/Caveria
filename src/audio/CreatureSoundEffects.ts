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

  public playChickenCluck(): void {
    this.synth.tone({ type: 'square', freq: 540, freqEnd: 380, duration: 0.08, gain: 0.025, attack: 0.008 });
    this.synth.tone({ type: 'triangle', freq: 420, freqEnd: 610, duration: 0.07, gain: 0.02, attack: 0.006, delay: 0.07 });
  }

  public playChickenHit(): void {
    this.synth.noiseBurst({ duration: 0.1, filterType: 'bandpass', freq: 950, freqEnd: 420, gain: 0.045, attack: 0.004 });
  }

  public playChickenDeath(): void {
    this.synth.tone({ type: 'square', freq: 480, freqEnd: 120, duration: 0.3, gain: 0.035, attack: 0.006 });
  }

  public playSheepBleat(): void {
    this.synth.tone({ type: 'sawtooth', freq: 210, freqEnd: 145, duration: 0.32, gain: 0.028, attack: 0.035 });
    this.synth.tone({ type: 'triangle', freq: 310, freqEnd: 190, duration: 0.26, gain: 0.018, attack: 0.025, delay: 0.05 });
  }

  public playSheepHit(): void {
    this.synth.noiseBurst({ duration: 0.13, filterType: 'bandpass', freq: 520, freqEnd: 180, gain: 0.055, attack: 0.004 });
  }

  public playSheepDeath(): void {
    this.synth.tone({ type: 'sawtooth', freq: 190, freqEnd: 65, duration: 0.42, gain: 0.04, attack: 0.01 });
  }

  public playRabbitSqueak(): void {
    this.synth.tone({ type: 'triangle', freq: 720, freqEnd: 940, duration: 0.09, gain: 0.018, attack: 0.01 });
  }

  public playRabbitHit(): void {
    this.synth.tone({ type: 'square', freq: 680, freqEnd: 330, duration: 0.12, gain: 0.026, attack: 0.004 });
  }

  public playRabbitDeath(): void {
    this.synth.tone({ type: 'triangle', freq: 620, freqEnd: 140, duration: 0.28, gain: 0.03, attack: 0.006 });
  }

  public playCamelCall(): void {
    this.synth.tone({ type: 'sawtooth', freq: 155, freqEnd: 105, duration: 0.48, gain: 0.03, attack: 0.04 });
    this.synth.tone({ type: 'triangle', freq: 230, freqEnd: 150, duration: 0.34, gain: 0.018, attack: 0.03, delay: 0.1 });
  }

  public playScorpionChitter(): void {
    this.synth.noiseBurst({ duration: 0.12, filterType: 'highpass', freq: 1800, freqEnd: 900, gain: 0.025, attack: 0.003 });
  }

  public playSnakeHiss(): void {
    this.synth.noiseBurst({ duration: 0.34, filterType: 'bandpass', freq: 2400, freqEnd: 1200, q: 0.8, gain: 0.035, attack: 0.04 });
  }

  public playLizardChirp(): void {
    this.synth.tone({ type: 'triangle', freq: 820, freqEnd: 1120, duration: 0.07, gain: 0.014, attack: 0.008 });
  }

  public playVultureCry(): void {
    this.synth.tone({ type: 'sawtooth', freq: 680, freqEnd: 310, duration: 0.42, gain: 0.023, attack: 0.025 });
  }

  public playDesertWildlifeHit(): void {
    this.synth.noiseBurst({ duration: 0.11, filterType: 'bandpass', freq: 760, freqEnd: 260, gain: 0.045, attack: 0.004 });
  }

  public playDesertWildlifeDeath(): void {
    this.synth.tone({ type: 'triangle', freq: 390, freqEnd: 85, duration: 0.35, gain: 0.032, attack: 0.006 });
  }

  public playPolarBearGrowl(): void {
    this.synth.noiseBurst({ duration: 0.42, filterType: 'lowpass', freq: 340, freqEnd: 95, gain: 0.045, attack: 0.05 });
    this.synth.tone({ type: 'sawtooth', freq: 94, freqEnd: 60, duration: 0.46, gain: 0.032, attack: 0.04 });
  }

  public playPolarBearRoar(): void {
    this.synth.noiseBurst({ duration: 0.54, filterType: 'bandpass', freq: 420, freqEnd: 115, q: 0.9, gain: 0.085, attack: 0.02 });
    this.synth.tone({ type: 'sawtooth', freq: 148, freqEnd: 62, duration: 0.56, gain: 0.052, attack: 0.018 });
    this.synth.tone({ type: 'triangle', freq: 205, freqEnd: 82, duration: 0.44, gain: 0.03, attack: 0.015, delay: 0.04 });
  }

  public playPolarBearHit(): void {
    this.synth.noiseBurst({ duration: 0.16, filterType: 'lowpass', freq: 440, freqEnd: 140, gain: 0.068, attack: 0.005 });
    this.synth.tone({ type: 'sawtooth', freq: 132, freqEnd: 74, duration: 0.18, gain: 0.036, attack: 0.006 });
  }

  public playPolarBearDeath(): void {
    this.synth.noiseBurst({ duration: 0.62, filterType: 'lowpass', freq: 380, freqEnd: 60, gain: 0.088, attack: 0.01 });
    this.synth.tone({ type: 'sawtooth', freq: 120, freqEnd: 42, duration: 0.64, gain: 0.048, attack: 0.012 });
  }
}
