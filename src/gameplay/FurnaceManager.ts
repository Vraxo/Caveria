import { AudioManager } from '../audio/AudioManager';
import { BlockId } from '../content/BlockId';
import { ITEMS, ItemId, ItemStack, createStack } from '../items/Item';
import { World } from '../world/World';

export interface FurnaceStateSnapshot {
  x: number;
  y: number;
  z: number;
  input: ItemStack | null;
  fuel: ItemStack | null;
  output: ItemStack | null;
  burnRemaining: number;
  burnTotal: number;
  smeltProgress: number;
}

export interface FurnaceRecipe {
  output: ItemId;
  count: number;
  seconds: number;
}

export const FURNACE_RECIPES: Readonly<Partial<Record<ItemId, FurnaceRecipe>>> = {
  [ItemId.GoldOre]: { output: ItemId.GoldIngot, count: 1, seconds: 8 },
  [ItemId.Sand]: { output: ItemId.Glass, count: 1, seconds: 6 },
  [ItemId.CaveShroom]: { output: ItemId.RoastedCaveShroom, count: 1, seconds: 5 },
  [ItemId.CaveBerries]: { output: ItemId.DriedCaveBerries, count: 1, seconds: 4 },
  [ItemId.Cactus]: { output: ItemId.CactusGreen, count: 1, seconds: 6 },
};

export const FURNACE_FUELS: Readonly<Partial<Record<ItemId, number>>> = {
  [ItemId.Coal]: 80,
  [ItemId.OakLog]: 15,
  [ItemId.SpruceLog]: 15,
  [ItemId.OakPlanks]: 15,
  [ItemId.Stick]: 5,
};

export function getFurnaceRecipe(stack: ItemStack | null): FurnaceRecipe | null {
  return stack ? (FURNACE_RECIPES[stack.id] ?? null) : null;
}

export function getFuelSeconds(stack: ItemStack | null): number {
  return stack ? (FURNACE_FUELS[stack.id] ?? 0) : 0;
}

/** Persistent placed-furnace state and loaded-area processing simulation. */
export class FurnaceManager {
  private readonly states = new Map<string, FurnaceStateSnapshot>();
  private burnSoundTimer = 0;

  constructor(
    private readonly world: World,
    private readonly audio: AudioManager,
    snapshots: FurnaceStateSnapshot[] | undefined,
    private readonly dropItem: (x: number, y: number, z: number, stack: ItemStack) => void
  ) {
    for (const snapshot of snapshots ?? []) {
      this.states.set(this.key(snapshot.x, snapshot.y, snapshot.z), this.cloneState(snapshot));
    }
  }

  public update(dt: number): void {
    let anyBurning = false;
    for (const [key, state] of this.states) {
      if (!this.world.isPositionLoaded(state.x, state.z)) continue;
      const block = this.world.getBlock(state.x, state.y, state.z);
      if (block !== BlockId.Furnace && block !== BlockId.LitFurnace) {
        this.states.delete(key);
        continue;
      }

      const recipe = getFurnaceRecipe(state.input);
      const canSmelt = recipe !== null && this.canAcceptOutput(state, recipe);
      if (state.burnRemaining <= 0 && canSmelt) {
        const fuelSeconds = getFuelSeconds(state.fuel);
        if (fuelSeconds > 0 && state.fuel) {
          state.fuel.count--;
          if (state.fuel.count <= 0) state.fuel = null;
          state.burnRemaining = fuelSeconds;
          state.burnTotal = fuelSeconds;
          this.audio.playFurnaceIgnite();
        }
      }

      if (state.burnRemaining > 0) {
        anyBurning = true;
        state.burnRemaining = Math.max(0, state.burnRemaining - dt);
        if (canSmelt && recipe) {
          state.smeltProgress += dt;
          if (state.smeltProgress >= recipe.seconds) this.completeSmelt(state, recipe);
        } else if (!recipe) {
          state.smeltProgress = 0;
        }
      }

      const shouldBeLit = state.burnRemaining > 0;
      if (shouldBeLit && block !== BlockId.LitFurnace) {
        this.world.setBlock(state.x, state.y, state.z, BlockId.LitFurnace);
      } else if (!shouldBeLit && block !== BlockId.Furnace) {
        this.world.setBlock(state.x, state.y, state.z, BlockId.Furnace);
      }
    }

    this.burnSoundTimer -= dt;
    if (anyBurning && this.burnSoundTimer <= 0) {
      this.burnSoundTimer = 2.2;
      this.audio.playFurnaceBurn();
    }
  }

  public getOrCreate(x: number, y: number, z: number): FurnaceStateSnapshot {
    const coords = { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) };
    const key = this.key(coords.x, coords.y, coords.z);
    let state = this.states.get(key);
    if (!state) {
      state = {
        ...coords,
        input: null,
        fuel: null,
        output: null,
        burnRemaining: 0,
        burnTotal: 0,
        smeltProgress: 0,
      };
      this.states.set(key, state);
    }
    return state;
  }

  public breakAt(x: number, y: number, z: number): void {
    const key = this.key(x, y, z);
    const state = this.states.get(key);
    if (!state) return;
    for (const stack of [state.input, state.fuel, state.output]) {
      if (stack && stack.count > 0) this.dropItem(state.x + 0.5, state.y + 0.5, state.z + 0.5, { ...stack });
    }
    this.states.delete(key);
  }

  public snapshot(): FurnaceStateSnapshot[] {
    return [...this.states.values()].map((state) => this.cloneState(state));
  }

  private completeSmelt(state: FurnaceStateSnapshot, recipe: FurnaceRecipe): void {
    if (!state.input) return;
    state.input.count--;
    if (state.input.count <= 0) state.input = null;
    if (state.output) state.output.count += recipe.count;
    else state.output = createStack(recipe.output, recipe.count);
    state.smeltProgress = 0;
    this.audio.playFurnaceComplete();
  }

  private canAcceptOutput(state: FurnaceStateSnapshot, recipe: FurnaceRecipe): boolean {
    if (!state.output) return true;
    return state.output.id === recipe.output &&
      state.output.count + recipe.count <= ITEMS[recipe.output].maxStack;
  }

  private cloneState(state: FurnaceStateSnapshot): FurnaceStateSnapshot {
    return {
      ...state,
      input: state.input ? { ...state.input } : null,
      fuel: state.fuel ? { ...state.fuel } : null,
      output: state.output ? { ...state.output } : null,
    };
  }

  private key(x: number, y: number, z: number): string {
    return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
  }
}
