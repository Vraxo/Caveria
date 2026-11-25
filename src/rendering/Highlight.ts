import * as THREE from 'three';
import { VoxelHit } from '../player/Raycaster';

export class BlockHighlight {
  public readonly mesh: THREE.LineSegments;

  constructor(scene: THREE.Scene) {
    // Slightly larger than 1x1x1 to prevent z-fighting with voxel faces
    const box = new THREE.BoxGeometry(1.006, 1.006, 1.006);
    const edges = new THREE.EdgesGeometry(box);
    const mat = new THREE.LineBasicMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.75,
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
    this.mesh.position.set(hit.blockX + 0.5, hit.blockY + 0.5, hit.blockZ + 0.5);
  }
}
