import { AudioManager } from '../audio/AudioManager';
import { BLOCKS } from '../content/BlockRegistry';
import { isBlockSolid } from '../content/BlockQueries';
import { ArmorManager } from '../player/ArmorManager';
import { Player } from '../player/Player';
import { PlayerVitals } from '../player/PlayerVitals';
import { DayNightCycle } from '../rendering/DayNightCycle';
import { WeatherSystem } from '../rendering/WeatherSystem';
import { World } from '../world/World';

export type TemperatureState = 'Freezing' | 'Chilled' | 'Comfortable' | 'Warm' | 'Overheated';

/** Body temperature driven by biome, time, weather, water, shelter, armor, and heat blocks. */
export class TemperatureSystem {
  public temperature = 50;
  public state: TemperatureState = 'Comfortable';
  public sheltered = false;

  private statusWarmthBonus = 0;
  private statusColdResistance = 0;
  private statusHydrated = false;
  private damageTimer = 4;
  private warningTimer = 2;
  private readonly hudEl = document.getElementById('temperature-hud')!;
  private readonly frostEl = document.getElementById('frost-vignette')!;
  private readonly heatEl = document.getElementById('heat-vignette')!;

  constructor(
    private readonly world: World,
    private readonly player: Player,
    private readonly dayNight: DayNightCycle,
    private readonly weather: WeatherSystem,
    private readonly armor: ArmorManager,
    private readonly vitals: PlayerVitals,
    private readonly audio: AudioManager,
    savedTemperature?: number
  ) {
    this.temperature = Math.max(0, Math.min(100, savedTemperature ?? 50));
    this.render();
  }

  public update(dt: number, creativeMode: boolean): void {
    const target = this.getTargetTemperature();
    const insulation = this.armor.hasFullChitinSet ? 0.58 : this.armor.hasFullGoldSet ? 0.72 : 1;
    this.temperature += (target - this.temperature) * (1 - Math.exp(-dt * 0.022 * insulation));
    this.temperature = Math.max(0, Math.min(100, this.temperature));
    this.state = this.getState();

    if (!creativeMode && this.temperature >= 75) {
      const hydrationScale = this.statusHydrated ? 0.45 : 1;
      this.vitals.addExhaustion(dt * (this.temperature >= 90 ? 0.09 : 0.035) * hydrationScale);
    }
    const extreme = this.temperature <= 9 || this.temperature >= 91;
    if (!creativeMode && extreme) {
      this.damageTimer -= dt;
      this.warningTimer -= dt;
      if (this.damageTimer <= 0) {
        this.damageTimer = 4;
        this.vitals.damage(1, 'temperature');
      }
      if (this.warningTimer <= 0) {
        this.warningTimer = 7;
        this.audio.playTemperatureWarning(this.temperature < 50);
      }
    } else {
      this.damageTimer = 4;
      this.warningTimer = Math.min(this.warningTimer, 2);
    }
    this.render();
  }

  public setStatusModifiers(warmthBonus: number, coldResistance: number, hydrated = false): void {
    this.statusWarmthBonus = Math.max(0, warmthBonus);
    this.statusColdResistance = Math.max(0, Math.min(1, coldResistance));
    this.statusHydrated = hydrated;
  }

  public recoverAfterSleep(): void {
    if (this.temperature < 20 || this.temperature > 80) return;
    this.temperature += (50 - this.temperature) * 0.25;
    this.render();
  }

  public get movementMultiplier(): number {
    if (this.temperature >= 25) return 1;
    return 0.75 + Math.max(0, this.temperature) / 25 * 0.25;
  }

  private getTargetTemperature(): number {
    const x = Math.floor(this.player.position.x);
    const y = Math.floor(this.player.position.y);
    const z = Math.floor(this.player.position.z);
    const surface = this.world.terrainGen.getSurfaceHeight(x, z);
    const underground = y < surface - 7;
    const night = this.dayNight.isNight;
    let target = 50;
    if (underground) {
      target = y < 25 ? 38 : 44;
    } else {
      const biome = this.world.terrainGen.getSurfaceBiomeDefinition(x, z, surface);
      target = night ? biome.temperature.night : biome.temperature.day;
      target -= Math.max(0, y - 70) * 0.55;
    }

    const sky = (this.world.getPackedLight(x, y + this.player.eyeHeight, z) >> 4) & 0xf;
    this.sheltered = sky < 13 || this.enclosureScore(x, y, z) >= 3;
    if (!this.sheltered && this.weather.intensity > 0.1) {
      target -= (this.weather.phase === 'storm' ? 18 : 12) * this.weather.intensity;
    }
    if (this.player.isInWater(this.world)) target -= 24;
    if (this.sheltered) target = target * 0.62 + 50 * 0.38;
    target += this.nearbyWarmth(x, y, z) + this.statusWarmthBonus;
    if (target < 50 && this.statusColdResistance > 0) {
      target += (50 - target) * this.statusColdResistance;
    }

    if (this.armor.hasFullChitinSet) target += target < 50 ? 8 : -4;
    if (this.armor.hasFullGoldSet) target += target < 50 ? 6 : 4;
    return Math.max(0, Math.min(100, target));
  }

  private enclosureScore(x: number, y: number, z: number): number {
    let walls = 0;
    for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
      for (let oy = 0; oy <= 2; oy++) {
        if (isBlockSolid(this.world.getBlock(x + dx, y + oy, z + dz))) { walls++; break; }
      }
    }
    return walls;
  }

  private nearbyWarmth(x: number, y: number, z: number): number {
    let warmth = 0;
    for (let dz = -6; dz <= 6; dz++) for (let dy = -3; dy <= 3; dy++) for (let dx = -6; dx <= 6; dx++) {
      const distance = Math.hypot(dx, dy, dz);
      if (distance > 6) continue;
      const block = this.world.getBlock(x + dx, y + dy, z + dz);
      const strength = BLOCKS[block].heatSource ?? 0;
      if (strength > 0) warmth = Math.max(warmth, strength * (1 - distance / 7));
    }
    return warmth;
  }

  private getState(): TemperatureState {
    if (this.temperature <= 12) return 'Freezing';
    if (this.temperature < 35) return 'Chilled';
    if (this.temperature < 65) return 'Comfortable';
    if (this.temperature < 88) return 'Warm';
    return 'Overheated';
  }

  private render(): void {
    const notable = this.state !== 'Comfortable';
    this.hudEl.classList.toggle('hidden', !notable);
    this.hudEl.classList.toggle('cold', this.temperature < 35);
    this.hudEl.classList.toggle('hot', this.temperature >= 65);
    this.hudEl.textContent = `${this.temperature < 35 ? '❄' : '♨'} ${this.state} · ${Math.round(this.temperature)}${this.sheltered ? ' · Sheltered' : ''}`;
    this.frostEl.style.opacity = String(Math.max(0, (25 - this.temperature) / 30));
    this.heatEl.style.opacity = String(Math.max(0, (this.temperature - 75) / 30));
  }
}
