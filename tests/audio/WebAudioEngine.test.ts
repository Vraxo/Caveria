import { describe, expect, it } from 'vitest';
import { WebAudioEngine } from '../../src/audio/WebAudioEngine';

describe('WebAudioEngine volumes', () => {
  it('starts with the default SFX and ambience volumes', () => {
    const engine = new WebAudioEngine();
    expect(engine.getSfxVolume()).toBe(90);
    expect(engine.getAmbienceVolume()).toBe(55);
  });

  it('clamps SFX and ambience volumes to 0..100 and reports them back', () => {
    const engine = new WebAudioEngine();
    engine.setSfxVolume(120);
    expect(engine.getSfxVolume()).toBe(100);
    engine.setSfxVolume(-5);
    expect(engine.getSfxVolume()).toBe(0);
    engine.setAmbienceVolume(42.6);
    expect(engine.getAmbienceVolume()).toBe(43);
    engine.setAmbienceVolume(200);
    expect(engine.getAmbienceVolume()).toBe(100);
  });
});
