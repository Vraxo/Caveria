import { AudioManager } from '../audio/AudioManager';
import { BlockId } from '../content/BlockId';
import { ItemId } from '../items/Item';
import { Player } from '../player/Player';
import { PlayerVitals } from '../player/PlayerVitals';
import { TemperatureSystem } from './TemperatureSystem';
import { WaterQuality } from './WaterQuality';
import { World } from '../world/World';

export type StatusEffectId = 'well-fed' | 'regeneration' | 'poisoned' | 'warmth' | 'chilled' | 'antidote' | 'hydrated' | 'nausea';
export interface StatusEffectSnapshot { id: StatusEffectId; remaining: number; }

const LABELS: Record<StatusEffectId, { icon: string; name: string; beneficial: boolean }> = {
  'well-fed': { icon: '◆', name: 'Well Fed', beneficial: true },
  regeneration: { icon: '♥', name: 'Regeneration', beneficial: true },
  poisoned: { icon: '☠', name: 'Poisoned', beneficial: false },
  warmth: { icon: '♨', name: 'Warmth', beneficial: true },
  chilled: { icon: '❄', name: 'Chilled', beneficial: false },
  antidote: { icon: '✚', name: 'Antidote', beneficial: true },
  hydrated: { icon: '●', name: 'Hydrated', beneficial: true },
  nausea: { icon: '≈', name: 'Nauseous', beneficial: false },
};

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

  public consume(itemId: ItemId): boolean {
    if (itemId === ItemId.HealingPoultice) {
      this.add('regeneration', 15);
      this.showMessage('Healing Poultice applied · Regeneration');
    } else if (itemId === ItemId.Antidote) {
      this.effects.delete('poisoned');
      this.add('antidote', 120);
      this.showMessage('Antidote taken · Poison immunity');
    } else if (itemId === ItemId.WarmingStew) {
      this.vitals.eat(8, 8);
      this.add('warmth', 180);
      this.add('well-fed', 120);
      this.showMessage('Warming Stew · Warmth and Well Fed');
    } else if (itemId === ItemId.CrystalTonic) {
      this.vitals.heal(6);
      this.add('regeneration', 10);
      this.showMessage('Crystal Tonic · Health restored');
    } else if (itemId === ItemId.PurifiedCrystalTonic) {
      this.vitals.heal(10);
      this.add('regeneration', 18);
      this.add('hydrated', 120);
      this.showMessage('Purified Tonic · Strong restoration and Hydrated');
    } else if (itemId === ItemId.CleanWaterBottle) {
      this.add('hydrated', 180);
      this.showMessage('Clean water · Hydrated');
    } else if (itemId === ItemId.DirtyWaterBottle) {
      this.add('hydrated', 90);
      this.add('nausea', 25);
      if (Math.random() < 0.35) this.poison(14);
      else this.showMessage('Dirty water · Hydrated, but nauseous');
    } else {
      return false;
    }
    if (itemId === ItemId.CleanWaterBottle || itemId === ItemId.DirtyWaterBottle || itemId === ItemId.PurifiedCrystalTonic) this.audio.playDrink();
    else this.audio.playMedicineUse();
    return true;
  }

  public drinkWater(quality: WaterQuality): void {
    const hydratedSeconds = quality === 'fresh' ? 140 : quality === 'murky' ? 80 : 50;
    this.add('hydrated', hydratedSeconds);
    if (quality === 'murky') {
      this.add('nausea', 20);
      if (Math.random() < 0.25) this.poison(12);
      else this.showMessage('Murky water · Hydrated, but nauseous');
    } else if (quality === 'tainted') {
      this.add('nausea', 35);
      if (Math.random() < 0.65) this.poison(18);
      else this.showMessage('Tainted water · You feel sick');
    } else {
      this.showMessage('Fresh water · Hydrated');
    }
    this.audio.playDrink();
  }

  public onFoodConsumed(itemId: ItemId): void {
    if (itemId === ItemId.CaveStew) {
      this.add('well-fed', 120);
      this.showMessage('Well Fed · Natural recovery improved');
    } else if (itemId === ItemId.DriedCaveBerries) {
      this.add('well-fed', 45);
    } else if (itemId === ItemId.SmokedCaveShroom) {
      this.add('warmth', 45);
    }
  }

  public poison(seconds: number): boolean {
    if (this.has('antidote')) {
      this.showMessage('Antidote neutralized the poison.');
      return false;
    }
    this.add('poisoned', seconds);
    this.showMessage('Poisoned! Use an Antidote.');
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

  public snapshots(): StatusEffectSnapshot[] {
    return [...this.effects].map(([id, remaining]) => ({ id, remaining }));
  }

  private add(id: StatusEffectId, seconds: number): void {
    this.effects.set(id, Math.max(this.effects.get(id) ?? 0, seconds));
  }

  private updateColdExposure(dt: number): void {
    if (this.temperature.temperature < 20 && !this.has('warmth')) {
      this.severeColdSeconds += dt;
      if (this.severeColdSeconds >= 8) {
        this.add('chilled', 12);
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

  private showMessage(message: string): void {
    this.messageEl.textContent = message;
    this.messageEl.classList.add('visible');
    this.messageTimer = 3.2;
  }

  private render(): void {
    this.hudEl.replaceChildren();
    for (const [id, remaining] of this.effects) {
      const info = LABELS[id];
      const effect = document.createElement('div');
      effect.className = `status-effect ${info.beneficial ? 'beneficial' : 'harmful'}`;
      effect.textContent = `${info.icon} ${info.name} ${Math.ceil(remaining)}s`;
      this.hudEl.append(effect);
    }
    this.hudEl.classList.toggle('hidden', this.effects.size === 0);
  }
}
