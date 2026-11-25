import { BlockId } from '../content/BlockId';
import { getBlockSoundMaterial } from './BlockSoundProfiles';
import { SynthPrimitives } from './SynthPrimitives';
import { WebAudioEngine } from './WebAudioEngine';

/** Material-aware mining, breaking, and placement recipes. */
export class BlockSoundEffects {
  private lastMineHit = 0;

  constructor(private readonly engine: WebAudioEngine, private readonly synth: SynthPrimitives) {}

  public playMineHit(block: BlockId): void {
    const context = this.engine.context;
    if (!context || context.currentTime - this.lastMineHit < 0.11) return;
    this.lastMineHit = context.currentTime;

    switch (getBlockSoundMaterial(block)) {
      case 'stone':
        this.synth.noiseBurst({ duration: 0.07, filterType: 'bandpass', freq: this.synth.rand(2400, 3400), q: 2.2, gain: 0.16 });
        this.synth.tone({ type: 'square', freq: this.synth.rand(680, 920), freqEnd: this.synth.rand(420, 560), duration: 0.06, gain: 0.05 });
        break;
      case 'wood':
        this.synth.noiseBurst({ duration: 0.08, filterType: 'bandpass', freq: this.synth.rand(700, 1000), q: 1.6, gain: 0.2 });
        this.synth.tone({ type: 'triangle', freq: this.synth.rand(170, 230), freqEnd: 110, duration: 0.09, gain: 0.14 });
        break;
      case 'leaves':
        this.synth.noiseBurst({ duration: 0.14, filterType: 'highpass', freq: 3200, gain: 0.1 });
        break;
      case 'glass':
        this.synth.noiseBurst({ duration: 0.1, filterType: 'highpass', freq: 5200, gain: 0.14 });
        this.synth.tone({ type: 'sine', freq: this.synth.rand(2200, 2800), freqEnd: 1400, duration: 0.12, gain: 0.06 });
        break;
      case 'crystal':
        this.synth.tone({ type: 'sine', freq: this.synth.rand(1500, 2100), freqEnd: this.synth.rand(1100, 1400), duration: 0.16, gain: 0.1 });
        this.synth.tone({ type: 'sine', freq: this.synth.rand(2600, 3200), duration: 0.1, gain: 0.05 });
        this.synth.noiseBurst({ duration: 0.05, filterType: 'highpass', freq: 6000, gain: 0.06 });
        break;
      case 'flora':
      case 'spike':
        this.synth.noiseBurst({ duration: 0.07, filterType: 'bandpass', freq: this.synth.rand(1100, 1600), q: 1.4, gain: 0.1 });
        break;
      case 'water':
        this.synth.noiseBurst({ duration: 0.16, filterType: 'lowpass', freq: 900, freqEnd: 300, gain: 0.12 });
        break;
      default:
        this.synth.noiseBurst({ duration: 0.09, filterType: 'lowpass', freq: this.synth.rand(500, 800), gain: 0.16 });
    }
  }

  public playBreak(block: BlockId): void {
    switch (getBlockSoundMaterial(block)) {
      case 'stone':
        this.synth.noiseBurst({ duration: 0.22, filterType: 'lowpass', freq: 1800, freqEnd: 300, gain: 0.3 });
        this.synth.noiseBurst({ duration: 0.1, filterType: 'bandpass', freq: 2600, q: 2, gain: 0.16 });
        this.synth.tone({ type: 'square', freq: 320, freqEnd: 120, duration: 0.14, gain: 0.08 });
        break;
      case 'wood':
        this.synth.noiseBurst({ duration: 0.2, filterType: 'bandpass', freq: 800, q: 1.2, gain: 0.28 });
        this.synth.tone({ type: 'triangle', freq: 200, freqEnd: 90, duration: 0.18, gain: 0.16 });
        break;
      case 'leaves':
        this.synth.noiseBurst({ duration: 0.3, filterType: 'highpass', freq: 2400, gain: 0.16 });
        break;
      case 'glass':
        this.synth.noiseBurst({ duration: 0.35, filterType: 'highpass', freq: 4200, gain: 0.24 });
        this.synth.tone({ type: 'sine', freq: 2800, freqEnd: 900, duration: 0.3, gain: 0.1 });
        this.synth.tone({ type: 'sine', freq: 3600, freqEnd: 1200, duration: 0.22, gain: 0.07, delay: 0.04 });
        break;
      case 'crystal':
        this.synth.tone({ type: 'sine', freq: 1800, freqEnd: 900, duration: 0.35, gain: 0.14 });
        this.synth.tone({ type: 'sine', freq: 2700, freqEnd: 1400, duration: 0.28, gain: 0.09, delay: 0.05 });
        this.synth.noiseBurst({ duration: 0.18, filterType: 'highpass', freq: 5000, gain: 0.1 });
        break;
      case 'flora':
        this.synth.tone({ type: 'sine', freq: 700, freqEnd: 300, duration: 0.12, gain: 0.1 });
        this.synth.noiseBurst({ duration: 0.1, filterType: 'bandpass', freq: 1400, gain: 0.08 });
        break;
      default:
        this.synth.noiseBurst({ duration: 0.2, filterType: 'lowpass', freq: 1100, freqEnd: 250, gain: 0.26 });
    }
  }

  public playPlace(block: BlockId): void {
    switch (getBlockSoundMaterial(block)) {
      case 'stone':
        this.synth.noiseBurst({ duration: 0.1, filterType: 'bandpass', freq: 2000, q: 1.8, gain: 0.2 });
        this.synth.tone({ type: 'square', freq: 480, freqEnd: 260, duration: 0.07, gain: 0.06 });
        break;
      case 'wood':
        this.synth.noiseBurst({ duration: 0.1, filterType: 'bandpass', freq: 750, q: 1.5, gain: 0.22 });
        this.synth.tone({ type: 'triangle', freq: 220, freqEnd: 130, duration: 0.09, gain: 0.12 });
        break;
      case 'glass':
        this.synth.tone({ type: 'sine', freq: 2400, freqEnd: 1600, duration: 0.12, gain: 0.08 });
        this.synth.noiseBurst({ duration: 0.08, filterType: 'highpass', freq: 5000, gain: 0.08 });
        break;
      case 'crystal':
        this.synth.tone({ type: 'sine', freq: 1600, freqEnd: 1100, duration: 0.2, gain: 0.1 });
        break;
      case 'flora':
        this.synth.tone({ type: 'sine', freq: 520, freqEnd: 340, duration: 0.08, gain: 0.09 });
        break;
      default:
        this.synth.noiseBurst({ duration: 0.1, filterType: 'lowpass', freq: 800, freqEnd: 350, gain: 0.2 });
    }
  }
}
