import { AudioManager } from '../audio/AudioManager';
import { BlockId } from '../content/BlockId';
import {
  STATUS_EFFECT_DEFINITIONS,
  StatusEffectId,
  StatusEffectSnapshot,
} from '../content/effects/StatusEffectDefinitions';

export type { StatusEffectId, StatusEffectSnapshot } from '../content/effects/StatusEffectDefinitions';
import { Player } from '../player/Player';
import { PlayerVitals } from '../player/PlayerVitals';
import { TemperatureSystem } from './TemperatureSystem';
import { WaterQuality } from './WaterQuality';
import { World } from '../world/World';

/** Timed survival effects, medicine consumption, cold exposure, and contact hazards. */
export class StatusEffectManager {
  private readonly effects = new Map<StatusEffectId, number>();
  private poisonTick = 1.5;
  private healingTick = 2;
  private wellFedTick = 5;
  private cactusTick = 0;
  private severeColdSeconds = 0;
  private elapsed = 0;
  private readonly hudEl = document.getElementById('status-effects')!;
  private readonly messageEl = document.getElementById('survival-message')!;
  private messageTimer = 0;

  constructor(
    private readonly world: World,
    private readonly player: Player,
    private readonly vitals: PlayerVitals,
    private readonly temperature: TemperatureSystem,
    private readonly audio: AudioManager,
    snapshots: StatusEffectSnapshot[] | undefined
  ) {
    for (const effect of snapshots ?? []) this.effects.set(effect.id, effect.remaining);
    this.render();
  }

  public update(dt: number, creativeMode: boolean): void {
    this.elapsed += dt;
    for (const [id, remaining] of this.effects) {
      const next = remaining - dt;
      if (next <= 0) this.effects.delete(id);
      else this.effects.set(id, next);
    }

    const hydrated = this.has('hydrated');
    this.temperature.setStatusModifiers(
      this.has('warmth') ? 18 : 0,
      this.has('warmth') ? 0.65 : 0,
      hydrated
    );
    this.vitals.setExhaustionMultiplier(hydrated ? 0.72 : 1);
    this.vitals.setUnderwaterAirDrainMultiplier(this.has('water-breathing') ? 0.2 : 1);

    if (!creativeMode) {
      this.updateColdExposure(dt);
      this.updatePeriodicEffects(dt);
      this.updateCactus(dt);
    }
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.messageEl.classList.remove('visible');
    }
    this.render();
  }

  public drinkWater(quality: WaterQuality): void {
    const hydratedSeconds = quality === 'fresh' ? 140 : quality === 'murky' ? 80 : 50;
    this.addEffect('hydrated', hydratedSeconds);
    if (quality === 'murky') {
      this.addEffect('nausea', 20);
      if (Math.random() < 0.25) this.poison(12);
      else this.notify('Murky water · Hydrated, but nauseous');
    } else if (quality === 'tainted') {
      this.addEffect('nausea', 35);
      if (Math.random() < 0.65) this.poison(18);
      else this.notify('Tainted water · You feel sick');
    } else {
      this.notify('Fresh water · Hydrated');
    }
    this.audio.playDrink();
  }

  public poison(seconds: number): boolean {
    if (this.has('antidote')) {
      this.notify('Antidote neutralized the poison.');
      return false;
    }
    this.addEffect('poisoned', seconds);
    this.notify('Poisoned! Use an Antidote.');
    return true;
  }

  public get movementMultiplier(): number {
    return (this.has('chilled') ? 0.82 : 1) * (this.has('nausea') ? 0.9 : 1);
  }
  public get miningMultiplier(): number { return this.has('chilled') ? 0.72 : 1; }
  public get cameraSway(): number {
    return this.has('nausea') ? Math.sin(this.elapsed * 2.1) * 0.018 + Math.sin(this.elapsed * 0.73) * 0.01 : 0;
  }
  public has(id: StatusEffectId): boolean { return (this.effects.get(id) ?? 0) > 0; }
  public removeEffect(id: StatusEffectId): void { this.effects.delete(id); }

  public snapshots(): StatusEffectSnapshot[] {
    return [...this.effects].map(([id, remaining]) => ({ id, remaining }));
  }

  public addEffect(id: StatusEffectId, seconds: number): void {
    this.effects.set(id, Math.max(this.effects.get(id) ?? 0, seconds));
  }

  private updateColdExposure(dt: number): void {
    if (this.temperature.temperature < 20 && !this.has('warmth')) {
      this.severeColdSeconds += dt;
      if (this.severeColdSeconds >= 8) {
        this.addEffect('chilled', 12);
        this.severeColdSeconds = 0;
      }
    } else {
      this.severeColdSeconds = Math.max(0, this.severeColdSeconds - dt * 2);
    }
  }

  private updatePeriodicEffects(dt: number): void {
    if (this.has('poisoned')) {
      this.poisonTick -= dt;
      if (this.poisonTick <= 0) {
        this.poisonTick = 2.2;
        this.vitals.damageNonLethal(1, 'poison');
      }
    } else this.poisonTick = 1.5;

    if (this.has('regeneration')) {
      this.healingTick -= dt;
      if (this.healingTick <= 0) {
        this.healingTick = 2;
        this.vitals.heal(1);
      }
    } else this.healingTick = 2;

    if (this.has('well-fed') && this.vitals.hunger >= 12) {
      this.wellFedTick -= dt;
      if (this.wellFedTick <= 0) {
        this.wellFedTick = 5;
        if (this.vitals.heal(1)) this.vitals.addExhaustion(0.65);
      }
    } else this.wellFedTick = 5;
  }

  private updateCactus(dt: number): void {
    this.cactusTick = Math.max(0, this.cactusTick - dt);
    if (this.cactusTick > 0) return;
    const x = this.player.position.x;
    const y = this.player.position.y;
    const z = this.player.position.z;
    for (const ox of [-0.28, 0.28]) for (const oz of [-0.28, 0.28]) {
      if (this.world.getBlock(x + ox, y + 0.2, z + oz) === BlockId.Cactus ||
          this.world.getBlock(x + ox, y + 1.2, z + oz) === BlockId.Cactus) {
        this.cactusTick = 1;
        this.vitals.damage(1, 'environment');
        return;
      }
    }
  }

  public notify(message: string): void {
    this.messageEl.textContent = message;
    this.messageEl.classList.add('visible');
    this.messageTimer = 3.2;
  }

  private render(): void {
    this.hudEl.replaceChildren();
    for (const [id, remaining] of this.effects) {
      const info = STATUS_EFFECT_DEFINITIONS[id];
      const effect = document.createElement('div');
      effect.className = `status-effect ${info.beneficial ? 'beneficial' : 'harmful'}`;
      effect.textContent = `${info.icon} ${info.name} ${Math.ceil(remaining)}s`;
      this.hudEl.append(effect);
    }
    this.hudEl.classList.toggle('hidden', this.effects.size === 0);
  }
}
