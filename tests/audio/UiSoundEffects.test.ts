import { describe, expect, it, vi } from 'vitest';
import { UiSoundEffects } from '../../src/audio/UiSoundEffects';
import type { SynthPrimitives } from '../../src/audio/SynthPrimitives';

describe('UI sound effects', () => {
  it('makes button clicks short, low, and thocky instead of a high-pitched beep', () => {
    const synth = {
      noiseBurst: vi.fn(),
      tone: vi.fn(),
    } as unknown as SynthPrimitives;

    new UiSoundEffects(synth).playUiClick();

    expect(synth.noiseBurst).toHaveBeenCalledWith(expect.objectContaining({
      duration: 0.04,
      filterType: 'lowpass',
      freq: 420,
      freqEnd: 180,
    }));
    expect(synth.tone).toHaveBeenCalledWith(expect.objectContaining({
      type: 'triangle',
      freq: 210,
      freqEnd: 105,
      duration: 0.07,
    }));
    expect(synth.noiseBurst).toHaveBeenCalledTimes(2);
  });
});
