import { ArmorSlot, ITEMS, ItemId, ItemStack } from '../items/Item';

export const ARMOR_SLOTS: readonly ArmorSlot[] = ['helmet', 'chestplate', 'leggings', 'boots'];
export const MAX_ARMOR_POINTS = 14;
export type ArmorSnapshot = Record<ArmorSlot, ItemStack | null>;

const CHITIN_SET: Record<ArmorSlot, ItemId> = {
  helmet: ItemId.ChitinHelmet,
  chestplate: ItemId.ChitinChestplate,
  leggings: ItemId.ChitinLeggings,
  boots: ItemId.ChitinBoots,
};
const GOLD_SET: Record<ArmorSlot, ItemId> = {
  helmet: ItemId.GoldHelmet,
  chestplate: ItemId.GoldChestplate,
  leggings: ItemId.GoldLeggings,
  boots: ItemId.GoldBoots,
};

type ArmorDamageCause = 'mob' | 'fall' | 'drowning' | 'starvation';

/** Owns equipped armor, mitigation, durability, full-set bonuses, and armor HUD state. */
export class ArmorManager {
  private readonly equipped: ArmorSnapshot = {
    helmet: null,
    chestplate: null,
    leggings: null,
    boots: null,
  };
  private readonly listeners: Array<() => void> = [];
  private readonly hudEl = document.getElementById('armor-pips')!;

  constructor(
    snapshot: Partial<ArmorSnapshot> | undefined,
    private readonly onEquip: () => void,
    private readonly onBreak: () => void
  ) {
    this.restore(snapshot);
  }

  public onChange(listener: () => void): void {
    this.listeners.push(listener);
  }

  public get(slot: ArmorSlot): ItemStack | null {
    const stack = this.equipped[slot];
    return stack ? { ...stack } : null;
  }

  public set(slot: ArmorSlot, stack: ItemStack | null, playSound = true): boolean {
    if (stack && ITEMS[stack.id].armorSlot !== slot) return false;
    this.equipped[slot] = stack ? { ...stack, count: 1 } : null;
    if (stack && playSound) this.onEquip();
    this.changed();
    return true;
  }

  /** Equips an armor stack and returns the displaced piece, if any. */
  public quickEquip(stack: ItemStack): ItemStack | null | undefined {
    const slot = ITEMS[stack.id].armorSlot;
    if (!slot) return undefined;
    const displaced = this.get(slot);
    this.set(slot, stack);
    return displaced;
  }

  public get armorPoints(): number {
    return ARMOR_SLOTS.reduce(
      (total, slot) => total + (this.equipped[slot] ? (ITEMS[this.equipped[slot]!.id].armorPoints ?? 0) : 0),
      0
    );
  }

  public get hasFullChitinSet(): boolean {
    return ARMOR_SLOTS.every((slot) => this.equipped[slot]?.id === CHITIN_SET[slot]);
  }

  public get hasFullGoldSet(): boolean {
    return ARMOR_SLOTS.every((slot) => this.equipped[slot]?.id === GOLD_SET[slot]);
  }

  public get knockbackMultiplier(): number {
    return this.hasFullChitinSet ? 0.55 : 1;
  }

  public mitigate(amount: number, cause: ArmorDamageCause): number {
    if (amount <= 0 || (cause !== 'mob' && cause !== 'fall')) return amount;
    const points = this.armorPoints;
    if (points <= 0) return amount;

    const reductionPerPoint = cause === 'mob' ? 0.05 : 0.025;
    const reduction = Math.min(cause === 'mob' ? 0.7 : 0.35, points * reductionPerPoint);
    const reduced = Math.max(1, Math.round(amount * (1 - reduction)));
    this.damageEquippedArmor();
    return reduced;
  }

  public snapshot(): ArmorSnapshot {
    return {
      helmet: this.get('helmet'),
      chestplate: this.get('chestplate'),
      leggings: this.get('leggings'),
      boots: this.get('boots'),
    };
  }

  private restore(snapshot: Partial<ArmorSnapshot> | undefined): void {
    for (const slot of ARMOR_SLOTS) {
      const stack = snapshot?.[slot];
      this.equipped[slot] = stack && ITEMS[stack.id]?.armorSlot === slot
        ? { ...stack, count: 1 }
        : null;
    }
    this.render();
  }

  private damageEquippedArmor(): void {
    let broke = false;
    for (const slot of ARMOR_SLOTS) {
      const stack = this.equipped[slot];
      if (!stack || stack.durability === undefined) continue;
      stack.durability--;
      if (stack.durability <= 0) {
        this.equipped[slot] = null;
        broke = true;
      }
    }
    if (broke) this.onBreak();
    this.changed();
  }

  private changed(): void {
    this.render();
    for (const listener of this.listeners) listener();
  }

  private render(): void {
    this.hudEl.replaceChildren();
    const points = this.armorPoints;
    for (let point = 0; point < MAX_ARMOR_POINTS; point++) {
      const element = document.createElement('span');
      element.className = `armor-pip${point >= points ? ' empty' : ''}`;
      element.textContent = '⬟';
      this.hudEl.append(element);
    }
    this.hudEl.classList.toggle('hidden', points === 0);
    this.hudEl.classList.toggle('gold-set', this.hasFullGoldSet);
  }
}
