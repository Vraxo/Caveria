import { BlockId } from '../content/BlockId';
import { getBlockSoundMaterial } from './BlockSoundProfiles';
import { SynthPrimitives } from './SynthPrimitives';
import { WebAudioEngine } from './WebAudioEngine';

export class MovementSoundEffects {
  private lastStep = 0;
  private alternateStep = false;

  constructor(private readonly engine: WebAudioEngine, private readonly synth: SynthPrimitives) {}

  public playStep(block: BlockId, sprinting: boolean): void {
    const context = this.engine.context;
    if (!context || context.currentTime - this.lastStep < 0.16) return;
    this.lastStep = context.currentTime;
    this.alternateStep = !this.alternateStep;
    const pitch = this.alternateStep ? 1 : 0.88;
    const volume = sprinting ? 0.13 : 0.09;

    switch (getBlockSoundMaterial(block)) {
      case 'stone':
        this.synth.noiseBurst({ duration: 0.06, filterType: 'bandpass', freq: 1800 * pitch, q: 2, gain: volume });
        break;
      case 'wood':
        this.synth.noiseBurst({ duration: 0.07, filterType: 'bandpass', freq: 650 * pitch, q: 1.6, gain: volume * 1.2 });
        break;
      case 'leaves':
        this.synth.noiseBurst({ duration: 0.11, filterType: 'highpass', freq: 3000, gain: volume * 0.8 });
        break;
      case 'glass':
        this.synth.noiseBurst({ duration: 0.06, filterType: 'highpass', freq: 5200, gain: volume * 0.7 });
        break;
      case 'sand':
      case 'snow':
        this.synth.noiseBurst({ duration: 0.12, filterType: 'lowpass', freq: 600 * pitch, gain: volume * 1.1 });
        break;
      default:
        this.synth.noiseBurst({ duration: 0.08, filterType: 'lowpass', freq: 750 * pitch, gain: volume });
    }
  }

  public playJump(): void {
    this.synth.noiseBurst({ duration: 0.09, filterType: 'bandpass', freq: 500, q: 1.2, gain: 0.07 });
  }

  public playLand(hard: boolean): void {
    this.synth.noiseBurst({
      duration: hard ? 0.18 : 0.1,
      filterType: 'lowpass',
      freq: hard ? 900 : 700,
      freqEnd: 220,
      gain: hard ? 0.22 : 0.12,
    });
    if (hard) this.synth.tone({ type: 'triangle', freq: 160, freqEnd: 80, duration: 0.14, gain: 0.1 });
  }

  public playSplash(): void {
    this.synth.noiseBurst({ duration: 0.4, filterType: 'lowpass', freq: 1600, freqEnd: 350, gain: 0.24 });
    this.synth.noiseBurst({ duration: 0.22, filterType: 'bandpass', freq: 1100, q: 1.2, gain: 0.1, delay: 0.08 });
  }
}
