import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { BlockId } from '../content/BlockId';
import { Player } from '../player/Player';
import { SurfaceBiome } from '../world/TerrainGen';
import { World } from '../world/World';

export type WeatherPhase = 'clear' | 'rain' | 'storm';
export type LocalWeather = 'Clear' | 'Rain' | 'Thunderstorm' | 'Snow' | 'Snowstorm';

export interface WeatherSnapshot {
  phase: WeatherPhase;
  intensity: number;
  timeRemaining: number;
}

const PARTICLE_COUNT = 1100;
const PRECIPITATION_RADIUS = 20;
const COLD_BIOMES = new Set<SurfaceBiome>(['Snowy Taiga', 'Alpine Peaks']);

/** Owns natural weather transitions, biome-aware precipitation, lightning, and local particles. */
export class WeatherSystem {
  public phase: WeatherPhase = 'clear';
  public intensity = 0;
  public timeRemaining = 55 + Math.random() * 70;
  public lightningFlash = 0;

  private readonly geometry = new THREE.BufferGeometry();
  private readonly positions = new Float32Array(PARTICLE_COUNT * 3);
  private readonly driftSeeds = new Float32Array(PARTICLE_COUNT);
  private readonly rainTexture = this.createRainTexture();
  private readonly snowTexture = this.createSnowTexture();
  private readonly material = new THREE.PointsMaterial({
    map: this.rainTexture,
    color: 0xaed8ff,
    size: 0.62,
    transparent: true,
    opacity: 0,
    alphaTest: 0.08,
    depthWrite: false,
    sizeAttenuation: true,
    fog: true,
  });
  private readonly particles: THREE.Points;
  private lightningTimer = 4;
  private elapsed = 0;
  private particleMode: 'rain' | 'snow' = 'rain';

  constructor(
    scene: THREE.Scene,
    private readonly world: World,
    private readonly player: Player,
    private readonly audio: AudioManager
  ) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.driftSeeds[i] = Math.random() * Math.PI * 2;
      this.resetParticle(i, true);
    }
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setDrawRange(0, 0);
    this.particles = new THREE.Points(this.geometry, this.material);
    this.particles.frustumCulled = false;
    this.particles.renderOrder = 5;
    scene.add(this.particles);
  }

  public restore(snapshot: WeatherSnapshot | undefined): void {
    if (!snapshot) return;
    this.phase = snapshot.phase;
    this.intensity = Math.max(0, Math.min(1, snapshot.intensity));
    this.timeRemaining = Math.max(1, snapshot.timeRemaining);
  }

  public snapshot(): WeatherSnapshot {
    return {
      phase: this.phase,
      intensity: this.intensity,
      timeRemaining: this.timeRemaining,
    };
  }

  public update(dt: number): void {
    this.elapsed += dt;
    this.timeRemaining -= dt;
    if (this.timeRemaining <= 0) this.advanceNaturalCycle();

    const targetIntensity = this.phase === 'clear' ? 0 : this.phase === 'storm' ? 1 : 0.72;
    this.intensity += (targetIntensity - this.intensity) * (1 - Math.exp(-0.32 * dt));
    if (this.intensity < 0.002) this.intensity = 0;

    this.lightningFlash = Math.max(0, this.lightningFlash - dt * 3.8);
    if (this.phase === 'storm' && this.intensity > 0.55) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) this.triggerLightning();
    }

    this.updateParticles(dt);
  }

  public clearOrdinaryRain(): void {
    if (this.phase !== 'rain') return;
    this.phase = 'clear';
    this.intensity = 0;
    this.timeRemaining = 75 + Math.random() * 100;
  }

  /** Cycles weather for players who want to preview or override the natural schedule. */
  public cycleWeather(): void {
    this.phase = this.phase === 'clear' ? 'rain' : this.phase === 'rain' ? 'storm' : 'clear';
    this.timeRemaining = this.phase === 'clear' ? 75 : this.phase === 'storm' ? 80 : 140;
    this.lightningTimer = 2.5 + Math.random() * 4;
  }

  public get cloudCover(): number {
    const cover = this.phase === 'storm' ? 0.92 : 0.7;
    return this.intensity * cover;
  }

  public get localWeather(): LocalWeather {
    if (this.intensity < 0.08) return 'Clear';
    const snowing = COLD_BIOMES.has(this.getSurfaceBiome());
    if (snowing) return this.phase === 'storm' ? 'Snowstorm' : 'Snow';
    return this.phase === 'storm' ? 'Thunderstorm' : 'Rain';
  }

  public get exposedToSky(): boolean {
    const packed = this.world.getPackedLight(
      this.player.position.x,
      this.player.position.y + this.player.eyeHeight,
      this.player.position.z
    );
    return ((packed >> 4) & 0xf) >= 14;
  }

  /** Wet ground and driving snow have a small, readable traversal cost. */
  public getMovementSpeedMultiplier(coldResistant = false): number {
    if (!this.exposedToSky || this.intensity < 0.12) return 1;
    const local = this.localWeather;
    const snowing = local === 'Snow' || local === 'Snowstorm';
    const weatherPenalty = snowing ? (coldResistant ? 0.07 : 0.12) : 0.06;
    const stormPenalty = this.phase === 'storm' ? 0.04 : 0;
    return 1 - (weatherPenalty + stormPenalty) * this.intensity;
  }

  public getAmbientState(): { precipitation: number; storm: boolean; exposedToSky: boolean } {
    return {
      precipitation: this.intensity,
      storm: this.phase === 'storm',
      exposedToSky: this.exposedToSky,
    };
  }

  private advanceNaturalCycle(): void {
    if (this.phase === 'clear') {
      this.phase = Math.random() < 0.28 ? 'storm' : 'rain';
      this.timeRemaining = this.phase === 'storm' ? 55 + Math.random() * 55 : 100 + Math.random() * 130;
    } else {
      this.phase = 'clear';
      this.timeRemaining = 75 + Math.random() * 150;
    }
    this.lightningTimer = 3 + Math.random() * 7;
  }

  private triggerLightning(): void {
    this.lightningFlash = 1;
    this.lightningTimer = 5 + Math.random() * 13;
    const shelterAttenuation = this.exposedToSky ? 1 : 0.3;
    this.audio.playThunder((0.72 + Math.random() * 0.28) * shelterAttenuation);
  }

  private updateParticles(dt: number): void {
    const local = this.localWeather;
    const snowing = local === 'Snow' || local === 'Snowstorm';
    const mode = snowing ? 'snow' : 'rain';
    if (mode !== this.particleMode) {
      this.particleMode = mode;
      this.material.map = snowing ? this.snowTexture : this.rainTexture;
      this.material.color.setHex(snowing ? 0xffffff : 0xaed8ff);
      this.material.size = snowing ? 0.34 : 0.62;
      this.material.needsUpdate = true;
      for (let i = 0; i < PARTICLE_COUNT; i++) this.resetParticle(i, true);
    }

    const surfaceY = this.world.terrainGen.getSurfaceHeight(
      Math.floor(this.player.position.x),
      Math.floor(this.player.position.z)
    );
    const deepUnderground = this.player.position.y < surfaceY - 4 && !this.exposedToSky;
    const precipitationHidden = deepUnderground || this.player.isHeadUnderwater(this.world);
    const active =
      local === 'Clear' || precipitationHidden ? 0 : Math.floor(PARTICLE_COUNT * this.intensity);
    this.geometry.setDrawRange(0, active);
    this.material.opacity = Math.min(0.92, this.intensity * (snowing ? 0.9 : 0.72));
    this.particles.visible = active > 0;
    if (active === 0) return;

    const px = this.player.position.x;
    const py = this.player.position.y;
    const pz = this.player.position.z;
    for (let i = 0; i < active; i++) {
      const base = i * 3;
      if (snowing) {
        this.positions[base] += Math.sin(this.elapsed * 0.9 + this.driftSeeds[i]) * dt * 0.75;
        this.positions[base + 1] -= dt * 2.4;
        this.positions[base + 2] += Math.cos(this.elapsed * 0.65 + this.driftSeeds[i]) * dt * 0.45;
      } else {
        this.positions[base] += dt * 2.1;
        this.positions[base + 1] -= dt * 27;
        this.positions[base + 2] += dt * 0.65;
      }

      const dx = this.positions[base] - px;
      const dz = this.positions[base + 2] - pz;
      const block = this.world.getBlock(
        this.positions[base],
        this.positions[base + 1],
        this.positions[base + 2]
      );
      if (
        this.positions[base + 1] < py - 9 ||
        this.positions[base + 1] > py + 34 ||
        dx * dx + dz * dz > PRECIPITATION_RADIUS * PRECIPITATION_RADIUS ||
        block !== BlockId.Air
      ) {
        this.resetParticle(i, false);
      }
    }
    (this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  private resetParticle(index: number, initial: boolean): void {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * PRECIPITATION_RADIUS;
    const base = index * 3;
    this.positions[base] = this.player.position.x + Math.cos(angle) * radius;
    this.positions[base + 1] = this.player.position.y + (initial ? Math.random() * 30 - 7 : 17 + Math.random() * 15);
    this.positions[base + 2] = this.player.position.z + Math.sin(angle) * radius;
  }

  private getSurfaceBiome(): SurfaceBiome {
    const x = Math.floor(this.player.position.x);
    const z = Math.floor(this.player.position.z);
    return this.world.terrainGen.getSurfaceBiome(x, z);
  }

  private createRainTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(3, 0, 2, 13);
    ctx.globalAlpha = 0.45;
    ctx.fillRect(2, 2, 1, 10);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
  }

  private createSnowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(2, 1, 4, 6);
    ctx.fillRect(1, 2, 6, 4);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
  }
}
