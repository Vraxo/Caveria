import { AudioManager } from '../audio/AudioManager';
import { ItemId } from '../items/Item';
import { VoxelHit } from '../player/Raycaster';
import { WeatherSystem } from '../rendering/WeatherSystem';
import { World } from '../world/World';
import { StatusEffectManager } from './StatusEffectManager';
import { getWaterQuality, WaterQuality } from './WaterQuality';

/** Water-quality feedback, source drinking, bottle filling, and rain collection. */
export class WaterSurvivalSystem {
  private readonly labelEl = document.getElementById('water-quality-label')!;

  constructor(
    private readonly world: World,
    private readonly weather: WeatherSystem,
    private readonly effects: StatusEffectManager,
    private readonly audio: AudioManager
  ) {}

  public updateTarget(hit: VoxelHit | null): void {
    this.labelEl.classList.toggle('hidden', !hit);
    if (!hit) return;
    const quality = this.qualityAt(hit.blockX, hit.blockY, hit.blockZ);
    this.labelEl.textContent = `${quality === 'fresh' ? '●' : quality === 'murky' ? '◐' : '☠'} ${this.label(quality)} Water`;
    this.labelEl.className = `water-${quality}`;
  }

  public drinkSource(x: number, y: number, z: number): void {
    this.effects.drinkWater(this.qualityAt(x, y, z));
  }

  public fillBottle(x: number, y: number, z: number): ItemId {
    const quality = this.qualityAt(x, y, z);
    this.audio.playDrink();
    return quality === 'fresh' ? ItemId.CleanWaterBottle : ItemId.DirtyWaterBottle;
  }

  public collectRain(): ItemId | null {
    if (this.weather.intensity < 0.18 || !this.weather.exposedToSky) return null;
    this.audio.playDrink();
    return ItemId.CleanWaterBottle;
  }

  public qualityAt(x: number, y: number, z: number): WaterQuality {
    return getWaterQuality(this.world, x, y, z);
  }

  private label(quality: WaterQuality): string {
    return quality === 'fresh' ? 'Fresh' : quality === 'murky' ? 'Murky' : 'Tainted';
  }
}
