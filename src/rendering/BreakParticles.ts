import * as THREE from 'three';
import { BLOCKS, BlockId } from '../world/Block';

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class BreakParticles {
  private readonly scene: THREE.Scene;
  private readonly particles: Particle[] = [];
  private readonly sharedGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);

  private static readonly BLOCK_TINTS: Partial<Record<BlockId, number>> = {
    [BlockId.Grass]: 0x5ca842,
    [BlockId.Dirt]: 0x866043,
    [BlockId.Stone]: 0x7d7d80,
    [BlockId.Cobblestone]: 0x6e6e72,
    [BlockId.Sand]: 0xdfd3a2,
    [BlockId.OakLog]: 0x685232,
    [BlockId.OakLeaves]: 0x38842c,
    [BlockId.OakPlanks]: 0xb8945e,
    [BlockId.CoalOre]: 0x555558,
    [BlockId.GoldOre]: 0xe8c448,
    [BlockId.Glass]: 0xd8f2fc,
    [BlockId.Torch]: 0xffb347,
    [BlockId.GlowCrystal]: 0x7ef2ff,
    [BlockId.CraftingTable]: 0x9c7240,
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public spawnBurst(bx: number, by: number, bz: number, blockId: BlockId): void {
    if (!BLOCKS[blockId]) return;
    const color = BreakParticles.BLOCK_TINTS[blockId] ?? 0x999999;

    const count = 14;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color });
      const mesh = new THREE.Mesh(this.sharedGeo, mat);

      const ox = (Math.random() - 0.5) * 0.7;
      const oy = (Math.random() - 0.5) * 0.7;
      const oz = (Math.random() - 0.5) * 0.7;
      mesh.position.set(bx + 0.5 + ox, by + 0.5 + oy, bz + 0.5 + oz);

      const vel = new THREE.Vector3(
        ox * 4.2 + (Math.random() - 0.5) * 1.8,
        Math.random() * 3.8 + 1.2,
        oz * 4.2 + (Math.random() - 0.5) * 1.8
      );

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.25,
      });
    }
  }

  public update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
        continue;
      }

      p.vel.y -= 18.0 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const scale = 1 - (p.life / p.maxLife) * 0.5;
      p.mesh.scale.setScalar(scale);
    }
  }
}
