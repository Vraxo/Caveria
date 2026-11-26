import { AudioManager } from '../audio/AudioManager';
import {
  CONSUMABLE_DEFINITIONS,
  ConsumableActionId,
  ConsumableDefinition,
} from '../content/consumables/ConsumableDefinitions';
import { ItemId } from '../items/Item';
import { PlayerVitals } from '../player/PlayerVitals';
import { StatusEffectManager } from './StatusEffectManager';

export type ConsumableAction = () => void;

/** Resolves declarative consumables to separately registered survival actions. */
export class ConsumableActionRegistry {
  private readonly actions = new Map<ConsumableActionId, ConsumableAction>();

  public constructor(private readonly audio: AudioManager) {}

  public register(id: ConsumableActionId, action: ConsumableAction): this {
    if (this.actions.has(id)) throw new Error(`Duplicate consumable action: ${id}`);
    this.actions.set(id, action);
    return this;
  }

  public consumeDirect(item: ItemId): ConsumableDefinition | null {
    const definition = CONSUMABLE_DEFINITIONS[item];
    if (!definition || definition.trigger !== 'direct') return null;
    this.execute(definition);
    return definition;
  }

  public afterFood(item: ItemId): void {
    const definition = CONSUMABLE_DEFINITIONS[item];
    if (!definition || definition.trigger !== 'after-food') return;
    this.execute(definition);
  }

  private execute(definition: ConsumableDefinition): void {
    const action = this.actions.get(definition.action);
    if (!action) throw new Error(`Missing consumable action: ${definition.action}`);
    action();
    if (definition.sound === 'drink') this.audio.playDrink();
    else if (definition.sound === 'medicine') this.audio.playMedicineUse();
  }
}

export function createSurvivalConsumableRegistry(
  effects: StatusEffectManager,
  vitals: PlayerVitals,
  audio: AudioManager
): ConsumableActionRegistry {
  return new ConsumableActionRegistry(audio)
    .register('healing-poultice', () => {
      effects.addEffect('regeneration', 15);
      effects.notify('Healing Poultice applied · Regeneration');
    })
    .register('antidote', () => {
      effects.removeEffect('poisoned');
      effects.addEffect('antidote', 120);
      effects.notify('Antidote taken · Poison immunity');
    })
    .register('warming-stew', () => {
      vitals.eat(8, 8);
      effects.addEffect('warmth', 180);
      effects.addEffect('well-fed', 120);
      effects.notify('Warming Stew · Warmth and Well Fed');
    })
    .register('crystal-tonic', () => {
      vitals.heal(6);
      effects.addEffect('regeneration', 10);
      effects.notify('Crystal Tonic · Health restored');
    })
    .register('crystal-fish-tonic', () => {
      vitals.heal(4);
      effects.addEffect('hydrated', 90);
      effects.addEffect('water-breathing', 180);
      effects.notify('Crystal Fish Tonic · Water Breathing');
    })
    .register('purified-crystal-tonic', () => {
      vitals.heal(10);
      effects.addEffect('regeneration', 18);
      effects.addEffect('hydrated', 120);
      effects.notify('Purified Tonic · Strong restoration and Hydrated');
    })
    .register('clean-water', () => {
      effects.addEffect('hydrated', 180);
      effects.notify('Clean water · Hydrated');
    })
    .register('dirty-water', () => {
      effects.addEffect('hydrated', 90);
      effects.addEffect('nausea', 25);
      if (Math.random() < 0.35) effects.poison(14);
      else effects.notify('Dirty water · Hydrated, but nauseous');
    })
    .register('cave-stew', () => {
      effects.addEffect('well-fed', 120);
      effects.notify('Well Fed · Natural recovery improved');
    })
    .register('dried-cave-berries', () => effects.addEffect('well-fed', 45))
    .register('smoked-cave-shroom', () => effects.addEffect('warmth', 45))
    .register('blighted-fish', () => {
      effects.addEffect('nausea', 35);
      effects.poison(18);
    });
}
