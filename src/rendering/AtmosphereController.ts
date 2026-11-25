import * as THREE from 'three';
import { Player } from '../player/Player';
import { World } from '../world/World';
import { CHUNK_SIZE } from '../world/Chunk';
import { DayNightCycle } from './DayNightCycle';

const UNDERWATER_FOG_COLOR = new THREE.Color(0x0b3c7c);

/** Synchronizes day/night lighting, sky fog, and the underwater screen treatment. */
export class AtmosphereController {
  private readonly waterTintEl = document.getElementById('water-tint')!;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly world: World,
    private readonly player: Player,
    private readonly dayNight: DayNightCycle
  ) {}

  public update(): void {
    const uniforms = this.world.lightUniforms;
    uniforms.uSkyBrightness.value = this.dayNight.skyBrightness;
    uniforms.uSkyTint.value.copy(this.dayNight.skyLightTint);
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

    this.renderer.setClearColor(this.dayNight.skyColor);
    fog.color.copy(this.dayNight.skyColor);
    fog.near = maxDistance * 0.58;
    fog.far = maxDistance * 0.98;
  }
}
