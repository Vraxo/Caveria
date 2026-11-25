import { SynthPrimitives } from './SynthPrimitives';
import { WebAudioEngine } from './WebAudioEngine';

export interface AmbientState {
  underground: boolean;
  underwater: boolean;
  skyBrightness: number;
}

/** Persistent wind bed and scheduled environmental one-shots. */
export class AmbientSoundscape {
  private windSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private birdTimer = 2.5;
  private dripTimer = 1.2;
  private cricketTimer = 0.8;
  private bubbleTimer = 0.4;

  constructor(private readonly engine: WebAudioEngine, private readonly synth: SynthPrimitives) {}

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
    this.windGain.gain.value = 0.05;
    source.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(destination);
    source.start();
    this.windSource = source;
  }

  public update(dt: number, state: AmbientState): void {
    const context = this.engine.context;
    if (!context || !this.windGain || !this.windFilter) return;
    const time = context.currentTime;
    let windTarget = 0.045 + state.skyBrightness * 0.05;
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
      if (!state.underground && !state.underwater && state.skyBrightness > 0.55) this.playBird();
    }
    this.dripTimer -= dt;
    if (this.dripTimer <= 0) {
      this.dripTimer = this.synth.rand(0.7, 3.2);
      if (state.underground && !state.underwater) this.playDrip();
    }
    this.cricketTimer -= dt;
    if (this.cricketTimer <= 0) {
      this.cricketTimer = this.synth.rand(0.5, 1.4);
      if (!state.underground && !state.underwater && state.skyBrightness < 0.3) this.playCricket();
    }
    this.bubbleTimer -= dt;
    if (this.bubbleTimer <= 0) {
      this.bubbleTimer = this.synth.rand(0.25, 0.9);
      if (state.underwater) this.playBubble();
    }
  }

  public dispose(): void {
    try { this.windSource?.stop(); } catch { /* already stopped */ }
    this.windSource = null;
    this.windFilter = null;
    this.windGain = null;
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
