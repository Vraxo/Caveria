import {
  FurnaceManager,
  FurnaceStateSnapshot,
  getFuelSeconds,
} from '../gameplay/FurnaceManager';
import { HOTBAR_SIZE, Inventory, TOTAL_INVENTORY_SLOTS } from '../items/Inventory';
import { ITEMS, ItemStack } from '../items/Item';
import { TextureAtlas } from '../rendering/TextureAtlas';
import { renderItemStackIntoSlot } from './Hotbar';
import {
  bindTouchSlotModeButton,
  positionCursorStack,
  resolveSlotPointerAction,
} from './ModalPointerMode';

type MachineSlot = 'input' | 'fuel' | 'output';

/** Furnace workstation UI with machine slots, progress, cursor handling, and quick transfers. */
export class FurnaceModal {
  public isOpen = false;

  private readonly modalEl = document.getElementById('furnace-modal')!;
  private readonly titleEl = document.getElementById('furnace-title')!;
  private readonly inputEl = document.getElementById('furnace-input-slot')!;
  private readonly fuelEl = document.getElementById('furnace-fuel-slot')!;
  private readonly outputEl = document.getElementById('furnace-output-slot')!;
  private readonly fuelFillEl = document.getElementById('furnace-fuel-fill')!;
  private readonly progressFillEl = document.getElementById('furnace-progress-fill')!;
  private readonly backpackEl = document.getElementById('furnace-backpack-grid')!;
  private readonly hotbarEl = document.getElementById('furnace-hotbar-grid')!;
  private readonly cursorEl = document.getElementById('cursor-item')!;
  private state: FurnaceStateSnapshot | null = null;
  private cursorStack: ItemStack | null = null;
  private refreshTimer = 0;

  constructor(
    private readonly inventory: Inventory,
    private readonly atlas: TextureAtlas,
    private readonly furnaces: FurnaceManager,
    private readonly onDropOverflow: (stack: ItemStack) => void,
    onRequestClose: () => void
  ) {
    document.getElementById('furnace-close-btn')!.addEventListener('click', onRequestClose);
    bindTouchSlotModeButton(
      document.getElementById('furnace-tap-mode-btn') as HTMLButtonElement | null
    );
    window.addEventListener('pointermove', (event) => {
      if (!this.isOpen) return;
      positionCursorStack(this.cursorEl, event);
    });
    for (const [element, slot] of [
      [this.inputEl, 'input'],
      [this.fuelEl, 'fuel'],
      [this.outputEl, 'output'],
    ] as Array<[HTMLElement, MachineSlot]>) {
      element.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        positionCursorStack(this.cursorEl, event);
        const { button, shiftKey } = resolveSlotPointerAction(event);
        this.handleMachineClick(slot, button, shiftKey);
      });
    }
    this.inventory.onChange(() => {
      if (this.isOpen) this.renderAll();
    });
  }

  public open(x: number, y: number, z: number): void {
    this.state = this.furnaces.getOrCreate(x, y, z);
    this.titleEl.textContent = this.furnaces.isCampfire(this.state) ? 'Campfire Cooking' : 'Furnace';
    this.isOpen = true;
    this.modalEl.classList.remove('hidden');
    this.renderAll();
  }

  public close(): void {
    if (!this.isOpen) return;
    if (this.cursorStack) {
      this.inventory.addItem(this.cursorStack);
      if (this.cursorStack.count > 0) this.onDropOverflow({ ...this.cursorStack });
      this.cursorStack = null;
    }
    this.state = null;
    this.isOpen = false;
    this.modalEl.classList.add('hidden');
    this.cursorEl.classList.add('hidden');
  }

  public update(dt: number): void {
    if (!this.isOpen) return;
    this.refreshTimer -= dt;
    if (this.refreshTimer <= 0) {
      this.refreshTimer = 0.15;
      this.renderAll();
    }
  }

  private renderAll(): void {
    if (!this.state) return;
    renderItemStackIntoSlot(this.inputEl, this.state.input, this.atlas);
    renderItemStackIntoSlot(this.fuelEl, this.state.fuel, this.atlas);
    renderItemStackIntoSlot(this.outputEl, this.state.output, this.atlas);
    this.outputEl.classList.toggle('craft-ready', this.state.output !== null);

    const fuelRatio = this.state.burnTotal > 0
      ? this.state.burnRemaining / this.state.burnTotal
      : 0;
    const recipe = this.furnaces.getRecipe(this.state, this.state.input);
    const progressRatio = recipe ? this.state.smeltProgress / recipe.seconds : 0;
    this.fuelFillEl.style.width = `${Math.round(Math.min(1, fuelRatio) * 100)}%`;
    this.progressFillEl.style.width = `${Math.round(Math.min(1, progressRatio) * 100)}%`;

    this.renderInventoryRange(this.backpackEl, HOTBAR_SIZE, TOTAL_INVENTORY_SLOTS);
    this.renderInventoryRange(this.hotbarEl, 0, HOTBAR_SIZE, true);
    if (this.cursorStack) {
      this.cursorEl.classList.remove('hidden');
      renderItemStackIntoSlot(this.cursorEl, this.cursorStack, this.atlas);
    } else {
      this.cursorEl.classList.add('hidden');
    }
  }

  private renderInventoryRange(container: HTMLElement, start: number, end: number, hotbar = false): void {
    container.innerHTML = '';
    for (let index = start; index < end; index++) {
      const slotEl = document.createElement('div');
      slotEl.className = 'inv-slot';
      renderItemStackIntoSlot(
        slotEl,
        this.inventory.getSlot(index),
        this.atlas,
        hotbar ? String(index + 1) : undefined
      );
      slotEl.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        positionCursorStack(this.cursorEl, event);
        const { button, shiftKey } = resolveSlotPointerAction(event);
        this.handleInventoryClick(index, button, shiftKey);
      });
      container.appendChild(slotEl);
    }
  }

  private handleMachineClick(slot: MachineSlot, button: number, shift: boolean): void {
    if (!this.state) return;
    const target = this.state[slot];
    if (slot === 'output') {
      if (!target) return;
      if (shift) {
        const moving = { ...target };
        this.inventory.addItem(moving);
        this.state.output = moving.count > 0 ? moving : null;
      } else if (!this.cursorStack) {
        this.cursorStack = target;
        this.state.output = null;
      } else if (this.cursorStack.id === target.id) {
        const space = ITEMS[target.id].maxStack - this.cursorStack.count;
        const moved = Math.min(space, target.count);
        this.cursorStack.count += moved;
        target.count -= moved;
        if (target.count <= 0) this.state.output = null;
      }
      this.renderAll();
      return;
    }

    if (shift && target) {
      const moving = { ...target };
      this.inventory.addItem(moving);
      this.state[slot] = moving.count > 0 ? moving : null;
      if (slot === 'input') this.state.smeltProgress = 0;
      this.renderAll();
      return;
    }
    if (button !== 0 && button !== 2) return;

    if (!this.cursorStack) {
      if (!target) return;
      const take = button === 2 ? Math.ceil(target.count / 2) : target.count;
      this.cursorStack = { ...target, count: take };
      target.count -= take;
      this.state[slot] = target.count > 0 ? target : null;
    } else if (this.accepts(slot, this.cursorStack)) {
      if (!target) {
        const count = button === 2 ? 1 : this.cursorStack.count;
        this.state[slot] = { ...this.cursorStack, count };
        this.cursorStack.count -= count;
        if (this.cursorStack.count <= 0) this.cursorStack = null;
      } else if (target.id === this.cursorStack.id) {
        const space = ITEMS[target.id].maxStack - target.count;
        const moved = Math.min(space, button === 2 ? 1 : this.cursorStack.count);
        target.count += moved;
        this.cursorStack.count -= moved;
        if (this.cursorStack.count <= 0) this.cursorStack = null;
      } else if (button === 0) {
        const previous = target;
        this.state[slot] = this.cursorStack;
        this.cursorStack = previous;
      }
    }
    if (slot === 'input') this.state.smeltProgress = 0;
    this.renderAll();
  }

  private handleInventoryClick(index: number, button: number, shift: boolean): void {
    const target = this.inventory.getSlot(index);
    if (shift && target && this.state) {
      if (this.state && this.furnaces.getRecipe(this.state, target) && this.transferToMachine(index, 'input')) return;
      if (getFuelSeconds(target) > 0 && this.transferToMachine(index, 'fuel')) return;
      const destination = index < HOTBAR_SIZE
        ? [HOTBAR_SIZE, TOTAL_INVENTORY_SLOTS]
        : [0, HOTBAR_SIZE];
      this.quickMoveRange(index, destination[0], destination[1]);
      this.renderAll();
      return;
    }
    if (button !== 0 && button !== 2) return;

    if (!this.cursorStack) {
      if (!target) return;
      const take = button === 2 ? Math.ceil(target.count / 2) : target.count;
      this.cursorStack = { ...target, count: take };
      target.count -= take;
      this.inventory.setSlot(index, target.count > 0 ? target : null);
    } else if (!target) {
      const count = button === 2 ? 1 : this.cursorStack.count;
      this.inventory.setSlot(index, { ...this.cursorStack, count });
      this.cursorStack.count -= count;
      if (this.cursorStack.count <= 0) this.cursorStack = null;
    } else if (target.id === this.cursorStack.id && ITEMS[target.id].maxStack > 1) {
      const moved = Math.min(
        ITEMS[target.id].maxStack - target.count,
        button === 2 ? 1 : this.cursorStack.count
      );
      target.count += moved;
      this.cursorStack.count -= moved;
      if (this.cursorStack.count <= 0) this.cursorStack = null;
      this.inventory.setSlot(index, target);
    } else if (button === 0) {
      this.inventory.setSlot(index, this.cursorStack);
      this.cursorStack = target;
    }
    this.renderAll();
  }

  private transferToMachine(index: number, slot: 'input' | 'fuel'): boolean {
    if (!this.state) return false;
    const source = this.inventory.getSlot(index);
    if (!source || !this.accepts(slot, source)) return false;
    const target = this.state[slot];
    if (target && target.id !== source.id) return false;
    const space = ITEMS[source.id].maxStack - (target?.count ?? 0);
    if (space <= 0) return false;
    const moved = Math.min(space, source.count);
    if (target) target.count += moved;
    else this.state[slot] = { ...source, count: moved };
    source.count -= moved;
    this.inventory.setSlot(index, source.count > 0 ? source : null);
    if (slot === 'input') this.state.smeltProgress = 0;
    this.renderAll();
    return true;
  }

  private accepts(slot: 'input' | 'fuel', stack: ItemStack): boolean {
    return slot === 'input'
      ? this.state !== null && this.furnaces.getRecipe(this.state, stack) !== null
      : getFuelSeconds(stack) > 0;
  }

  private quickMoveRange(from: number, start: number, end: number): void {
    const source = this.inventory.getSlot(from);
    if (!source) return;
    const definition = ITEMS[source.id];
    if (definition.maxStack > 1) {
      for (let index = start; index < end && source.count > 0; index++) {
        const target = this.inventory.getSlot(index);
        if (target?.id !== source.id || target.count >= definition.maxStack) continue;
        const moved = Math.min(definition.maxStack - target.count, source.count);
        target.count += moved;
        source.count -= moved;
      }
    }
    for (let index = start; index < end && source.count > 0; index++) {
      if (this.inventory.getSlot(index)) continue;
      this.inventory.setSlot(index, { ...source });
      source.count = 0;
    }
    this.inventory.setSlot(from, source.count > 0 ? source : null);
  }
}
