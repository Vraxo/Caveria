import { BlockId } from '../content/BlockId';
import { ItemStack } from '../items/Item';
import { World } from '../world/World';

export const CHEST_SLOT_COUNT = 27;

export interface ChestStateSnapshot {
  x: number;
  y: number;
  z: number;
  slots: Array<ItemStack | null>;
}

/** Persistent 27-slot inventories owned by placed chest blocks. */
export class ChestManager {
  private readonly states = new Map<string, ChestStateSnapshot>();

  constructor(
    private readonly world: World,
    snapshots: ChestStateSnapshot[] | undefined,
    private readonly dropItem: (x: number, y: number, z: number, stack: ItemStack) => void
  ) {
    for (const snapshot of snapshots ?? []) {
      const state = this.cloneState(snapshot);
      this.states.set(this.key(state.x, state.y, state.z), state);
    }
  }

  public getOrCreate(x: number, y: number, z: number): ChestStateSnapshot | null {
    const coords = { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) };
    if (this.world.getBlock(coords.x, coords.y, coords.z) !== BlockId.Chest) return null;
    const key = this.key(coords.x, coords.y, coords.z);
    let state = this.states.get(key);
    if (!state) {
      state = { ...coords, slots: new Array<ItemStack | null>(CHEST_SLOT_COUNT).fill(null) };
      this.states.set(key, state);
    }
    return state;
  }

  public breakAt(x: number, y: number, z: number): void {
    const key = this.key(x, y, z);
    const state = this.states.get(key);
    if (!state) return;
    for (const stack of state.slots) {
      if (stack && stack.count > 0) {
        this.dropItem(state.x + 0.5, state.y + 0.55, state.z + 0.5, { ...stack });
      }
    }
    this.states.delete(key);
  }

  public snapshots(): ChestStateSnapshot[] {
    return [...this.states.values()].map((state) => this.cloneState(state));
  }

  private cloneState(state: ChestStateSnapshot): ChestStateSnapshot {
    return {
      x: Math.floor(state.x),
      y: Math.floor(state.y),
      z: Math.floor(state.z),
      slots: Array.from({ length: CHEST_SLOT_COUNT }, (_, index) => {
        const stack = state.slots[index];
        return stack ? { ...stack } : null;
      }),
    };
  }

  private key(x: number, y: number, z: number): string {
    return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
  }
}
