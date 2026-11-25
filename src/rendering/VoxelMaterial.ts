import * as THREE from 'three';

export interface VoxelLightUniforms {
  uSkyBrightness: { value: number };
  uSkyTint: { value: THREE.Color };
  uTorchTint: { value: THREE.Color };
  uTorchFlicker: { value: number };
  uMinAmbient: { value: number };
}

export function createVoxelLightUniforms(): VoxelLightUniforms {
  return {
    uSkyBrightness: { value: 1.0 },
    uSkyTint: { value: new THREE.Color(1.0, 1.0, 1.0) },
    uTorchTint: { value: new THREE.Color(1.04, 0.86, 0.64) },
    uTorchFlicker: { value: 1.0 },
    uMinAmbient: { value: 0.035 },
  };
}

/**
 * Patches a Three.js MeshBasicMaterial so vertex color channels (R=shade*AO, G=skylight, B=blocklight)
 * combine dynamically on the GPU with day/night skylight tint + warm flickering torchlight + fog.
 */
export function applyVoxelLightingShader(
  material: THREE.MeshBasicMaterial,
  uniforms: VoxelLightUniforms,
  cacheKey: string
): void {
  material.customProgramCacheKey = () => cacheKey;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSkyBrightness = uniforms.uSkyBrightness;
    shader.uniforms.uSkyTint = uniforms.uSkyTint;
    shader.uniforms.uTorchTint = uniforms.uTorchTint;
    shader.uniforms.uTorchFlicker = uniforms.uTorchFlicker;
    shader.uniforms.uMinAmbient = uniforms.uMinAmbient;

    shader.fragmentShader =
      `
      uniform float uSkyBrightness;
      uniform vec3 uSkyTint;
      uniform vec3 uTorchTint;
      uniform float uTorchFlicker;
      uniform float uMinAmbient;
      \n` +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #if defined( USE_COLOR_ALPHA ) || defined( USE_COLOR )
          float shadeAO = vColor.r;
          float skyLevel = vColor.g;
          float blkLevel = vColor.b;

          vec3 skyLight = skyLevel * uSkyBrightness * uSkyTint;
          vec3 torchLight = blkLevel * uTorchFlicker * uTorchTint;

          // Combine skylight & blocklight smoothly without blowing out whites
          vec3 combinedLight = max(skyLight, torchLight) + 0.18 * min(skyLight, torchLight);
          combinedLight = max(combinedLight, vec3(uMinAmbient));
          combinedLight = min(combinedLight, vec3(1.12));

          diffuseColor.rgb *= shadeAO * combinedLight;
        #endif
        `
      );
  };
}
