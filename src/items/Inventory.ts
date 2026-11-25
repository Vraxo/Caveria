import { ITEMS, ItemId, ItemStack, createStack } from './Item';

export const HOTBAR_SIZE = 9;
export const MAIN_INVENTORY_SIZE = 27;
export const TOTAL_INVENTORY_SLOTS = HOTBAR_SIZE + MAIN_INVENTORY_SIZE; // 36

export class Inventory {
  /** Slots 0..8 = Hotbar, Slots 9..35 = Main Backpack */
  public readonly slots: Array<ItemStack | null> = new Array(TOTAL_INVENTORY_SLOTS).fill(null);
  private readonly listeners: Array<() => void> = [];

  constructor() {
    // A modest starter kit leaves room for gathering while preventing an immediate hunger spiral.
    this.slots[0] = createStack(ItemId.Torch, 4);
    this.slots[1] = createStack(ItemId.CaveBerries, 3);
  }

  public onChange(cb: () => void): void {
    this.listeners.push(cb);
  }

  public notify(): void {
    for (const cb of this.listeners) {
      cb();
    }
  }

  public getSlot(index: number): ItemStack | null {
    return this.slots[index] ?? null;
  }

  public restore(savedSlots: Array<ItemStack | null>): void {
    for (let i = 0; i < TOTAL_INVENTORY_SLOTS; i++) {
      const stack = savedSlots[i];
      this.slots[i] = stack ? { ...stack } : null;
    }
    this.notify();
  }

  public snapshot(): Array<ItemStack | null> {
    return this.slots.map((stack) => (stack ? { ...stack } : null));
  }

  public setSlot(index: number, stack: ItemStack | null): void {
    if (index < 0 || index >= TOTAL_INVENTORY_SLOTS) return;
    this.slots[index] = stack && stack.count > 0 ? stack : null;
    this.notify();
  }

  /**
   * Attempts to insert `stack` into existing matching stacks first (hotbar -> backpack),
   * then into empty slots. Mutates `stack.count` to any remainder that didn't fit.
   * Returns true if at least 1 item was picked up.
   */
  public addItem(stack: ItemStack): boolean {
    if (stack.count <= 0) return false;
    const def = ITEMS[stack.id];
    const initialCount = stack.count;

    // 1. Merge into existing partial stacks
    if (def.maxStack > 1) {
      for (let i = 0; i < TOTAL_INVENTORY_SLOTS && stack.count > 0; i++) {
        const existing = this.slots[i];
        if (existing && existing.id === stack.id && existing.count < def.maxStack) {
          const space = def.maxStack - existing.count;
          const transfer = Math.min(space, stack.count);
          existing.count += transfer;
          stack.count -= transfer;
        }
      }
    }

    // 2. Place into empty slots
    for (let i = 0; i < TOTAL_INVENTORY_SLOTS && stack.count > 0; i++) {
      if (this.slots[i] === null) {
        const transfer = Math.min(def.maxStack, stack.count);
        this.slots[i] = {
          id: stack.id,
          count: transfer,
          durability: stack.durability,
        };
        stack.count -= transfer;
      }
    }

    if (stack.count !== initialCount) {
      this.notify();
      return true;
    }
    return false;
  }

  /** Consumes 1 item from `slotIndex` (unless in Creative mode). */
  public consumeOne(slotIndex: number): void {
    const cur = this.slots[slotIndex];
    if (!cur) return;
    cur.count -= 1;
    if (cur.count <= 0) {
      this.slots[slotIndex] = null;
    }
    this.notify();
  }

  /** Reduces durability of tool in `slotIndex` by 1; breaks tool at 0. */
  public damageTool(slotIndex: number): boolean {
    const cur = this.slots[slotIndex];
    if (!cur || cur.durability === undefined) return false;
    cur.durability -= 1;
    let broke = false;
    if (cur.durability <= 0) {
      this.slots[slotIndex] = null;
      broke = true;
    }
    this.notify();
    return broke;
  }
}
