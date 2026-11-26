import * as THREE from 'three';
import { BlockId } from '../content/BlockId';
import { Player } from '../player/Player';
import { World } from '../world/World';

interface EmberParticle {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  age: number;
  life: number;
  smoke: boolean;
}

/** Lightweight animated embers and smoke around nearby lit campfires. */
export class CampfireEffects {
  private readonly particles: EmberParticle[] = [];
  private readonly fires: THREE.Vector3[] = [];
  private scanTimer = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly world: World,
    private readonly player: Player
  ) {
    for (let index = 0; index < 20; index++) {
      const smoke = index >= 12;
      const material = new THREE.SpriteMaterial({
        color: smoke ? 0x667078 : index % 2 ? 0xffa126 : 0xffdf55,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: true,
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      this.scene.add(sprite);
      this.particles.push({ sprite, velocity: new THREE.Vector3(), age: 0, life: 1, smoke });
    }
  }

  public update(dt: number): void {
    this.scanTimer -= dt;
    if (this.scanTimer <= 0) {
      this.scanTimer = 0.55;
      this.scanNearbyFires();
    }
    for (const particle of this.particles) {
      particle.age += dt;
      if (particle.age >= particle.life) this.reset(particle);
      if (!particle.sprite.visible) continue;
      particle.sprite.position.addScaledVector(particle.velocity, dt);
      particle.velocity.x += (Math.random() - 0.5) * dt * 0.12;
      particle.velocity.z += (Math.random() - 0.5) * dt * 0.12;
      const progress = particle.age / particle.life;
      const material = particle.sprite.material as THREE.SpriteMaterial;
      material.opacity = Math.sin(Math.min(1, progress) * Math.PI) * (particle.smoke ? 0.28 : 0.75);
      const size = particle.smoke ? 0.12 + progress * 0.42 : 0.07 + progress * 0.05;
      particle.sprite.scale.setScalar(size);
    }
  }

  private scanNearbyFires(): void {
    this.fires.length = 0;
    const px = Math.floor(this.player.position.x);
    const py = Math.floor(this.player.position.y);
    const pz = Math.floor(this.player.position.z);
    for (let dz = -10; dz <= 10; dz++) for (let dy = -5; dy <= 5; dy++) for (let dx = -10; dx <= 10; dx++) {
      if (dx * dx + dz * dz > 100) continue;
      if (this.world.getBlock(px + dx, py + dy, pz + dz) === BlockId.LitCampfire) {
        this.fires.push(new THREE.Vector3(px + dx + 0.5, py + dy + 0.35, pz + dz + 0.5));
      }
    }
  }

  private reset(particle: EmberParticle): void {
    if (this.fires.length === 0) {
      particle.sprite.visible = false;
      particle.age = 0;
      return;
    }
    const fire = this.fires[Math.floor(Math.random() * this.fires.length)];
    particle.sprite.position.set(
      fire.x + (Math.random() - 0.5) * 0.28,
      fire.y + (particle.smoke ? 0.55 : 0.18),
      fire.z + (Math.random() - 0.5) * 0.28
    );
    particle.velocity.set(
      (Math.random() - 0.5) * (particle.smoke ? 0.08 : 0.16),
      particle.smoke ? 0.28 + Math.random() * 0.18 : 0.7 + Math.random() * 0.5,
      (Math.random() - 0.5) * (particle.smoke ? 0.08 : 0.16)
    );
    particle.age = 0;
    particle.life = particle.smoke ? 2.2 + Math.random() * 1.4 : 0.55 + Math.random() * 0.45;
    particle.sprite.visible = true;
  }
}
