import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { BlockId } from '../content/BlockId';
import { isBlockSolid } from '../content/BlockQueries';
import { ItemId, createStack } from '../items/Item';
import { Player } from '../player/Player';
import { PlayerVitals } from '../player/PlayerVitals';
import { raycastVoxel } from '../player/Raycaster';
import { BreakParticles } from '../rendering/BreakParticles';
import { DroppedItemManager } from '../rendering/DroppedItems';
import { World } from '../world/World';

export interface CaveCrawlerHit {
  kind: 'cave-crawler';
  id: number;
  name: 'Cave Crawler';
  distance: number;
  health: number;
  maxHealth: number;
}

interface CaveCrawler {
  id: number;
  group: THREE.Group;
  body: THREE.Group;
  carapace: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  legs: THREE.Mesh[];
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  health: number;
  age: number;
  attackTimer: number;
  decisionTimer: number;
  growlTimer: number;
  hurtTimer: number;
  angle: number;
  onGround: boolean;
}

const MAX_CRAWLERS = 4;
const MAX_HEALTH = 10;
const RADIUS = 0.38;
const HEIGHT = 0.65;

/** Hostile underground predator with pursuit, line of sight, and melee attacks. */
export class CaveCrawlerManager {
  private readonly crawlers: CaveCrawler[] = [];
  private readonly bodyGeometry = new THREE.BoxGeometry(0.58, 0.3, 0.72);
  private readonly headGeometry = new THREE.BoxGeometry(0.42, 0.3, 0.38);
  private readonly legGeometry = new THREE.BoxGeometry(0.09, 0.1, 0.42);
  private readonly eyeGeometry = new THREE.BoxGeometry(0.08, 0.08, 0.05);
  private readonly legMaterial = new THREE.MeshBasicMaterial({ color: 0x281d1b });
  private readonly eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff5538 });
  private spawnTimer = 4;
  private nextId = 1;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly world: World,
    private readonly player: Player,
    private readonly vitals: PlayerVitals,
    private readonly drops: DroppedItemManager,
    private readonly particles: BreakParticles,
    private readonly audio: AudioManager,
    private readonly onPoisonPlayer: () => void = () => {}
  ) {}

  public get count(): number { return this.crawlers.length; }

  public hasCrawlerWithin(position: THREE.Vector3, radius: number): boolean {
    const radiusSq = radius * radius;
    return this.crawlers.some((crawler) => crawler.position.distanceToSquared(position) <= radiusSq);
  }

  public update(dt: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 3.5 + Math.random() * 4;
      this.trySpawn();
    }

    for (let i = this.crawlers.length - 1; i >= 0; i--) {
      const crawler = this.crawlers[i];
      crawler.age += dt;
      crawler.attackTimer = Math.max(0, crawler.attackTimer - dt);
      crawler.decisionTimer -= dt;
      crawler.growlTimer -= dt;
      crawler.hurtTimer = Math.max(0, crawler.hurtTimer - dt);

      const toPlayerX = this.player.position.x - crawler.position.x;
      const toPlayerZ = this.player.position.z - crawler.position.z;
      const distance = Math.hypot(toPlayerX, toPlayerZ);
      if (distance > 46) {
        this.remove(i);
        continue;
      }

      const canSeePlayer = distance < 14 && this.hasLineOfSight(crawler, distance);
      let desiredX = 0;
      let desiredZ = 0;
      let speed = 0.62;
      if (canSeePlayer && !this.vitals.dead) {
        desiredX = toPlayerX / Math.max(0.001, distance);
        desiredZ = toPlayerZ / Math.max(0.001, distance);
        speed = distance < 2 ? 1.25 : 2.05;
        crawler.angle = Math.atan2(desiredX, desiredZ);
        if (crawler.growlTimer <= 0 && distance < 9) {
          crawler.growlTimer = 4 + Math.random() * 7;
          this.audio.playCaveCrawlerGrowl();
        }
        if (distance < 1.25 && Math.abs(this.player.position.y - crawler.position.y) < 1.5 && crawler.attackTimer <= 0) {
          crawler.attackTimer = 1.15;
          const knockback = this.vitals.knockbackMultiplier;
          if (this.vitals.damage(3, 'mob')) {
            if (Math.random() < 0.18) this.onPoisonPlayer();
            this.player.velocity.x += desiredX * 4.2 * knockback;
            this.player.velocity.y = Math.max(this.player.velocity.y, 3.2 * knockback);
            this.player.velocity.z += desiredZ * 4.2 * knockback;
          }
        }
      } else {
        if (crawler.decisionTimer <= 0) {
          crawler.angle += (Math.random() - 0.5) * Math.PI * 1.7;
          crawler.decisionTimer = 1.2 + Math.random() * 3.5;
        }
        desiredX = Math.sin(crawler.angle);
        desiredZ = Math.cos(crawler.angle);
      }

      const blend = Math.min(1, dt * 5);
      crawler.velocity.x += (desiredX * speed - crawler.velocity.x) * blend;
      crawler.velocity.z += (desiredZ * speed - crawler.velocity.z) * blend;
      crawler.velocity.y = Math.max(-18, crawler.velocity.y - 22 * dt);
      this.move(crawler, dt);

      const moving = Math.hypot(crawler.velocity.x, crawler.velocity.z);
      if (moving > 0.08) crawler.group.rotation.y = Math.atan2(crawler.velocity.x, crawler.velocity.z);
      const gait = Math.sin(crawler.age * (moving > 0.25 ? 12 : 2));
      crawler.body.position.y = 0.25 + Math.abs(gait) * 0.035;
      for (let leg = 0; leg < crawler.legs.length; leg++) {
        crawler.legs[leg].rotation.x = (leg % 2 === 0 ? gait : -gait) * 0.48;
      }
      crawler.material.color.setHex(crawler.hurtTimer > 0 ? 0xffffff : 0x50302b);
      crawler.group.position.copy(crawler.position);
    }
  }

  public raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number, blockDistance: number): CaveCrawlerHit | null {
    const ray = new THREE.Ray(origin, direction.clone().normalize());
    const hitPoint = new THREE.Vector3();
    let closest: CaveCrawlerHit | null = null;
    for (const crawler of this.crawlers) {
      const box = new THREE.Box3(
        new THREE.Vector3(crawler.position.x - RADIUS, crawler.position.y, crawler.position.z - RADIUS),
        new THREE.Vector3(crawler.position.x + RADIUS, crawler.position.y + HEIGHT, crawler.position.z + RADIUS)
      );
      if (!ray.intersectBox(box, hitPoint)) continue;
      const distance = origin.distanceTo(hitPoint);
      if (distance > maxDistance || distance >= blockDistance) continue;
      if (!closest || distance < closest.distance) {
        closest = { kind: 'cave-crawler', id: crawler.id, name: 'Cave Crawler', distance, health: crawler.health, maxHealth: MAX_HEALTH };
      }
    }
    return closest;
  }

  public damage(id: number, amount: number, direction: THREE.Vector3): boolean {
    const index = this.crawlers.findIndex((crawler) => crawler.id === id);
    if (index < 0) return false;
    const crawler = this.crawlers[index];
    if (crawler.hurtTimer > 0) return false;
    crawler.health -= Math.max(1, amount);
    crawler.hurtTimer = 0.24;
    crawler.velocity.x += direction.x * 3;
    crawler.velocity.y = 3;
    crawler.velocity.z += direction.z * 3;
    this.audio.playCaveCrawlerHit();
    if (crawler.health <= 0) {
      this.audio.playCaveCrawlerDeath();
      this.particles.spawnBurst(crawler.position.x - 0.5, crawler.position.y, crawler.position.z - 0.5, BlockId.DeepSlate);
      this.drops.spawnDrop(crawler.position.x, crawler.position.y + 0.3, crawler.position.z, createStack(ItemId.CaveChitin, 1 + (Math.random() < 0.3 ? 1 : 0)));
      this.remove(index);
    }
    return true;
  }

  private trySpawn(): void {
    if (this.crawlers.length >= MAX_CRAWLERS || this.vitals.dead) return;
    const surface = this.world.terrainGen.getSurfaceHeight(Math.floor(this.player.position.x), Math.floor(this.player.position.z));
    if (this.player.position.y > surface - 7) return;
    for (let attempt = 0; attempt < 14; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 10 + Math.random() * 13;
      const x = Math.floor(this.player.position.x + Math.cos(angle) * radius);
      const z = Math.floor(this.player.position.z + Math.sin(angle) * radius);
      for (let y = Math.floor(this.player.position.y + 5); y >= this.player.position.y - 7; y--) {
        const sky = (this.world.getPackedLight(x, y, z) >> 4) & 0xf;
        if (sky > 3) continue;
        if (this.world.getBlock(x, y, z) === BlockId.Air && this.world.getBlock(x, y + 1, z) === BlockId.Air && isBlockSolid(this.world.getBlock(x, y - 1, z))) {
          this.spawn(x + 0.5, y, z + 0.5);
          return;
        }
      }
    }
  }

  private spawn(x: number, y: number, z: number): void {
    const group = new THREE.Group();
    const body = new THREE.Group();
    group.add(body);
    const material = new THREE.MeshBasicMaterial({ color: 0x50302b });
    const carapace = new THREE.Mesh(this.bodyGeometry, material);
    carapace.position.y = 0.26;
    body.add(carapace);
    const head = new THREE.Mesh(this.headGeometry, material);
    head.position.set(0, 0.22, 0.42);
    body.add(head);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(this.eyeGeometry, this.eyeMaterial);
      eye.position.set(side * 0.12, 0.29, 0.62);
      body.add(eye);
    }
    const legs: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
      for (const zOffset of [-0.25, 0, 0.25]) {
        const leg = new THREE.Mesh(this.legGeometry, this.legMaterial);
        leg.position.set(side * 0.34, 0.09, zOffset);
        leg.rotation.z = side * 0.75;
        body.add(leg);
        legs.push(leg);
      }
    }
    const position = new THREE.Vector3(x, y, z);
    group.position.copy(position);
    this.scene.add(group);
    this.crawlers.push({
      id: this.nextId++, group, body, carapace, material, legs, position,
      velocity: new THREE.Vector3(), health: MAX_HEALTH, age: Math.random() * 5,
      attackTimer: 0, decisionTimer: 0, growlTimer: 1 + Math.random() * 5,
      hurtTimer: 0, angle: Math.random() * Math.PI * 2, onGround: false,
    });
  }

  private hasLineOfSight(crawler: CaveCrawler, distance: number): boolean {
    const origin = new THREE.Vector3(crawler.position.x, crawler.position.y + 0.4, crawler.position.z);
    const target = this.player.getEyePosition();
    const direction = target.sub(origin).normalize();
    const hit = raycastVoxel(this.world, origin, direction, distance);
    return !hit || hit.distance >= distance - 0.35;
  }

  private move(crawler: CaveCrawler, dt: number): void {
    const nextY = crawler.position.y + crawler.velocity.y * dt;
    if (crawler.velocity.y < 0 && isBlockSolid(this.world.getBlock(crawler.position.x, nextY - 0.02, crawler.position.z))) {
      crawler.position.y = Math.floor(nextY - 0.02) + 1;
      crawler.velocity.y = 0;
      crawler.onGround = true;
    } else {
      crawler.position.y = nextY;
      crawler.onGround = false;
    }
    const nextX = crawler.position.x + crawler.velocity.x * dt;
    const nextZ = crawler.position.z + crawler.velocity.z * dt;
    if (this.canOccupy(nextX, crawler.position.y, nextZ, crawler.onGround)) {
      crawler.position.x = nextX;
      crawler.position.z = nextZ;
    } else {
      crawler.velocity.x *= -0.2;
      crawler.velocity.z *= -0.2;
      crawler.angle += Math.PI * (0.6 + Math.random() * 0.8);
      crawler.decisionTimer = 0;
    }
  }

  private canOccupy(x: number, y: number, z: number, support: boolean): boolean {
    for (const ox of [-RADIUS, RADIUS]) for (const oz of [-RADIUS, RADIUS]) {
      if (isBlockSolid(this.world.getBlock(x + ox, y + 0.08, z + oz)) || isBlockSolid(this.world.getBlock(x + ox, y + HEIGHT, z + oz))) return false;
    }
    return !support || isBlockSolid(this.world.getBlock(x, y - 0.08, z));
  }

  private remove(index: number): void {
    const crawler = this.crawlers[index];
    this.scene.remove(crawler.group);
    crawler.material.dispose();
    this.crawlers.splice(index, 1);
  }
}
