import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { Player } from '../player/Player';
import { PlayerVitals } from '../player/PlayerVitals';
import { BreakParticles } from '../rendering/BreakParticles';
import { DroppedItemManager } from '../rendering/DroppedItems';
import { World } from '../world/World';
import { CaveCrawlerHit, CaveCrawlerManager } from './CaveCrawlerManager';
import { CrystalMiteHit, CrystalMiteManager } from './CrystalMiteManager';

export type MobHit = CrystalMiteHit | CaveCrawlerHit;

/** Routes shared spawning, targeting, and damage across all mob species. */
export class MobManager {
  public readonly mites: CrystalMiteManager;
  public readonly crawlers: CaveCrawlerManager;

  constructor(
    scene: THREE.Scene,
    world: World,
    player: Player,
    vitals: PlayerVitals,
    drops: DroppedItemManager,
    particles: BreakParticles,
    audio: AudioManager
  ) {
    this.mites = new CrystalMiteManager(scene, world, player, drops, particles, audio);
    this.crawlers = new CaveCrawlerManager(scene, world, player, vitals, drops, particles, audio);
  }

  public get count(): number { return this.mites.count + this.crawlers.count; }

  public update(dt: number): void {
    this.mites.update(dt);
    this.crawlers.update(dt);
  }

  public raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number, blockDistance: number): MobHit | null {
    const mite = this.mites.raycast(origin, direction, maxDistance, blockDistance);
    const crawler = this.crawlers.raycast(origin, direction, maxDistance, blockDistance);
    if (!mite) return crawler;
    if (!crawler) return mite;
    return mite.distance < crawler.distance ? mite : crawler;
  }

  public damage(hit: MobHit, amount: number, direction: THREE.Vector3): boolean {
    return hit.kind === 'crystal-mite'
      ? this.mites.damage(hit.id, amount, direction)
      : this.crawlers.damage(hit.id, amount, direction);
  }
}
