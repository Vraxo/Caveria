import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { BlockId } from '../content/BlockId';
import { isBlockSolid } from '../content/BlockQueries';
import { CRYSTAL_MITE_ID, MOB_DEFINITIONS } from '../content/mobs/MobDefinitions';
import { rollMobLoot } from '../content/loot/MobLoot';
import { Player } from '../player/Player';
import { BreakParticles } from '../rendering/BreakParticles';
import { DroppedItemManager } from '../rendering/DroppedItems';
import { World } from '../world/World';
import { MobHit, MobSpeciesController, MobTag } from './MobTypes';

export type CrystalMiteHit = MobHit;

interface CrystalMite {
  id: number;
  group: THREE.Group;
  body: THREE.Group;
  shell: THREE.Mesh;
  shellMaterial: THREE.MeshBasicMaterial;
  legs: THREE.Mesh[];
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  health: number;
  age: number;
  decisionTimer: number;
  chirpTimer: number;
  hurtTimer: number;
  moveAngle: number;
  onGround: boolean;
  inspectTarget: THREE.Vector3 | null;
}

const DEFINITION = MOB_DEFINITIONS[CRYSTAL_MITE_ID];
const BODY_RADIUS = DEFINITION.radius;
const BODY_HEIGHT = DEFINITION.height;

/** Spawns, animates, targets, and simulates Caveria's first passive cave creature. */
export class CrystalMiteManager implements MobSpeciesController {
  public readonly species = CRYSTAL_MITE_ID;
  public readonly tags: ReadonlySet<MobTag> = new Set(DEFINITION.tags);
  private readonly mites: CrystalMite[] = [];
  private readonly bodyGeometry = new THREE.BoxGeometry(0.4, 0.22, 0.48);
  private readonly shellGeometry = new THREE.OctahedronGeometry(0.25, 0);
  private readonly eyeGeometry = new THREE.BoxGeometry(0.075, 0.075, 0.045);
  private readonly legGeometry = new THREE.BoxGeometry(0.07, 0.08, 0.28);
  private readonly bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x30263b });
  private readonly eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xcffafe });
  private readonly legMaterial = new THREE.MeshBasicMaterial({ color: 0x4b3757 });
  private nextId = 1;
  private spawnTimer = 1.2;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly world: World,
    private readonly player: Player,
    private readonly drops: DroppedItemManager,
    private readonly particles: BreakParticles,
    private readonly audio: AudioManager
  ) {}

  public get count(): number {
    return this.mites.length;
  }

  public hasWithin(position: THREE.Vector3, radius: number): boolean {
    const radiusSq = radius * radius;
    return this.mites.some((mite) => mite.position.distanceToSquared(position) <= radiusSq);
  }

  public update(dt: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = DEFINITION.spawnDelay.minimum + Math.random() * DEFINITION.spawnDelay.variance;
      this.trySpawn();
    }

    for (let i = this.mites.length - 1; i >= 0; i--) {
      const mite = this.mites[i];
      mite.age += dt;
      mite.decisionTimer -= dt;
      mite.chirpTimer -= dt;
      mite.hurtTimer = Math.max(0, mite.hurtTimer - dt);

      const dxPlayer = mite.position.x - this.player.position.x;
      const dzPlayer = mite.position.z - this.player.position.z;
      const playerDistance = Math.hypot(dxPlayer, dzPlayer);
      if (playerDistance > DEFINITION.despawnDistance) {
        this.removeMite(i);
        continue;
      }

      let desiredX = 0;
      let desiredZ = 0;
      let speed = 0.72;
      if (playerDistance < 4.8) {
        const inverse = 1 / Math.max(0.001, playerDistance);
        desiredX = dxPlayer * inverse;
        desiredZ = dzPlayer * inverse;
        speed = 2.25;
        mite.inspectTarget = null;
      } else {
        if (mite.decisionTimer <= 0) this.chooseActivity(mite);
        if (mite.inspectTarget) {
          const tx = mite.inspectTarget.x - mite.position.x;
          const tz = mite.inspectTarget.z - mite.position.z;
          const distance = Math.hypot(tx, tz);
          if (distance < 0.75) {
            mite.inspectTarget = null;
            mite.decisionTimer = 1.2 + Math.random() * 2.4;
          } else {
            desiredX = tx / distance;
            desiredZ = tz / distance;
          }
        } else if (mite.decisionTimer > 0.7) {
          desiredX = Math.sin(mite.moveAngle);
          desiredZ = Math.cos(mite.moveAngle);
        }
      }

      const movementBlend = Math.min(1, dt * 5.5);
      mite.velocity.x += (desiredX * speed - mite.velocity.x) * movementBlend;
      mite.velocity.z += (desiredZ * speed - mite.velocity.z) * movementBlend;
      mite.velocity.y = Math.max(-18, mite.velocity.y - 22 * dt);
      this.moveMite(mite, dt);

      const moving = Math.hypot(mite.velocity.x, mite.velocity.z);
      if (moving > 0.08) {
        mite.group.rotation.y = Math.atan2(mite.velocity.x, mite.velocity.z);
      }
      const gait = Math.sin(mite.age * (moving > 0.2 ? 11 : 2.4));
      mite.body.position.y = 0.2 + Math.abs(gait) * 0.025;
      mite.body.rotation.z = gait * Math.min(0.08, moving * 0.035);
      for (let leg = 0; leg < mite.legs.length; leg++) {
        mite.legs[leg].rotation.x = (leg % 2 === 0 ? gait : -gait) * 0.42;
      }
      const pulse = 0.92 + Math.sin(mite.age * 3.1 + mite.id) * 0.08;
      mite.shell.scale.setScalar(pulse);
      mite.shellMaterial.color.setHex(mite.hurtTimer > 0 ? 0xffffff : 0xb45de8);
      mite.group.position.copy(mite.position);

      if (mite.chirpTimer <= 0 && playerDistance < 13) {
        mite.chirpTimer = 4 + Math.random() * 9;
        this.audio.playCrystalMiteChirp();
      }
    }
  }

  public raycast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    blockDistance = maxDistance
  ): CrystalMiteHit | null {
    const ray = new THREE.Ray(origin, direction.clone().normalize());
    const hitPoint = new THREE.Vector3();
    let closest: CrystalMiteHit | null = null;
    for (const mite of this.mites) {
      const box = new THREE.Box3(
        new THREE.Vector3(
          mite.position.x - BODY_RADIUS,
          mite.position.y,
          mite.position.z - BODY_RADIUS
        ),
        new THREE.Vector3(
          mite.position.x + BODY_RADIUS,
          mite.position.y + BODY_HEIGHT,
          mite.position.z + BODY_RADIUS
        )
      );
      if (!ray.intersectBox(box, hitPoint)) continue;
      const distance = origin.distanceTo(hitPoint);
      if (distance > maxDistance || distance >= blockDistance) continue;
      if (!closest || distance < closest.distance) {
        closest = {
          species: this.species,
          entityId: mite.id,
          id: mite.id,
          name: DEFINITION.name,
          distance,
          health: mite.health,
          maxHealth: DEFINITION.maxHealth,
        };
      }
    }
    return closest;
  }

  public damage(id: number, amount: number, direction: THREE.Vector3): boolean {
    const index = this.mites.findIndex((mite) => mite.id === id);
    if (index < 0) return false;
    const mite = this.mites[index];
    if (mite.hurtTimer > 0) return false;

    mite.health -= Math.max(1, amount);
    mite.hurtTimer = 0.28;
    mite.velocity.x += direction.x * 3.8;
    mite.velocity.y = 3.3;
    mite.velocity.z += direction.z * 3.8;
    mite.decisionTimer = 0;
    this.audio.playCrystalMiteHit();

    if (mite.health <= 0) {
      this.audio.playCrystalMiteDeath();
      this.particles.spawnBurst(
        mite.position.x - 0.5,
        mite.position.y,
        mite.position.z - 0.5,
        BlockId.AmethystCrystal
      );
      for (const stack of rollMobLoot(DEFINITION.lootTable)) {
        this.drops.spawnDrop(
          mite.position.x,
          mite.position.y + 0.25,
          mite.position.z,
          stack
        );
      }
      this.removeMite(index);
    }
    return true;
  }

  private trySpawn(): void {
    if (this.mites.length >= DEFINITION.maxPopulation) return;
    const px = Math.floor(this.player.position.x);
    const pz = Math.floor(this.player.position.z);
    const surfaceY = this.world.terrainGen.getSurfaceHeight(px, pz);
    if (this.player.position.y > surfaceY - 5) return;

    for (let attempt = 0; attempt < 14; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 7 + Math.random() * 13;
      const x = Math.floor(this.player.position.x + Math.cos(angle) * radius);
      const z = Math.floor(this.player.position.z + Math.sin(angle) * radius);
      const cavernBiome = this.world.terrainGen.getCavernBiome(x, z);
      if (cavernBiome !== 'Crystal Geode Hall' && Math.random() > 0.18) continue;

      for (let y = Math.floor(this.player.position.y + 5); y >= this.player.position.y - 7; y--) {
        if (
          this.world.getBlock(x, y, z) === BlockId.Air &&
          this.world.getBlock(x, y + 1, z) === BlockId.Air &&
          isBlockSolid(this.world.getBlock(x, y - 1, z))
        ) {
          const crowded = this.mites.some(
            (mite) => Math.hypot(mite.position.x - (x + 0.5), mite.position.z - (z + 0.5)) < 3
          );
          if (!crowded) this.spawnMite(x + 0.5, y, z + 0.5);
          return;
        }
      }
    }
  }

  private spawnMite(x: number, y: number, z: number): void {
    const group = new THREE.Group();
    const body = new THREE.Group();
    group.add(body);

    const abdomen = new THREE.Mesh(this.bodyGeometry, this.bodyMaterial);
    abdomen.position.y = 0.14;
    body.add(abdomen);

    const shellMaterial = new THREE.MeshBasicMaterial({ color: 0xb45de8 });
    const shell = new THREE.Mesh(this.shellGeometry, shellMaterial);
    shell.scale.set(0.78, 0.92, 0.95);
    shell.position.set(0, 0.31, -0.02);
    shell.rotation.y = Math.PI / 4;
    body.add(shell);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(this.eyeGeometry, this.eyeMaterial);
      eye.position.set(side * 0.115, 0.24, 0.245);
      body.add(eye);
    }

    const legs: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
      for (const zOffset of [-0.13, 0.13]) {
        const leg = new THREE.Mesh(this.legGeometry, this.legMaterial);
        leg.position.set(side * 0.22, 0.08, zOffset);
        leg.rotation.z = side * 0.72;
        body.add(leg);
        legs.push(leg);
      }
    }

    const position = new THREE.Vector3(x, y, z);
    group.position.copy(position);
    this.scene.add(group);
    this.mites.push({
      id: this.nextId++,
      group,
      body,
      shell,
      shellMaterial,
      legs,
      position,
      velocity: new THREE.Vector3(),
      health: DEFINITION.maxHealth,
      age: Math.random() * 8,
      decisionTimer: 0,
      chirpTimer: 2 + Math.random() * 7,
      hurtTimer: 0,
      moveAngle: Math.random() * Math.PI * 2,
      onGround: false,
      inspectTarget: null,
    });
  }

  private chooseActivity(mite: CrystalMite): void {
    mite.inspectTarget = Math.random() < 0.55 ? this.findNearbyCrystal(mite.position) : null;
    mite.moveAngle = Math.random() * Math.PI * 2;
    mite.decisionTimer = mite.inspectTarget ? 3 + Math.random() * 3 : 1.4 + Math.random() * 3.8;
  }

  private findNearbyCrystal(position: THREE.Vector3): THREE.Vector3 | null {
    const centerX = Math.floor(position.x);
    const centerY = Math.floor(position.y);
    const centerZ = Math.floor(position.z);
    for (let radius = 1; radius <= 4; radius++) {
      for (let z = -radius; z <= radius; z++) {
        for (let x = -radius; x <= radius; x++) {
          for (let y = -1; y <= 2; y++) {
            const block = this.world.getBlock(centerX + x, centerY + y, centerZ + z);
            if (block === BlockId.AmethystCrystal || block === BlockId.GlowCrystal) {
              return new THREE.Vector3(centerX + x + 0.5, centerY, centerZ + z + 0.5);
            }
          }
        }
      }
    }
    return null;
  }

  private moveMite(mite: CrystalMite, dt: number): void {
    const nextY = mite.position.y + mite.velocity.y * dt;
    if (mite.velocity.y < 0 && isBlockSolid(this.world.getBlock(mite.position.x, nextY - 0.02, mite.position.z))) {
      mite.position.y = Math.floor(nextY - 0.02) + 1;
      mite.velocity.y = 0;
      mite.onGround = true;
    } else {
      mite.position.y = nextY;
      mite.onGround = false;
    }

    const nextX = mite.position.x + mite.velocity.x * dt;
    const nextZ = mite.position.z + mite.velocity.z * dt;
    if (this.canOccupy(nextX, mite.position.y, nextZ, mite.onGround)) {
      mite.position.x = nextX;
      mite.position.z = nextZ;
    } else {
      mite.velocity.x *= -0.25;
      mite.velocity.z *= -0.25;
      mite.moveAngle += Math.PI * (0.55 + Math.random() * 0.9);
      mite.decisionTimer = 0.6;
      mite.inspectTarget = null;
    }
  }

  private canOccupy(x: number, y: number, z: number, requireSupport: boolean): boolean {
    for (const ox of [-BODY_RADIUS, BODY_RADIUS]) {
      for (const oz of [-BODY_RADIUS, BODY_RADIUS]) {
        if (
          isBlockSolid(this.world.getBlock(x + ox, y + 0.08, z + oz)) ||
          isBlockSolid(this.world.getBlock(x + ox, y + BODY_HEIGHT, z + oz))
        ) return false;
      }
    }
    if (requireSupport && !isBlockSolid(this.world.getBlock(x, y - 0.08, z))) return false;
    return true;
  }

  private removeMite(index: number): void {
    const mite = this.mites[index];
    this.scene.remove(mite.group);
    mite.shellMaterial.dispose();
    this.mites.splice(index, 1);
  }
}
