import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { MobManager } from '../entities/MobManager';
import { ItemId, createStack } from '../items/Item';
import { raycastVoxel } from '../player/Raycaster';
import { DroppedItemManager } from '../rendering/DroppedItems';
import { World } from '../world/World';

interface ArrowProjectile {
  group: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  damage: number;
  age: number;
  embeddedFor: number;
  embedded: boolean;
}

const GRAVITY = 13;
const MAX_AGE = 30;
const RECOVERY_DELAY = 4;

/** Simulates visible ballistic arrows, mob impacts, terrain embedding, and recovery. */
export class ArrowProjectileManager {
  private readonly arrows: ArrowProjectile[] = [];
  private readonly shaftGeometry = new THREE.CylinderGeometry(0.018, 0.018, 0.72, 5);
  private readonly headGeometry = new THREE.ConeGeometry(0.07, 0.16, 5);
  private readonly shaftMaterial = new THREE.MeshBasicMaterial({ color: 0x9b6738 });
  private readonly headMaterial = new THREE.MeshBasicMaterial({ color: 0xc96bea });
  private readonly featherMaterial = new THREE.MeshBasicMaterial({ color: 0xe8dfc4, side: THREE.DoubleSide });
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(
    private readonly scene: THREE.Scene,
    private readonly world: World,
    private readonly mobs: MobManager,
    private readonly drops: DroppedItemManager,
    private readonly audio: AudioManager
  ) {}

  public get count(): number { return this.arrows.length; }

  public fire(origin: THREE.Vector3, direction: THREE.Vector3, power: number): void {
    const normalizedPower = Math.max(0, Math.min(1, power));
    const velocity = direction.clone().normalize().multiplyScalar(9 + normalizedPower * 21);
    const position = origin.clone().addScaledVector(direction, 0.35);
    const group = this.createArrowModel();
    group.position.copy(position);
    this.orient(group, velocity);
    this.scene.add(group);
    this.arrows.push({
      group,
      position,
      velocity,
      damage: 2 + Math.round(normalizedPower * 5),
      age: 0,
      embeddedFor: 0,
      embedded: false,
    });
    this.audio.playBowRelease();
  }

  public update(dt: number): void {
    for (let index = this.arrows.length - 1; index >= 0; index--) {
      const arrow = this.arrows[index];
      arrow.age += dt;
      if (arrow.embedded) {
        arrow.embeddedFor += dt;
        if (arrow.embeddedFor >= RECOVERY_DELAY) this.recover(index);
        continue;
      }
      if (arrow.age >= MAX_AGE || arrow.position.y < -8) {
        this.remove(index);
        continue;
      }

      const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
      const stepDt = dt / steps;
      let finished = false;
      for (let step = 0; step < steps && !finished; step++) {
        const speed = arrow.velocity.length();
        const distance = speed * stepDt;
        if (distance <= 0) continue;
        const direction = arrow.velocity.clone().multiplyScalar(1 / speed);
        const blockHit = raycastVoxel(this.world, arrow.position, direction, distance + 0.08);
        const blockDistance = blockHit?.distance ?? distance + 0.08;
        const mobHit = this.mobs.raycast(arrow.position, direction, distance + 0.08, blockDistance);
        if (mobHit) {
          arrow.position.addScaledVector(direction, mobHit.distance);
          arrow.group.position.copy(arrow.position);
          if (this.mobs.damage(mobHit, arrow.damage, direction)) this.audio.playArrowHit();
          this.remove(index);
          finished = true;
          continue;
        }
        if (blockHit) {
          arrow.position.addScaledVector(direction, Math.max(0, blockHit.distance - 0.08));
          arrow.group.position.copy(arrow.position);
          arrow.embedded = true;
          arrow.velocity.set(0, 0, 0);
          this.audio.playArrowImpact();
          finished = true;
          continue;
        }
        arrow.position.addScaledVector(arrow.velocity, stepDt);
        arrow.velocity.y -= GRAVITY * stepDt;
      }
      if (finished) continue;
      arrow.group.position.copy(arrow.position);
      this.orient(arrow.group, arrow.velocity);
    }
  }

  private createArrowModel(): THREE.Group {
    const group = new THREE.Group();
    const shaft = new THREE.Mesh(this.shaftGeometry, this.shaftMaterial);
    const head = new THREE.Mesh(this.headGeometry, this.headMaterial);
    head.position.y = 0.42;
    const featherA = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.22), this.featherMaterial);
    featherA.position.y = -0.31;
    const featherB = featherA.clone();
    featherB.rotation.y = Math.PI / 2;
    group.add(shaft, head, featherA, featherB);
    return group;
  }

  private orient(group: THREE.Group, velocity: THREE.Vector3): void {
    if (velocity.lengthSq() <= 0.0001) return;
    group.quaternion.setFromUnitVectors(this.up, velocity.clone().normalize());
  }

  private recover(index: number): void {
    const arrow = this.arrows[index];
    this.drops.spawnDrop(
      arrow.position.x,
      arrow.position.y,
      arrow.position.z,
      createStack(ItemId.Arrow),
      new THREE.Vector3(0, 0.7, 0),
      0.35
    );
    this.remove(index);
  }

  private remove(index: number): void {
    const arrow = this.arrows[index];
    if (!arrow) return;
    this.scene.remove(arrow.group);
    this.arrows.splice(index, 1);
  }
}
