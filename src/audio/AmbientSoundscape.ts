import { SynthPrimitives } from './SynthPrimitives';
import { WebAudioEngine } from './WebAudioEngine';

export interface AmbientState {
  underground: boolean;
  underwater: boolean;
  skyBrightness: number;
  precipitation?: number;
  storm?: boolean;
  exposedToSky?: boolean;
}

/** Persistent wind bed and scheduled environmental one-shots. */
export class AmbientSoundscape {
  private windSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private rainSource: AudioBufferSourceNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private rainGain: GainNode | null = null;
  private birdTimer = 2.5;
  private dripTimer = 1.2;
  private cricketTimer = 0.8;
  private bubbleTimer = 0.4;
  private active = false;

  constructor(private readonly engine: WebAudioEngine, private readonly synth: SynthPrimitives) {}

  public setActive(active: boolean): void {
    this.active = active;
    const context = this.engine.context;
    if (!active && context) {
      const time = context.currentTime;
      this.windGain?.gain.setTargetAtTime(0, time, 0.025);
      this.rainGain?.gain.setTargetAtTime(0, time, 0.025);
    }
    if (active) {
      this.start();
    }
  }

  public start(): void {
    const context = this.engine.context;
    const destination = this.engine.ambientGain;
    const noise = this.engine.noiseBuffer;
    if (!context || !destination || !noise || this.windSource) return;

    const source = context.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    source.playbackRate.value = 0.5;
    this.windFilter = context.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 420;
    this.windFilter.Q.value = 0.6;
    this.windGain = context.createGain();
    this.windGain.gain.value = this.active ? 0.05 : 0;
    source.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(destination);
    source.start();
    this.windSource = source;

    const rainSource = context.createBufferSource();
    rainSource.buffer = noise;
    rainSource.loop = true;
    rainSource.playbackRate.value = 1.35;
    this.rainFilter = context.createBiquadFilter();
    this.rainFilter.type = 'highpass';
    this.rainFilter.frequency.value = 1050;
    this.rainGain = context.createGain();
    this.rainGain.gain.value = 0;
    rainSource.connect(this.rainFilter);
    this.rainFilter.connect(this.rainGain);
    this.rainGain.connect(destination);
    rainSource.start();
    this.rainSource = rainSource;
  }

  public update(dt: number, state: AmbientState): void {
    if (!this.active) return;
    const context = this.engine.context;
    if (!context || !this.windGain || !this.windFilter) return;
    const time = context.currentTime;
    const precipitation = state.precipitation ?? 0;
    const weatherAudibility = state.underground
      ? 0.08
      : state.exposedToSky === false
        ? 0.28
        : 1;
    if (this.rainGain && this.rainFilter) {
      this.rainGain.gain.setTargetAtTime(precipitation * weatherAudibility * 0.16, time, 0.35);
      this.rainFilter.frequency.setTargetAtTime(state.underwater ? 2600 : 1050, time, 0.4);
    }
    let windTarget = 0.045 + state.skyBrightness * 0.05 + (state.storm ? precipitation * 0.09 : 0);
    if (state.underground) windTarget = 0.012;
    if (state.underwater) windTarget = 0.02;
    const gust = 1 + Math.sin(time * 0.35) * 0.35 + Math.sin(time * 0.13 + 1.7) * 0.25;
    this.windGain.gain.setTargetAtTime(windTarget * gust, time, 0.4);
    this.windFilter.frequency.setTargetAtTime(
      state.underwater ? 300 : 380 + state.skyBrightness * 220 + Math.sin(time * 0.5) * 60,
      time,
      0.5
    );

    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = this.synth.rand(2.2, 7.5);
      if (!state.underground && !state.underwater && state.skyBrightness > 0.55 && precipitation < 0.15) this.playBird();
    }
    this.dripTimer -= dt;
    if (this.dripTimer <= 0) {
      this.dripTimer = this.synth.rand(0.7, 3.2);
      if (state.underground && !state.underwater) this.playDrip();
    }
    this.cricketTimer -= dt;
    if (this.cricketTimer <= 0) {
      this.cricketTimer = this.synth.rand(0.5, 1.4);
      if (!state.underground && !state.underwater && state.skyBrightness < 0.3 && precipitation < 0.15) this.playCricket();
    }
    this.bubbleTimer -= dt;
    if (this.bubbleTimer <= 0) {
      this.bubbleTimer = this.synth.rand(0.25, 0.9);
      if (state.underwater) this.playBubble();
    }
  }

  public playThunder(intensity: number): void {
    if (!this.active) return;
    const gain = Math.max(0.05, Math.min(1, intensity));
    this.synth.noiseBurst({
      duration: 2.8,
      filterType: 'lowpass',
      freq: 420,
      freqEnd: 55,
      gain: 0.22 * gain,
      attack: 0.025,
      delay: 0.18,
      bus: 'ambient',
    });
    this.synth.noiseBurst({
      duration: 1.5,
      filterType: 'bandpass',
      freq: 900,
      freqEnd: 120,
      q: 0.45,
      gain: 0.1 * gain,
      attack: 0.01,
      delay: 0.12,
      bus: 'ambient',
    });
    this.synth.tone({
      type: 'sine',
      freq: 82,
      freqEnd: 34,
      duration: 2.3,
      gain: 0.13 * gain,
      attack: 0.02,
      delay: 0.16,
      bus: 'ambient',
    });
  }

  public dispose(): void {
    try { this.windSource?.stop(); } catch { /* already stopped */ }
    try { this.rainSource?.stop(); } catch { /* already stopped */ }
    this.windSource = null;
    this.windFilter = null;
    this.windGain = null;
    this.rainSource = null;
    this.rainFilter = null;
    this.rainGain = null;
  }

  private playBird(): void {
    const context = this.engine.context;
    const destination = this.engine.ambientGain;
    if (!context || !destination) return;
    const startTime = context.currentTime;
    const base = this.synth.rand(2400, 3600);
    const notes = 2 + Math.floor(this.synth.rand(0, 3));
    for (let i = 0; i < notes; i++) {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      const start = startTime + i * 0.11;
      oscillator.frequency.setValueAtTime(base * this.synth.rand(0.95, 1.15), start);
      oscillator.frequency.exponentialRampToValueAtTime(base * this.synth.rand(1.2, 1.5), start + 0.05);
      oscillator.frequency.exponentialRampToValueAtTime(base * 0.9, start + 0.09);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.035, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.1);
      oscillator.connect(gain);
      gain.connect(destination);
      oscillator.start(start);
      oscillator.stop(start + 0.12);
    }
  }

  private playDrip(): void {
    const context = this.engine.context;
    if (!context) return;
    const frequency = this.synth.rand(900, 1500);
    this.synth.tone({ type: 'sine', freq: frequency, freqEnd: frequency * 0.45, duration: 0.22, gain: 0.07, attack: 0.008, bus: 'ambient' });
    this.synth.tone({ type: 'sine', freq: frequency * 0.8, freqEnd: frequency * 0.4, duration: 0.18, gain: 0.025, attack: 0.005, delay: 0.18, bus: 'ambient' });
  }

  private playCricket(): void {
    const frequency = this.synth.rand(4200, 4800);
    for (let i = 0; i < 3; i++) {
      this.synth.tone({ type: 'sine', freq: frequency, duration: 0.05, gain: 0.016, attack: 0.01, delay: i * 0.07, bus: 'ambient' });
    }
  }

  private playBubble(): void {
    const frequency = this.synth.rand(500, 900);
    this.synth.tone({ type: 'sine', freq: frequency, freqEnd: frequency * 1.8, duration: 0.1, gain: 0.03, attack: 0.015, bus: 'ambient' });
  }
}
