import * as THREE from 'three';
import { VoxelHit } from '../player/Raycaster';
import { BLOCKS } from '../content/BlockRegistry';
import { mulberry32 } from '../world/Noise';

const CRACK_STAGES = 10;

export class MiningOverlay {
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly textures: THREE.CanvasTexture[] = [];
  private currentStage = -1;

  constructor(scene: THREE.Scene) {
    for (let s = 0; s < CRACK_STAGES; s++) {
      this.textures.push(this.generateCrackTexture(s));
    }

    const geo = new THREE.BoxGeometry(1.008, 1.008, 1.008);
    this.material = new THREE.MeshBasicMaterial({
      map: this.textures[0],
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.visible = false;
    this.mesh.renderOrder = 3;
    scene.add(this.mesh);
  }

  /**
   * Updates the crack overlay on `hit` for `progress` in [0, 1).
   * Hides when `hit` is null or `progress <= 0`.
   */
  public update(hit: VoxelHit | null, progress: number): void {
    if (!hit || progress <= 0.01) {
      this.mesh.visible = false;
      this.currentStage = -1;
      return;
    }

    const stage = Math.min(CRACK_STAGES - 1, Math.floor(progress * CRACK_STAGES));
    if (stage !== this.currentStage) {
      this.currentStage = stage;
      this.material.map = this.textures[stage];
      this.material.needsUpdate = true;
    }

    this.mesh.visible = true;
    const shape = BLOCKS[hit.blockId].shape;
    if (shape === 'torch') {
      this.mesh.scale.set(0.26, 0.66, 0.26);
      this.mesh.position.set(hit.blockX + 0.5, hit.blockY + 0.33, hit.blockZ + 0.5);
    } else if (shape === 'cross') {
      this.mesh.scale.set(0.76, 0.92, 0.76);
      this.mesh.position.set(hit.blockX + 0.5, hit.blockY + 0.46, hit.blockZ + 0.5);
    } else {
      this.mesh.scale.set(1, 1, 1);
      this.mesh.position.set(hit.blockX + 0.5, hit.blockY + 0.5, hit.blockZ + 0.5);
    }
  }

  private generateCrackTexture(stage: number): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(16, 16);

    const rng = mulberry32(4200);
    const branchCount = 2 + Math.floor((stage + 1) * 0.9);
    const maxLen = 2 + Math.floor(((stage + 1) / CRACK_STAGES) * 9.5);

    for (let b = 0; b < branchCount; b++) {
      let x = 7.5 + (rng() - 0.5) * 2;
      let y = 7.5 + (rng() - 0.5) * 2;
      let angle = (b / branchCount) * Math.PI * 2 + (rng() - 0.5) * 0.5;

      for (let step = 0; step < maxLen; step++) {
        const ix = Math.round(x);
        const iy = Math.round(y);
        if (ix >= 0 && ix < 16 && iy >= 0 && iy < 16) {
          const idx = (iy * 16 + ix) * 4;
          img.data[idx] = 15;
          img.data[idx + 1] = 20;
          img.data[idx + 2] = 28;
          img.data[idx + 3] = 195;

          // Thicker fracture near center at high crack stages
          if (stage >= 5 && step < maxLen * 0.5 && ix + 1 < 16) {
            const idx2 = (iy * 16 + (ix + 1)) * 4;
            img.data[idx2] = 24;
            img.data[idx2 + 1] = 28;
            img.data[idx2 + 2] = 36;
            img.data[idx2 + 3] = 150;
          }
        }
        angle += (rng() - 0.5) * 0.85;
        x += Math.cos(angle);
        y += Math.sin(angle);
      }
    }

    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    return tex;
  }
}
