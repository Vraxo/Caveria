import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { BlockId } from '../content/BlockId';
import { isBlockSolid } from '../content/BlockQueries';
import { ItemId, ItemStack, createStack } from '../items/Item';
import { Player } from '../player/Player';
import { DayNightCycle } from '../rendering/DayNightCycle';
import { WeatherSystem } from '../rendering/WeatherSystem';
import { World } from '../world/World';

export interface BedSnapshot {
  footX: number;
  footY: number;
  footZ: number;
  headX: number;
  headY: number;
  headZ: number;
}

/** Two-block bed placement, sleeping, safe respawn selection, feedback, and persistence. */
export class BedManager {
  private readonly beds = new Map<string, BedSnapshot>();
  private readonly partToFoot = new Map<string, string>();
  private respawnFootKey: string | null = null;
  private messageTimer = 0;
  private sleepTimer = 0;
  private readonly messageEl = document.getElementById('survival-message')!;
  private readonly sleepFadeEl = document.getElementById('sleep-fade')!;

  constructor(
    private readonly world: World,
    private readonly player: Player,
    private readonly dayNight: DayNightCycle,
    private readonly weather: WeatherSystem,
    private readonly dangerNearby: (position: THREE.Vector3, radius: number) => boolean,
    private readonly audio: AudioManager,
    snapshots: BedSnapshot[] | undefined,
    respawnBed: [number, number, number] | null | undefined,
    private readonly dropItem: (x: number, y: number, z: number, stack: ItemStack) => void,
    private readonly onSlept: () => void = () => {}
  ) {
    for (const snapshot of snapshots ?? []) this.register(snapshot);
    if (respawnBed) this.respawnFootKey = this.key(respawnBed[0], respawnBed[1], respawnBed[2]);
  }

  public update(dt: number): void {
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.messageEl.classList.remove('visible');
    }
    if (this.sleepTimer > 0) {
      this.sleepTimer -= dt;
      if (this.sleepTimer <= 0) this.sleepFadeEl.classList.remove('active');
    }
  }

  public place(footX: number, footY: number, footZ: number): boolean {
    const forward = this.player.getForwardDirection();
    const dx = Math.abs(forward.x) > Math.abs(forward.z) ? Math.sign(forward.x) : 0;
    const dz = dx === 0 ? Math.sign(forward.z) : 0;
    const headX = footX + dx;
    const headZ = footZ + dz;
    if (
      !this.canPlacePart(footX, footY, footZ) ||
      !this.canPlacePart(headX, footY, headZ) ||
      this.hasOverheadObstruction(footX, footY, footZ) ||
      this.hasOverheadObstruction(headX, footY, headZ) ||
      this.player.intersectsBlock(footX, footY, footZ) ||
      this.player.intersectsBlock(headX, footY, headZ)
    ) {
      this.showMessage('The bed needs two clear, supported blocks.');
      return false;
    }

    if (!this.world.setBlock(footX, footY, footZ, BlockId.BedFoot)) return false;
    if (!this.world.setBlock(headX, footY, headZ, BlockId.BedHead)) {
      this.world.setBlock(footX, footY, footZ, BlockId.Air);
      return false;
    }
    this.register({
      footX, footY, footZ,
      headX, headY: footY, headZ,
    });
    this.showMessage('Bed placed. Rest here at night.');
    return true;
  }

  public use(x: number, y: number, z: number): void {
    const bed = this.findBed(x, y, z);
    if (!bed) {
      this.showMessage('This bed is incomplete.');
      return;
    }
    if (this.isObstructed(bed)) {
      this.showMessage('The bed is obstructed.');
      return;
    }
    this.respawnFootKey = this.key(bed.footX, bed.footY, bed.footZ);
    if (!this.dayNight.isNight) {
      this.showMessage('Respawn point set. You can only sleep at night.');
      return;
    }
    if (this.dangerNearby(this.player.position, 10)) {
      this.showMessage('You may not rest; danger is nearby.');
      return;
    }

    this.dayNight.skipToMorning();
    this.weather.clearOrdinaryRain();
    this.audio.playSleep();
    this.onSlept();
    this.sleepTimer = 1.2;
    this.sleepFadeEl.classList.add('active');
    this.showMessage('Respawn point set. Dawn breaks over Caveria.');
  }

  public breakAt(x: number, y: number, z: number, drop: boolean): void {
    const bed = this.findBed(x, y, z);
    if (!bed) return;
    this.world.setBlock(bed.footX, bed.footY, bed.footZ, BlockId.Air);
    this.world.setBlock(bed.headX, bed.headY, bed.headZ, BlockId.Air);
    const footKey = this.key(bed.footX, bed.footY, bed.footZ);
    this.beds.delete(footKey);
    this.partToFoot.delete(footKey);
    this.partToFoot.delete(this.key(bed.headX, bed.headY, bed.headZ));
    if (this.respawnFootKey === footKey) {
      this.respawnFootKey = null;
      this.showMessage('Your respawn bed was destroyed.');
    }
    if (drop) {
      this.dropItem(bed.footX + 0.5, bed.footY + 0.5, bed.footZ + 0.5, createStack(ItemId.Bed));
    }
  }

  public getRespawnBedLocation(): THREE.Vector3 | null {
    const bed = this.respawnFootKey ? this.beds.get(this.respawnFootKey) : null;
    return bed ? new THREE.Vector3(bed.footX + 0.5, bed.footY, bed.footZ + 0.5) : null;
  }

  public getRespawnPoint(): THREE.Vector3 | null {
    if (!this.respawnFootKey) return null;
    const bed = this.beds.get(this.respawnFootKey);
    if (!bed || !this.isIntact(bed) || this.isObstructed(bed)) {
      this.respawnFootKey = null;
      return null;
    }
    const safe = this.findSafeAdjacentPosition(bed);
    if (!safe) this.respawnFootKey = null;
    return safe;
  }

  public snapshots(): BedSnapshot[] {
    return [...this.beds.values()].map((bed) => ({ ...bed }));
  }

  public respawnSnapshot(): [number, number, number] | null {
    const bed = this.respawnFootKey ? this.beds.get(this.respawnFootKey) : null;
    return bed ? [bed.footX, bed.footY, bed.footZ] : null;
  }

  private canPlacePart(x: number, y: number, z: number): boolean {
    const support = this.world.getBlock(x, y - 1, z);
    return this.world.getBlock(x, y, z) === BlockId.Air &&
      isBlockSolid(support) && support !== BlockId.BedFoot && support !== BlockId.BedHead;
  }

  private hasOverheadObstruction(x: number, y: number, z: number): boolean {
    return this.world.getBlock(x, y + 1, z) !== BlockId.Air;
  }

  private isIntact(bed: BedSnapshot): boolean {
    return this.world.getBlock(bed.footX, bed.footY, bed.footZ) === BlockId.BedFoot &&
      this.world.getBlock(bed.headX, bed.headY, bed.headZ) === BlockId.BedHead;
  }

  private isObstructed(bed: BedSnapshot): boolean {
    return this.world.getBlock(bed.footX, bed.footY + 1, bed.footZ) !== BlockId.Air ||
      this.world.getBlock(bed.headX, bed.headY + 1, bed.headZ) !== BlockId.Air;
  }

  private findSafeAdjacentPosition(bed: BedSnapshot): THREE.Vector3 | null {
    const candidates: Array<[number, number]> = [
      [bed.footX + 1, bed.footZ], [bed.footX - 1, bed.footZ],
      [bed.footX, bed.footZ + 1], [bed.footX, bed.footZ - 1],
      [bed.headX + 1, bed.headZ], [bed.headX - 1, bed.headZ],
      [bed.headX, bed.headZ + 1], [bed.headX, bed.headZ - 1],
    ];
    for (const [x, z] of candidates) {
      if (
        this.world.getBlock(x, bed.footY, z) === BlockId.Air &&
        this.world.getBlock(x, bed.footY + 1, z) === BlockId.Air &&
        isBlockSolid(this.world.getBlock(x, bed.footY - 1, z))
      ) {
        return new THREE.Vector3(x + 0.5, bed.footY, z + 0.5);
      }
    }
    return null;
  }

  private register(snapshot: BedSnapshot): void {
    const bed = { ...snapshot };
    const footKey = this.key(bed.footX, bed.footY, bed.footZ);
    this.beds.set(footKey, bed);
    this.partToFoot.set(footKey, footKey);
    this.partToFoot.set(this.key(bed.headX, bed.headY, bed.headZ), footKey);
  }

  private findBed(x: number, y: number, z: number): BedSnapshot | null {
    const footKey = this.partToFoot.get(this.key(x, y, z));
    return footKey ? (this.beds.get(footKey) ?? null) : null;
  }

  private showMessage(message: string): void {
    this.messageEl.textContent = message;
    this.messageEl.classList.add('visible');
    this.messageTimer = 3.2;
  }

  private key(x: number, y: number, z: number): string {
    return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
  }
}
