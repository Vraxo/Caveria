import { SynthPrimitives } from './SynthPrimitives';

/** Inventory, pickup, crafting, and mode feedback recipes. */
export class UiSoundEffects {
  constructor(private readonly synth: SynthPrimitives) {}

  public playPickup(): void {
    this.synth.tone({ type: 'square', freq: 660, duration: 0.06, gain: 0.06 });
    this.synth.tone({ type: 'square', freq: 990, duration: 0.09, gain: 0.06, delay: 0.055 });
  }
  public playCrystalPickup(): void {
    this.synth.tone({ type: 'sine', freq: 1320, duration: 0.12, gain: 0.08 });
    this.synth.tone({ type: 'sine', freq: 1760, duration: 0.16, gain: 0.08, delay: 0.06 });
    this.synth.tone({ type: 'sine', freq: 2640, duration: 0.2, gain: 0.05, delay: 0.12 });
  }
  public playUiClick(): void { this.synth.tone({ type: 'square', freq: 880, duration: 0.045, gain: 0.05 }); }
  public playHotbarSelect(): void { this.synth.tone({ type: 'square', freq: 520, duration: 0.04, gain: 0.04 }); }
  public playInventoryOpen(): void {
    this.synth.noiseBurst({ duration: 0.14, filterType: 'bandpass', freq: 900, q: 1.4, gain: 0.08 });
    this.synth.tone({ type: 'triangle', freq: 340, freqEnd: 520, duration: 0.1, gain: 0.05 });
  }
  public playInventoryClose(): void {
    this.synth.noiseBurst({ duration: 0.12, filterType: 'bandpass', freq: 700, q: 1.4, gain: 0.07 });
    this.synth.tone({ type: 'triangle', freq: 520, freqEnd: 340, duration: 0.09, gain: 0.045 });
  }
  public playCraft(): void {
    this.synth.noiseBurst({ duration: 0.08, filterType: 'bandpass', freq: 1200, q: 1.6, gain: 0.1 });
    this.synth.tone({ type: 'square', freq: 740, duration: 0.07, gain: 0.05, delay: 0.05 });
    this.synth.tone({ type: 'square', freq: 1100, duration: 0.1, gain: 0.05, delay: 0.11 });
  }
  public playToss(): void { this.synth.noiseBurst({ duration: 0.12, filterType: 'bandpass', freq: 600, freqEnd: 1400, q: 1.4, gain: 0.08 }); }
  public playArmorEquip(): void {
    this.synth.noiseBurst({ duration: 0.12, filterType: 'bandpass', freq: 420, q: 1.1, gain: 0.09 });
    this.synth.tone({ type: 'triangle', freq: 180, freqEnd: 240, duration: 0.12, gain: 0.045 });
  }
  public playEat(): void {
    for (let bite = 0; bite < 3; bite++) {
      this.synth.noiseBurst({
        duration: 0.07,
        filterType: 'bandpass',
        freq: 520 + bite * 90,
        q: 1.2,
        gain: 0.075,
        delay: bite * 0.075,
      });
    }
    this.synth.tone({ type: 'triangle', freq: 260, freqEnd: 390, duration: 0.1, gain: 0.04, delay: 0.2 });
  }
  public playToolBreak(): void {
    this.synth.noiseBurst({ duration: 0.16, filterType: 'bandpass', freq: 1600, q: 1.8, gain: 0.18 });
    this.synth.tone({ type: 'square', freq: 300, freqEnd: 140, duration: 0.14, gain: 0.08 });
  }
  public playModeToggle(): void {
    this.synth.tone({ type: 'square', freq: 440, duration: 0.06, gain: 0.05 });
    this.synth.tone({ type: 'square', freq: 660, duration: 0.08, gain: 0.05, delay: 0.06 });
  }
}
