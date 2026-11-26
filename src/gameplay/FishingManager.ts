import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { BlockId } from '../content/BlockId';
import { ItemId, ItemStack, createStack } from '../items/Item';
import { Player } from '../player/Player';
import { raycastWater } from '../player/Raycaster';
import { World } from '../world/World';
import { getWaterQuality, WaterQuality } from './WaterQuality';

export interface FishingUseResult {
  handled: boolean;
  rodWear: boolean;
  catchStack?: ItemStack;
  catchPosition?: THREE.Vector3;
}

interface CatchEntry { item: ItemId; weight: number; }

/** Chooses biome-, depth-, and quality-sensitive catches from a stable roll in [0, 1). */
export function selectFishingCatch(
  world: World,
  quality: WaterQuality,
  x: number,
  y: number,
  z: number,
  roll: number
): ItemId {
  const surface = world.terrainGen.getSurfaceHeight(x, z);
  const biome = world.terrainGen.getSurfaceBiome(x, z, surface);
  const deep = y < surface - 5;
  let entries: CatchEntry[];
  if (quality === 'tainted') {
    entries = [
      { item: ItemId.BlightedFish, weight: 43 },
      { item: ItemId.RawCaveFish, weight: 22 },
      { item: ItemId.CrystalFish, weight: 3 },
      { item: ItemId.Stick, weight: 15 },
      { item: ItemId.GlassBottle, weight: 10 },
      { item: ItemId.Coal, weight: 6 },
      { item: ItemId.GoldIngot, weight: 1 },
    ];
  } else if (quality === 'murky') {
    entries = [
      { item: ItemId.RawCaveFish, weight: deep ? 48 : 36 },
      { item: ItemId.RawRiverFish, weight: deep ? 12 : 24 },
      { item: ItemId.CrystalFish, weight: 4 },
      { item: ItemId.Stick, weight: 17 },
      { item: ItemId.GlassBottle, weight: 10 },
      { item: ItemId.Coal, weight: 7 },
      { item: ItemId.CrystalShard, weight: 2 },
    ];
  } else {
    entries = [
      { item: ItemId.RawRiverFish, weight: deep ? 18 : 52 },
      { item: ItemId.RawCaveFish, weight: deep ? 48 : 15 },
      { item: ItemId.CrystalFish, weight: deep ? 9 : 7 },
      { item: ItemId.Stick, weight: 9 },
      { item: ItemId.GlassBottle, weight: 7 },
      { item: ItemId.Coal, weight: 5 },
      { item: ItemId.GoldIngot, weight: 2 },
    ];
  }
  if (biome === 'Desert Dunes') {
    const river = entries.find((entry) => entry.item === ItemId.RawRiverFish);
    const junk = entries.find((entry) => entry.item === ItemId.Stick);
    if (river && junk) {
      const shift = Math.min(10, river.weight);
      river.weight -= shift;
      junk.weight += shift;
    }
  }
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = Math.max(0, Math.min(0.999999, roll)) * total;
  for (const entry of entries) {
    cursor -= entry.weight;
    if (cursor < 0) return entry.item;
  }
  return entries[entries.length - 1].item;
}

/** Prevents productive fishing from isolated one-block water holes. */
export function isFishableWater(world: World, startX: number, y: number, startZ: number): boolean {
  const queue: Array<[number, number]> = [[Math.floor(startX), Math.floor(startZ)]];
  const seen = new Set<string>();
  let waterCount = 0;
  while (queue.length > 0 && seen.size < 96) {
    const [x, z] = queue.shift()!;
    const key = `${x},${z}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (world.getBlock(x, y, z) !== BlockId.Water) continue;
    waterCount++;
    if (waterCount >= 10) return true;
    queue.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
  }
  return false;
}

/** Visible fishing bobber, line, bite timing, splash feedback, and catch selection. */
export class FishingManager {
  private active = false;
  private biting = false;
  private timer = 0;
  private messageTimer = 0;
  private quality: WaterQuality = 'fresh';
  private waterX = 0;
  private waterY = 0;
  private waterZ = 0;
  private readonly bobber: THREE.Group;
  private readonly lineGeometry = new THREE.BufferGeometry();
  private readonly line: THREE.Line;
  private readonly statusEl = document.getElementById('fishing-status')!;
  private readonly splashes: Array<{ mesh: THREE.Mesh; age: number }> = [];

  constructor(
    private readonly scene: THREE.Scene,
    private readonly world: World,
    private readonly player: Player,
    private readonly audio: AudioManager
  ) {
    this.bobber = this.createBobber();
    this.bobber.visible = false;
    this.scene.add(this.bobber);
    this.lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    this.line = new THREE.Line(
      this.lineGeometry,
      new THREE.LineBasicMaterial({ color: 0xd8e5e7, transparent: true, opacity: 0.86 })
    );
    this.line.visible = false;
    this.line.frustumCulled = false;
    this.scene.add(this.line);
  }

  public get isCast(): boolean { return this.active; }
  public get isBiting(): boolean { return this.biting; }

  public use(origin: THREE.Vector3, direction: THREE.Vector3): FishingUseResult {
    if (this.active) return this.reel();
    const hit = raycastWater(this.world, origin, direction, 22);
    if (!hit) {
      this.show('Aim the rod at open water.', 1.8);
      this.audio.playFishingFail();
      return { handled: true, rodWear: false };
    }
    let surfaceY = hit.blockY;
    while (surfaceY < hit.blockY + 5 && this.world.getBlock(hit.blockX, surfaceY + 1, hit.blockZ) === BlockId.Water) {
      surfaceY++;
    }
    if (!isFishableWater(this.world, hit.blockX, surfaceY, hit.blockZ)) {
      this.show('This water is too small to fish.', 2.2);
      this.audio.playFishingFail();
      return { handled: true, rodWear: false };
    }
    this.active = true;
    this.biting = false;
    this.waterX = hit.blockX;
    this.waterY = surfaceY;
    this.waterZ = hit.blockZ;
    this.quality = getWaterQuality(this.world, hit.blockX, surfaceY, hit.blockZ);
    this.timer = this.nextBiteDelay();
    this.bobber.position.set(hit.blockX + 0.5, surfaceY + 0.82, hit.blockZ + 0.5);
    this.bobber.visible = true;
    this.line.visible = true;
    this.spawnSplash(0x7dd3fc);
    this.show(`${this.qualityName()} water · Waiting for a bite…`, 0);
    this.audio.playFishingCast();
    return { handled: true, rodWear: false };
  }

  public update(dt: number, holdingRod: boolean): void {
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) {
        if (this.active && !this.biting) this.show(`${this.qualityName()} water · Waiting for a bite…`, 0);
        else if (!this.active) this.statusEl.classList.add('hidden');
      }
    }
    this.updateSplashes(dt);
    if (!this.active) return;
    if (!holdingRod || this.player.position.distanceToSquared(this.bobber.position) > 28 * 28) {
      this.cancel();
      return;
    }
    this.timer -= dt;
    if (!this.biting && this.timer <= 0) {
      this.biting = true;
      this.timer = 1.15;
      this.show('BITE! Right-click now!', 0);
      this.spawnSplash(0xffffff);
      this.audio.playFishingBite();
    } else if (this.biting && this.timer <= 0) {
      this.biting = false;
      this.timer = this.nextBiteDelay();
      this.show('The fish escaped… waiting again.', 1.4);
      this.audio.playFishingFail();
    }
    const bob = this.biting ? -0.2 + Math.sin(this.timer * 24) * 0.08 : Math.sin(performance.now() * 0.003) * 0.025;
    this.bobber.position.y = this.waterY + 0.82 + bob;
    this.updateLine();
  }

  public cancel(): void {
    this.active = false;
    this.biting = false;
    this.bobber.visible = false;
    this.line.visible = false;
    this.statusEl.classList.add('hidden');
  }

  private reel(): FishingUseResult {
    const catchPosition = this.bobber.position.clone();
    if (!this.biting) {
      this.show('Reeled in too soon.', 1.5);
      this.audio.playFishingFail();
      this.finishCast();
      return { handled: true, rodWear: true };
    }
    const item = selectFishingCatch(
      this.world,
      this.quality,
      this.waterX,
      this.waterY,
      this.waterZ,
      Math.random()
    );
    this.show(`Caught ${this.itemCatchName(item)}!`, 2.1);
    this.audio.playFishingCatch(item === ItemId.CrystalFish);
    this.finishCast();
    return { handled: true, rodWear: true, catchStack: createStack(item), catchPosition };
  }

  private finishCast(): void {
    this.active = false;
    this.biting = false;
    this.bobber.visible = false;
    this.line.visible = false;
  }

  private nextBiteDelay(): number {
    const base = this.quality === 'fresh' ? 3.5 : this.quality === 'murky' ? 5 : 6;
    return base + Math.random() * (this.quality === 'fresh' ? 4.5 : 6);
  }

  private qualityName(): string {
    return this.quality === 'fresh' ? 'Fresh' : this.quality === 'murky' ? 'Murky' : 'Tainted';
  }

  private itemCatchName(item: ItemId): string {
    if (item === ItemId.RawRiverFish) return 'a River Fish';
    if (item === ItemId.RawCaveFish) return 'a Cave Fish';
    if (item === ItemId.CrystalFish) return 'a rare Crystal Fish';
    if (item === ItemId.BlightedFish) return 'a Blighted Fish';
    if (item === ItemId.GoldIngot || item === ItemId.CrystalShard) return 'sunken treasure';
    return 'some old junk';
  }

  private show(message: string, seconds: number): void {
    this.statusEl.textContent = message;
    this.statusEl.classList.remove('hidden');
    this.messageTimer = seconds;
  }

  private updateLine(): void {
    const position = this.lineGeometry.getAttribute('position') as THREE.BufferAttribute;
    const hand = this.player.getEyePosition().addScaledVector(this.player.getForwardDirection(), 0.28);
    hand.y -= 0.28;
    position.setXYZ(0, hand.x, hand.y, hand.z);
    position.setXYZ(1, this.bobber.position.x, this.bobber.position.y, this.bobber.position.z);
    position.needsUpdate = true;
  }

  private createBobber(): THREE.Group {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xf3f4e8 })
    );
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 8, 5),
      new THREE.MeshBasicMaterial({ color: 0xd54d4d })
    );
    cap.position.y = 0.085;
    group.add(body, cap);
    return group;
  }

  private spawnSplash(color: number): void {
    for (let i = 0; i < 7; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.035, 0.035),
        new THREE.MeshBasicMaterial({ color, transparent: true })
      );
      const angle = (i / 7) * Math.PI * 2;
      mesh.position.set(
        this.waterX + 0.5 + Math.cos(angle) * 0.14,
        this.waterY + 0.93,
        this.waterZ + 0.5 + Math.sin(angle) * 0.14
      );
      mesh.userData.vx = Math.cos(angle) * 0.45;
      mesh.userData.vy = 0.7 + (i % 3) * 0.12;
      mesh.userData.vz = Math.sin(angle) * 0.45;
      this.scene.add(mesh);
      this.splashes.push({ mesh, age: 0 });
    }
  }

  private updateSplashes(dt: number): void {
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const splash = this.splashes[i];
      splash.age += dt;
      splash.mesh.position.x += splash.mesh.userData.vx * dt;
      splash.mesh.position.y += splash.mesh.userData.vy * dt;
      splash.mesh.position.z += splash.mesh.userData.vz * dt;
      splash.mesh.userData.vy -= 3.2 * dt;
      (splash.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - splash.age / 0.55);
      if (splash.age >= 0.55) {
        this.scene.remove(splash.mesh);
        splash.mesh.geometry.dispose();
        (splash.mesh.material as THREE.Material).dispose();
        this.splashes.splice(i, 1);
      }
    }
  }
}
