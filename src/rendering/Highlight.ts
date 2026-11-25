import * as THREE from 'three';
import { VoxelHit } from '../player/Raycaster';
import { BLOCKS } from '../world/Block';

export class BlockHighlight {
  public readonly mesh: THREE.LineSegments;

  constructor(scene: THREE.Scene) {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const edges = new THREE.EdgesGeometry(box);
    const mat = new THREE.LineBasicMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.65,
    });

    this.mesh = new THREE.LineSegments(edges, mat);
    this.mesh.visible = false;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
    box.dispose();
  }

  public update(hit: VoxelHit | null): void {
    if (!hit) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    const shape = BLOCKS[hit.blockId].shape;
    if (shape === 'torch') {
      this.mesh.scale.set(0.26, 0.66, 0.26);
      this.mesh.position.set(hit.blockX + 0.5, hit.blockY + 0.33, hit.blockZ + 0.5);
    } else {
      this.mesh.scale.set(1.006, 1.006, 1.006);
      this.mesh.position.set(hit.blockX + 0.5, hit.blockY + 0.5, hit.blockZ + 0.5);
    }
  }
}
