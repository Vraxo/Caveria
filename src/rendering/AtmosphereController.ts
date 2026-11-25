import * as THREE from 'three';
import { Player } from '../player/Player';
import { World } from '../world/World';
import { CHUNK_SIZE } from '../world/Chunk';
import { DayNightCycle } from './DayNightCycle';
import { WeatherSystem } from './WeatherSystem';

const UNDERWATER_FOG_COLOR = new THREE.Color(0x0b3c7c);
const OVERCAST_SKY_COLOR = new THREE.Color(0x586675);
const LIGHTNING_COLOR = new THREE.Color(0xdcecff);

/** Synchronizes day/night lighting, sky fog, and the underwater screen treatment. */
export class AtmosphereController {
  private readonly waterTintEl = document.getElementById('water-tint')!;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly world: World,
    private readonly player: Player,
    private readonly dayNight: DayNightCycle,
    private readonly weather: WeatherSystem
  ) {}

  public update(): void {
    const uniforms = this.world.lightUniforms;
    const cloudCover = this.weather.cloudCover;
    const lightning = this.weather.lightningFlash;
    uniforms.uSkyBrightness.value = Math.min(
      1.25,
      this.dayNight.skyBrightness * (1 - cloudCover * 0.42) + lightning * 0.62
    );
    uniforms.uSkyTint.value
      .copy(this.dayNight.skyLightTint)
      .lerp(LIGHTNING_COLOR, lightning * 0.78);
    uniforms.uTorchFlicker.value = this.dayNight.torchFlicker;

    const underwater = this.player.isHeadUnderwater(this.world);
    this.waterTintEl.classList.toggle('active', underwater);

    const fog = this.scene.fog as THREE.Fog;
    const maxDistance = this.world.renderDistance * CHUNK_SIZE;
    if (underwater) {
      const tintedWater = UNDERWATER_FOG_COLOR.clone().multiplyScalar(
        0.35 + 0.65 * this.dayNight.skyBrightness
      );
      this.renderer.setClearColor(tintedWater);
      fog.color.copy(tintedWater);
      fog.near = 2;
      fog.far = 26;
      return;
    }

    const weatherSky = this.dayNight.skyColor
      .clone()
      .lerp(OVERCAST_SKY_COLOR, cloudCover * 0.76)
      .lerp(LIGHTNING_COLOR, lightning * 0.82);
    this.renderer.setClearColor(weatherSky);
    fog.color.copy(weatherSky);
    fog.near = maxDistance * (0.58 - cloudCover * 0.18);
    fog.far = maxDistance * (0.98 - cloudCover * 0.33);
  }
}
