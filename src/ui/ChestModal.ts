import { ChestManager, ChestStateSnapshot } from '../gameplay/ChestManager';
import { HOTBAR_SIZE, Inventory, TOTAL_INVENTORY_SLOTS } from '../items/Inventory';
import { ITEMS, ItemStack } from '../items/Item';
import { TextureAtlas } from '../rendering/TextureAtlas';
import { renderItemStackIntoSlot } from './Hotbar';
import {
  bindTouchSlotModeButton,
  positionCursorStack,
  resolveSlotPointerAction,
} from './ModalPointerMode';

export interface StorageState {
  slots: Array<ItemStack | null>;
}

/** Container storage UI with cursor handling and bidirectional quick transfer. */
export class ChestModal {
  public isOpen = false;

  private readonly modalEl = document.getElementById('chest-modal')!;
  private readonly chestGridEl = document.getElementById('chest-storage-grid')!;
  private readonly backpackEl = document.getElementById('chest-backpack-grid')!;
  private readonly hotbarEl = document.getElementById('chest-hotbar-grid')!;
  private readonly cursorEl = document.getElementById('cursor-item')!;
  private readonly titleEl = document.getElementById('chest-modal-title')!;
  private readonly footerEl = document.getElementById('chest-modal-tip')!;
  private state: StorageState | null = null;
  private cursorStack: ItemStack | null = null;

  constructor(
    private readonly inventory: Inventory,
    private readonly atlas: TextureAtlas,
    private readonly chests: ChestManager,
    private readonly onDropOverflow: (stack: ItemStack) => void,
    onRequestClose: () => void
  ) {
    document.getElementById('chest-close-btn')!.addEventListener('click', onRequestClose);
    bindTouchSlotModeButton(
      document.getElementById('chest-tap-mode-btn') as HTMLButtonElement | null
    );
    window.addEventListener('pointermove', (event) => {
      if (!this.isOpen) return;
      positionCursorStack(this.cursorEl, event);
    });
    this.inventory.onChange(() => {
      if (this.isOpen) this.renderAll();
    });
  }

  public open(x: number, y: number, z: number): boolean {
    const state = this.chests.getOrCreate(x, y, z);
    if (!state) return false;
    this.openStorage(state, 'Chest', 'Shift-click to move stacks between the chest and inventory');
    return true;
  }

  public openStorage(
    state: StorageState,
    title: string,
    tip = 'Shift-click to move stacks between storage and inventory'
  ): void {
    this.state = state;
    this.titleEl.textContent = title;
    this.footerEl.textContent = tip;
    this.isOpen = true;
    this.modalEl.classList.remove('hidden');
    requestAnimationFrame(() => {
      if (this.isOpen) this.modalEl.classList.add('opened');
    });
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
    this.modalEl.classList.remove('opened');
    this.modalEl.classList.add('hidden');
    this.cursorEl.classList.add('hidden');
  }

  public isOpenAt(x: number, y: number, z: number): boolean {
    if (!this.isOpen || !this.isChestState(this.state)) return false;
    return this.state.x === Math.floor(x)
      && this.state.y === Math.floor(y)
      && this.state.z === Math.floor(z);
  }

  private renderAll(): void {
    if (!this.state) return;
    this.chestGridEl.innerHTML = '';
    for (let index = 0; index < this.state.slots.length; index++) {
      const slotEl = document.createElement('div');
      slotEl.className = 'inv-slot';
      renderItemStackIntoSlot(slotEl, this.state.slots[index], this.atlas);
      slotEl.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        positionCursorStack(this.cursorEl, event);
        const { button, shiftKey } = resolveSlotPointerAction(event);
        this.handleChestClick(index, button, shiftKey);
      });
      this.chestGridEl.appendChild(slotEl);
    }
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

  private handleChestClick(index: number, button: number, shift: boolean): void {
    if (!this.state) return;
    const target = this.state.slots[index];
    if (shift && target) {
      const moving = { ...target };
      this.inventory.addItem(moving);
      this.state.slots[index] = moving.count > 0 ? moving : null;
      this.renderAll();
      return;
    }
    if (button !== 0 && button !== 2) return;
    if (!this.cursorStack) {
      if (!target) return;
      const take = button === 2 ? Math.ceil(target.count / 2) : target.count;
      this.cursorStack = { ...target, count: take };
      target.count -= take;
      this.state.slots[index] = target.count > 0 ? target : null;
    } else if (!target) {
      const count = button === 2 ? 1 : this.cursorStack.count;
      this.state.slots[index] = { ...this.cursorStack, count };
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
    } else if (button === 0) {
      this.state.slots[index] = this.cursorStack;
      this.cursorStack = target;
    }
    this.renderAll();
  }

  private handleInventoryClick(index: number, button: number, shift: boolean): void {
    const target = this.inventory.getSlot(index);
    if (shift && target) {
      this.transferInventoryToChest(index);
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

  private isChestState(state: StorageState | null): state is ChestStateSnapshot {
    return state !== null && 'x' in state && 'y' in state && 'z' in state;
  }

  private transferInventoryToChest(index: number): void {
    if (!this.state) return;
    const source = this.inventory.getSlot(index);
    if (!source) return;
    const maxStack = ITEMS[source.id].maxStack;
    if (maxStack > 1) {
      for (const target of this.state.slots) {
        if (source.count <= 0) break;
        if (target?.id !== source.id || target.count >= maxStack) continue;
        const moved = Math.min(maxStack - target.count, source.count);
        target.count += moved;
        source.count -= moved;
      }
    }
    for (let slot = 0; slot < this.state.slots.length && source.count > 0; slot++) {
      if (this.state.slots[slot]) continue;
      const moved = Math.min(maxStack, source.count);
      this.state.slots[slot] = { ...source, count: moved };
      source.count -= moved;
    }
    this.inventory.setSlot(index, source.count > 0 ? source : null);
  }
}
