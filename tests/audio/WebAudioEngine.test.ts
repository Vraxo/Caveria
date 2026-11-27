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

  it('keeps world audio inactive until enabled and silences ambience when returning to menu', () => {
    const engine = new WebAudioEngine();
    expect(engine.worldAudioActive).toBe(false);

    engine.setWorldAudioActive(true);
    expect(engine.worldAudioActive).toBe(true);

    engine.setWorldAudioActive(false);
    expect(engine.worldAudioActive).toBe(false);
    // Adjusting ambience slider in title options keeps stored value without re-enabling world audio.
    engine.setAmbienceVolume(75);
    expect(engine.getAmbienceVolume()).toBe(75);
    expect(engine.worldAudioActive).toBe(false);
  });
});
