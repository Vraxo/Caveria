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
  public playFurnaceIgnite(): void {
    this.synth.noiseBurst({ duration: 0.2, filterType: 'bandpass', freq: 560, freqEnd: 1100, q: 0.8, gain: 0.1 });
    this.synth.tone({ type: 'triangle', freq: 120, freqEnd: 190, duration: 0.18, gain: 0.045 });
  }
  public playFurnaceBurn(): void {
    this.synth.noiseBurst({ duration: 0.16, filterType: 'lowpass', freq: 720, q: 0.7, gain: 0.035 });
  }
  public playFurnaceComplete(): void {
    this.synth.tone({ type: 'sine', freq: 660, duration: 0.08, gain: 0.055 });
    this.synth.tone({ type: 'sine', freq: 880, duration: 0.12, gain: 0.05, delay: 0.07 });
  }
  public playSleep(): void {
    this.synth.tone({ type: 'sine', freq: 330, freqEnd: 220, duration: 0.5, gain: 0.045 });
    this.synth.tone({ type: 'sine', freq: 440, freqEnd: 294, duration: 0.65, gain: 0.035, delay: 0.16 });
  }
  public playChestOpen(): void {
    this.synth.noiseBurst({ duration: 0.13, filterType: 'lowpass', freq: 520, q: 0.9, gain: 0.075 });
    this.synth.tone({ type: 'triangle', freq: 150, freqEnd: 225, duration: 0.18, gain: 0.055 });
  }
  public playChestClose(): void {
    this.synth.noiseBurst({ duration: 0.1, filterType: 'lowpass', freq: 430, q: 0.8, gain: 0.08 });
    this.synth.tone({ type: 'triangle', freq: 210, freqEnd: 120, duration: 0.14, gain: 0.06 });
  }
  public playBowDraw(): void {
    this.synth.tone({ type: 'triangle', freq: 180, freqEnd: 260, duration: 0.3, gain: 0.035 });
  }
  public playBowRelease(): void {
    this.synth.noiseBurst({ duration: 0.08, filterType: 'bandpass', freq: 1100, q: 1.8, gain: 0.09 });
    this.synth.tone({ type: 'triangle', freq: 520, freqEnd: 190, duration: 0.13, gain: 0.055 });
  }
  public playArrowImpact(): void {
    this.synth.noiseBurst({ duration: 0.07, filterType: 'highpass', freq: 1500, q: 1.2, gain: 0.07 });
    this.synth.tone({ type: 'square', freq: 180, duration: 0.06, gain: 0.035 });
  }
  public playArrowHit(): void {
    this.synth.noiseBurst({ duration: 0.09, filterType: 'bandpass', freq: 850, q: 1.1, gain: 0.1 });
  }
  public playFishingCast(): void {
    this.synth.noiseBurst({ duration: 0.13, filterType: 'bandpass', freq: 900, freqEnd: 1800, q: 1.2, gain: 0.065 });
    this.synth.tone({ type: 'triangle', freq: 300, freqEnd: 520, duration: 0.16, gain: 0.035 });
  }
  public playFishingBite(): void {
    this.synth.noiseBurst({ duration: 0.12, filterType: 'highpass', freq: 1300, q: 0.8, gain: 0.1 });
    this.synth.tone({ type: 'sine', freq: 700, freqEnd: 980, duration: 0.11, gain: 0.055 });
  }
  public playFishingCatch(rare: boolean): void {
    this.synth.noiseBurst({ duration: 0.16, filterType: 'bandpass', freq: 780, freqEnd: 1500, q: 1, gain: 0.08 });
    this.synth.tone({ type: 'triangle', freq: rare ? 880 : 520, freqEnd: rare ? 1760 : 820, duration: rare ? 0.3 : 0.18, gain: 0.06 });
  }
  public playFishingFail(): void {
    this.synth.tone({ type: 'triangle', freq: 260, freqEnd: 150, duration: 0.16, gain: 0.04 });
  }
  public playDrink(): void {
    for (let gulp = 0; gulp < 3; gulp++) {
      this.synth.noiseBurst({ duration: 0.08, filterType: 'lowpass', freq: 520 + gulp * 80, q: 0.8, gain: 0.055, delay: gulp * 0.08 });
    }
  }
  public playMedicineUse(): void {
    this.synth.tone({ type: 'sine', freq: 520, duration: 0.08, gain: 0.05 });
    this.synth.tone({ type: 'sine', freq: 780, duration: 0.12, gain: 0.045, delay: 0.07 });
    this.synth.tone({ type: 'sine', freq: 1040, duration: 0.15, gain: 0.035, delay: 0.14 });
  }
  public playTemperatureWarning(cold: boolean): void {
    if (cold) {
      this.synth.noiseBurst({ duration: 0.22, filterType: 'highpass', freq: 1800, q: 1.2, gain: 0.035 });
      this.synth.tone({ type: 'triangle', freq: 150, freqEnd: 120, duration: 0.28, gain: 0.035 });
    } else {
      this.synth.noiseBurst({ duration: 0.25, filterType: 'lowpass', freq: 420, q: 0.7, gain: 0.045 });
    }
  }
  public playFarmGrowth(): void {
    this.synth.tone({ type: 'sine', freq: 520, freqEnd: 720, duration: 0.12, gain: 0.025 });
  }
  public playFarmAction(action: 'tilled' | 'planted' | 'harvested'): void {
    if (action === 'tilled') {
      this.synth.noiseBurst({ duration: 0.12, filterType: 'lowpass', freq: 520, q: 0.8, gain: 0.09 });
    } else if (action === 'planted') {
      this.synth.noiseBurst({ duration: 0.07, filterType: 'bandpass', freq: 760, q: 1.2, gain: 0.055 });
    } else {
      this.synth.noiseBurst({ duration: 0.11, filterType: 'highpass', freq: 1100, q: 0.8, gain: 0.075 });
      this.synth.tone({ type: 'triangle', freq: 480, freqEnd: 680, duration: 0.1, gain: 0.04 });
    }
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
